/**
 * ThreeDBackground — Wraps the Modulation GLB scene as a fullscreen background layer.
 * Used by TitleCard and EndCard for dynamic 3D intro/outro visuals.
 */
import { useRef, useMemo, useEffect } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useVideoConfig, useCurrentFrame, staticFile } from "remotion";
import { useGLTF, useTexture, PerspectiveCamera } from "@react-three/drei";
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
  Vector2,
  AnimationClip,
  PerspectiveCamera as THREEPerspectiveCamera,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Texture,
} from "three";
import type { EffectorConfig, EffectMap } from "./ThreeD/Effector";
import { useEffector } from "./ThreeD/useEffector";
import { useCameraAnimation } from "./ThreeD/useCameraAnimation";
import { Fisheye } from "./ThreeD/Fisheye";
import { useAudioShake } from "./ThreeD/useAudioShake";

interface ThreeDBackgroundProps {
  glbFile?: string;
  /** Lightmap texture path in public/ — auto-derived from glbFile if not set.
   *  e.g. "Modulation_GLBs/lightmaps/cron_red_lightmap.jpg" */
  lightmapFile?: string;
  lightmapIntensity?: number;
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
}

const GlbModel = ({
  url,
  lightmapUrl,
  lightmapIntensity = 1.0,
  effectorConfig,
  rotationAxis,
  effectMap,
  cameraRef,
  onCameraUpdate,
}: {
  url: string;
  lightmapUrl?: string;
  lightmapIntensity?: number;
  effectorConfig: EffectorConfig;
  rotationAxis: "x" | "y" | "z";
  effectMap?: EffectMap;
  cameraRef: React.RefObject<THREEPerspectiveCamera | null>;
  onCameraUpdate?: (velocity: number, fov: number) => void;
}) => {
  const { scene, nodes, animations } = useGLTF(url);

  // Load lightmap atlas if explicitly provided
  const lightmap = lightmapUrl ? useTexture(lightmapUrl) : null;

  // Assign lightmap to all meshes that have UV2 (TEXCOORD_1)
  useEffect(() => {
    if (!lightmap) return;
    lightmap.flipY = false; // glTF convention
    lightmap.colorSpace = SRGBColorSpace;
    scene.traverse((child) => {
      if (
        child instanceof Mesh &&
        child.geometry.attributes.uv2 &&
        child.material instanceof MeshStandardMaterial
      ) {
        child.material.lightMap = lightmap as Texture;
        child.material.lightMapIntensity = lightmapIntensity;
        child.material.needsUpdate = true;
      }
    });
  }, [scene, lightmap, lightmapIntensity]);

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

  return <primitive object={scene} scale={1} rotation={[0, 0, 0]} />;
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
  if (cameraRef.current) {
    cameraRef.current.position.x += shakeX;
    cameraRef.current.position.y += shakeY;
  }
  return null;
};

export const ThreeDBackground: React.FC<ThreeDBackgroundProps> = ({
  glbFile = "Modulation_GLBs/ClankTank.glb",
  lightmapFile,
  lightmapIntensity = 1.0,
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
}) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  const cameraRef = useRef<THREEPerspectiveCamera | null>(null);
  const velocityRef = useRef(0);
  const caRef = useRef(new Vector2(0, 0));

  // Only resolve lightmap if explicitly provided — no auto-derive
  const resolvedLightmap = useMemo(() => {
    if (!lightmapFile) return undefined;
    return staticFile(lightmapFile);
  }, [lightmapFile]);

  const mergedEffectMap = useMemo(() => ({ ...effectMap }) as EffectMap, [effectMap]);

  const effectorConfig: EffectorConfig = {
    innerRadius: effectorInnerRadius,
    outerRadius: effectorOuterRadius,
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
          fov={50}
        />

        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <spotLight
          position={[-10, 10, 10]}
          angle={0.15}
          penumbra={1}
          intensity={1}
        />

        <GlbModel
          url={staticFile(glbFile)}
          lightmapUrl={resolvedLightmap}
          lightmapIntensity={lightmapIntensity}
          effectorConfig={effectorConfig}
          rotationAxis={rotationAxis}
          effectMap={mergedEffectMap}
          cameraRef={cameraRef}
          onCameraUpdate={(v) => {
            velocityRef.current = v;
          }}
        />

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
