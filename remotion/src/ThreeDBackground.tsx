/**
 * ThreeDBackground — Wraps the Modulation GLB scene as a fullscreen background layer.
 * Used by TitleCard and EndCard for dynamic 3D intro/outro visuals.
 */
import { useEffect, useRef, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useVideoConfig, useCurrentFrame } from "remotion";
import { useGLTF, PerspectiveCamera } from "@react-three/drei";
import { resolveAsset } from "./resolveAsset";
import { useFrame } from "@react-three/fiber";
import {
  EffectComposer,
  Vignette,
  ChromaticAberration,
  Noise,
  ToneMapping,
  Bloom,
} from "@react-three/postprocessing";
import { ToneMappingMode, BlendFunction } from "postprocessing";
import {
  Color,
  Vector2,
  AnimationClip,
  AnimationMixer,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera as THREEPerspectiveCamera,
} from "three";
import { createRimMaterial } from "./ThreeD/RimMaterial";
import type { EffectorConfig, EffectMap } from "./ThreeD/Effector";
import { useEffector } from "./ThreeD/useEffector";
import { useCameraAnimation } from "./ThreeD/useCameraAnimation";
import { Fisheye } from "./ThreeD/Fisheye";
import { useAudioShake } from "./ThreeD/useAudioShake";

/** External 2D camera from the graph view (canvas coords + zoom). */
export interface GraphCamera {
  x: number;
  y: number;
  zoom: number;
}

interface ThreeDBackgroundProps {
  glbFile?: string;
  effectMap?: EffectMap;
  audioFile?: string;
  /** Opacity of the 3D layer (0-1). Allows text to overlay cleanly. */
  opacity?: number;
  /** Effector config overrides */
  effectorInnerRadius?: number;
  effectorOuterRadius?: number;
  effectorStrength?: number;
  rotationAxis?: "x" | "y" | "z";
  fisheyeStrength?: number;
  fisheyeAudioMod?: number;
  fisheyeZoom?: number;
  audioShakeIntensity?: number;
  audioShakeBass?: number;
  /** When provided, drives the 3D camera from the graph's 2D camera instead of GLB animation. */
  graphCamera?: GraphCamera;
  /** Center of the graph canvas in canvas coords (default 2500). */
  graphCameraCenter?: number;
  /** Use standard Three.js AnimationMixer instead of the effector system. */
  useStandardAnimation?: boolean;
  /** Uniform scale for the entire GLB scene (default 1). */
  sceneScale?: number;
  /** Play GLB animation once instead of looping (default false). */
  loopMode?: "none" | "loop" | "pingpong";
  /** Apply rim glow shader to all meshes (default false). */
  rimGlow?: boolean;
  /** Rim glow color (default "#ffffff"). */
  rimColor?: string;
  /** Rim brightness — values > 1 trigger Bloom (default 2). */
  rimIntensity?: number;
  /** Fresnel exponent — higher = thinner rim (default 2). */
  rimPower?: number;
  /** Custom GLB — skip all material/effect overrides, play as-is with original materials. */
  custom?: boolean;
  /** Frame offset — animation starts from 0 at this video frame (for scene-timed GLBs). */
  startFrame?: number;
  /** Scene position offset [x, y, z] — moves the entire GLB in 3D space (default [0,0,0]). */
  sceneOffset?: [number, number, number];
  /** Scene rotation [x, y, z] in degrees (default [0,0,0]). */
  sceneRotation?: [number, number, number];
  /** Camera Y offset when using graphCamera (default 15). */
  cameraYOffset?: number;
  /** Camera field of view in degrees (default 50). */
  fov?: number;
  /** Animate effector radius from 0 to configured value (default false). */
  effectorReveal?: boolean;
  /** Duration of effector reveal in frames (default 60). */
  effectorRevealFrames?: number;
}

const GlbModel = ({
  url,
  effectorConfig,
  rotationAxis,
  effectMap,
  cameraRef,
  onCameraUpdate,
  sceneScale = 1,
  offset = [0, 0, 0] as [number, number, number],
}: {
  url: string;
  effectorConfig: EffectorConfig;
  rotationAxis: "x" | "y" | "z";
  effectMap?: EffectMap;
  cameraRef: React.RefObject<THREEPerspectiveCamera | null>;
  onCameraUpdate?: (velocity: number, fov: number) => void;
  sceneScale?: number;
  offset?: [number, number, number];
}) => {
  const { scene, nodes, animations } = useGLTF(url);

  const { velocity, fov } = useCameraAnimation({
    animations: animations as AnimationClip[],
    cameraRef,
  });

  if (onCameraUpdate) onCameraUpdate(velocity, fov);

  useEffector({
    nodes,
    config: effectorConfig,
    rotationAxis,
    effectMap,
    animations,
    gltfScene: scene,
  });

  return <primitive object={scene} scale={sceneScale} rotation={[0, 0, 0]} position={offset as any} />;
};

function useRimGlowMaterial(
  scene: object & { traverse: (cb: (obj: unknown) => void) => void },
  rimGlow: boolean,
  rimColor: string,
  rimIntensity: number,
  rimPower: number,
) {
  useEffect(() => {
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      if (Array.isArray(child.material)) return;

      const mesh = child as Mesh;
      const currentMaterial = mesh.material as MeshStandardMaterial | MeshBasicMaterial;

      if (!mesh.userData._rimOriginalMaterial) {
        mesh.userData._rimOriginalMaterial = currentMaterial;
      }

      const orig = mesh.userData._rimOriginalMaterial as MeshStandardMaterial | MeshBasicMaterial;

      if (!rimGlow) {
        mesh.material = orig;
        return;
      }

      if (!mesh.userData._rimMaterial) {
        const hasAlpha =
          orig.transparent ||
          (orig.opacity != null && orig.opacity < 1) ||
          ("alphaMap" in orig && !!orig.alphaMap) ||
          ("alphaTest" in orig && orig.alphaTest > 0);

        const emissive =
          orig instanceof MeshStandardMaterial
            ? orig.emissive
            : "#000000";
        const emissiveIntensity =
          orig instanceof MeshStandardMaterial
            ? orig.emissiveIntensity
            : 0;

        mesh.userData._rimMaterial = createRimMaterial({
          baseColor: orig.color ?? "#aaaaaa",
          emissiveColor: emissive,
          emissiveIntensity,
          map: "map" in orig ? orig.map ?? null : null,
          opacity: orig.opacity ?? 1,
          transparent: hasAlpha,
          alphaTest: "alphaTest" in orig ? orig.alphaTest ?? 0 : 0,
          rimColor,
          rimIntensity,
          rimPower,
        });
      }

      const rimMat = mesh.userData._rimMaterial;
      const rimCol = new Color(rimColor);
      rimMat.uniforms.u_weight.value = 1.0;
      rimMat.uniforms.u_rimIntensity.value = rimIntensity;
      rimMat.uniforms.u_rimPower.value = Math.max(1e-4, rimPower);
      rimMat.uniforms.u_rimColor.value.set(rimCol.r, rimCol.g, rimCol.b);
      mesh.material = rimMat;
    });

    return () => {
      scene.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        if (Array.isArray(child.material)) return;
        if (child.userData._rimOriginalMaterial) {
          child.material = child.userData._rimOriginalMaterial;
        }
      });
    };
  }, [scene, rimGlow, rimColor, rimIntensity, rimPower]);
}

/** Resolve animation time based on loop mode. */
function resolveLoopTime(time: number, maxDuration: number, mode: "none" | "loop" | "pingpong"): number {
  if (maxDuration <= 0) return 0;
  if (mode === "none") return Math.min(time, Math.max(0, maxDuration - 0.001));
  if (mode === "loop") return time; // AnimationMixer loops by default
  // pingpong: bounce back and forth
  const cycle = time / maxDuration;
  const isReverse = Math.floor(cycle) % 2 === 1;
  const frac = cycle - Math.floor(cycle);
  return (isReverse ? 1 - frac : frac) * maxDuration;
}

/**
 * SimpleGlbModel — Standard Three.js AnimationMixer playback.
 * Frame-accurate: sets mixer time from Remotion's frame, no real-time clock.
 */
const SimpleGlbModel = ({
  url,
  sceneScale = 1,
  loopMode = "loop",
  startFrame = 0,
  rimGlow = false,
  rimColor = "#ffffff",
  rimIntensity = 2,
  rimPower = 2,
  offset = [0, 0, 0] as [number, number, number],
}: {
  url: string;
  sceneScale?: number;
  loopMode?: "none" | "loop" | "pingpong";
  startFrame?: number;
  rimGlow?: boolean;
  rimColor?: string;
  rimIntensity?: number;
  rimPower?: number;
  offset?: [number, number, number];
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scene, animations } = useGLTF(url);

  useRimGlowMaterial(scene, rimGlow, rimColor, rimIntensity, rimPower);

  const { mixer, maxDuration } = useMemo(() => {
    const m = new AnimationMixer(scene);
    let dur = 0;
    for (const clip of animations) {
      m.clipAction(clip).play();
      dur = Math.max(dur, clip.duration);
    }
    return { mixer: m, maxDuration: dur };
  }, [scene, animations]);

  const time = Math.max(0, frame - startFrame) / fps;
  const resolvedTime = resolveLoopTime(time, maxDuration, loopMode);
  mixer.setTime(resolvedTime);

  return <primitive object={scene} scale={sceneScale} rotation={[0, 0, 0]} position={offset as any} />;
};

/**
 * CustomGlbModel — Plays the GLB exactly as-is. No material overrides, no rim glow.
 * For GLBs with baked custom properties and internal modulation.
 */
const CustomGlbModel = ({
  url,
  sceneScale = 1,
  loopMode = "loop",
  startFrame = 0,
  rimGlow = false,
  rimColor = "#ffffff",
  rimIntensity = 2,
  rimPower = 2,
  offset = [0, 0, 0] as [number, number, number],
}: {
  url: string;
  sceneScale?: number;
  loopMode?: "none" | "loop" | "pingpong";
  startFrame?: number;
  rimGlow?: boolean;
  rimColor?: string;
  rimIntensity?: number;
  rimPower?: number;
  offset?: [number, number, number];
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scene, animations } = useGLTF(url);

  useRimGlowMaterial(scene, rimGlow, rimColor, rimIntensity, rimPower);

  const { mixer, maxDuration } = useMemo(() => {
    const m = new AnimationMixer(scene);
    let dur = 0;
    for (const clip of animations) {
      m.clipAction(clip).play();
      dur = Math.max(dur, clip.duration);
    }
    return { mixer: m, maxDuration: dur };
  }, [scene, animations]);

  const time = Math.max(0, frame - startFrame) / fps;
  const resolvedTime = resolveLoopTime(time, maxDuration, loopMode);
  mixer.setTime(resolvedTime);

  return <primitive object={scene} scale={sceneScale} rotation={[0, 0, 0]} position={offset as any} />;
};

/**
 * Overrides the 3D camera with the graph's 2D camera.
 * Runs in useFrame so it overwrites useCameraAnimation (which runs during render).
 */
const GraphCameraSync = ({
  cameraRef,
  graphCamera,
  center,
  yOffset = 15,
}: {
  cameraRef: React.RefObject<THREEPerspectiveCamera | null>;
  graphCamera: GraphCamera;
  center: number;
  yOffset?: number;
}) => {
  useFrame(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    // Map 2D canvas coords -> 3D position with subtle background drift.
    const lateralScale = 0.002;
    camera.position.x = (graphCamera.x - center) * lateralScale;
    camera.position.y = -(graphCamera.y - center) * lateralScale + yOffset;
    camera.position.z = 10 + (1 - graphCamera.zoom) * 5;

    // Face straight forward — no rotation, pure 2D panning
    camera.quaternion.set(0, 0, 0, 1);
  });

  return null;
};

const CameraShake = ({
  cameraRef,
  shakeX,
  shakeY,
}: {
  cameraRef: React.RefObject<THREEPerspectiveCamera | null>;
  shakeX: number;
  shakeY: number;
}) => {
  const prevShakeRef = useRef({ x: 0, y: 0 });

  // Remove last shake first, then apply current shake to prevent stacking in concurrent renders.
  useFrame(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.position.x += shakeX - prevShakeRef.current.x;
    camera.position.y += shakeY - prevShakeRef.current.y;
    prevShakeRef.current.x = shakeX;
    prevShakeRef.current.y = shakeY;
  });

  return null;
};

export const ThreeDBackground: React.FC<ThreeDBackgroundProps> = ({
  glbFile = "Modulation_GLBs/ClankTank.glb",
  effectMap = {},
  audioFile = "",
  opacity = 1,
  effectorInnerRadius = 5,
  effectorOuterRadius = 25,
  effectorStrength = 1,
  rotationAxis = "z",
  fisheyeStrength = -0.15,
  fisheyeAudioMod = 0,
  fisheyeZoom = 1,
  audioShakeIntensity = 0.05,
  audioShakeBass = 0.2,
  graphCamera,
  graphCameraCenter = 2500,
  useStandardAnimation = false,
  sceneScale = 1,
  loopMode = "loop",
  rimGlow = false,
  rimColor = "#ffffff",
  rimIntensity = 2,
  rimPower = 2,
  custom = false,
  startFrame = 0,
  sceneOffset = [0, 0, 0] as [number, number, number],
  sceneRotation = [0, 0, 0] as [number, number, number],
  cameraYOffset = 15,
  fov = 50,
  effectorReveal = false,
  effectorRevealFrames = 60,
}) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  const cameraRef = useRef<THREEPerspectiveCamera | null>(null);
  const velocityRef = useRef(0);
  const caRef = useRef(new Vector2(0, 0));

  const mergedEffectMap = useMemo(() => ({ ...effectMap }) as EffectMap, [effectMap]);
  const rotRad: [number, number, number] = [
    sceneRotation[0] * Math.PI / 180,
    sceneRotation[1] * Math.PI / 180,
    sceneRotation[2] * Math.PI / 180,
  ];

  const revealT = effectorReveal && effectorRevealFrames > 0
    ? Math.min(1, Math.max(0, (frame - startFrame) / effectorRevealFrames))
    : 1;
  const revealEase = revealT * revealT * (3 - 2 * revealT); // smoothstep

  const effectorConfig: EffectorConfig = {
    innerRadius: effectorInnerRadius * revealEase,
    outerRadius: effectorOuterRadius * revealEase,
    strength: effectorStrength,
  };

  const velocity = velocityRef.current;
  const deadzone = 0.15;
  const caOffset =
    velocity > deadzone ? Math.min((velocity - deadzone) * 0.15, 0.003) : 0;
  caRef.current.set(caOffset, caOffset * 0.4);

  const audioShake = useAudioShake({
    audioFile,
    intensity: audioShakeIntensity,
    bassWeight: audioShakeBass,
  });

  const velShake =
    velocity > deadzone ? Math.min((velocity - deadzone) * 0.3, 0.08) : 0;
  const shakeX = (Math.sin(frame * 127.1 + 311.7) * 43758.5453 % 1) * 2 - 1;
  const shakeY = (Math.sin(frame * 269.5 + 183.3) * 43758.5453 % 1) * 2 - 1;
  const totalShakeX = shakeX * velShake + audioShake.shakeX;
  const totalShakeY = shakeY * velShake + audioShake.shakeY;

  const modulatedFisheye = fisheyeStrength + audioShake.bass * fisheyeAudioMod;

  return (
    <AbsoluteFill style={{ opacity }}>
      <ThreeCanvas width={width} height={height}>
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault
          position={[0, 0, 10]}
          fov={fov}
        />

        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <spotLight
          position={[-10, 10, 10]}
          angle={0.15}
          penumbra={1}
          intensity={1}
        />

        <group rotation={rotRad}>
          {custom ? (
            <CustomGlbModel url={resolveAsset(glbFile)} sceneScale={sceneScale} loopMode={loopMode} startFrame={startFrame} rimGlow={rimGlow} rimColor={rimColor} rimIntensity={rimIntensity} rimPower={rimPower} offset={sceneOffset} />
          ) : useStandardAnimation ? (
            <SimpleGlbModel url={resolveAsset(glbFile)} sceneScale={sceneScale} loopMode={loopMode} startFrame={startFrame} rimGlow={rimGlow} rimColor={rimColor} rimIntensity={rimIntensity} rimPower={rimPower} offset={sceneOffset} />
          ) : (
            <GlbModel
              url={resolveAsset(glbFile)}
              effectorConfig={effectorConfig}
              rotationAxis={rotationAxis}
              effectMap={mergedEffectMap}
              cameraRef={cameraRef}
              sceneScale={sceneScale}
              offset={sceneOffset}
              onCameraUpdate={(v) => {
                velocityRef.current = v;
              }}
            />
          )}
        </group>

        {/* Graph camera sync — overrides GLB camera when provided */}
        {graphCamera && (
          <GraphCameraSync
            cameraRef={cameraRef}
            graphCamera={graphCamera}
            center={graphCameraCenter}
            yOffset={cameraYOffset}
          />
        )}

        <CameraShake
          cameraRef={cameraRef}
          shakeX={totalShakeX}
          shakeY={totalShakeY}
        />

        <EffectComposer>
          <Fisheye strength={modulatedFisheye} zoom={fisheyeZoom} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Bloom
            luminanceThreshold={1}
            luminanceSmoothing={0.3}
            intensity={2.6}
            mipmapBlur
          />
          <ChromaticAberration
            offset={caRef.current}
            radialModulation={false}
          />
          <Noise
            premultiply
            blendFunction={BlendFunction.SOFT_LIGHT}
            opacity={0.3}
          />
          <Vignette offset={0.3} darkness={0.7} />
        </EffectComposer>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
