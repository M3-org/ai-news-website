/**
 * ThreeDBackground — Wraps the Modulation GLB scene as a fullscreen background layer.
 * Used by TitleCard and EndCard for dynamic 3D intro/outro visuals.
 */
import { useRef, useMemo } from "react";
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
  Vector2,
  AnimationClip,
  PerspectiveCamera as THREEPerspectiveCamera,
} from "three";
import type { EffectorConfig, EffectMap } from "./ThreeD/Effector";
import { useEffector } from "./ThreeD/useEffector";
import { useCameraAnimation } from "./ThreeD/useCameraAnimation";
import { Fisheye } from "./ThreeD/Fisheye";
import { useAudioShake } from "./ThreeD/useAudioShake";

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
}

const GlbModel = ({
  url,
  effectorConfig,
  rotationAxis,
  effectMap,
  cameraRef,
  onCameraUpdate,
}: {
  url: string;
  effectorConfig: EffectorConfig;
  rotationAxis: "x" | "y" | "z";
  effectMap?: EffectMap;
  cameraRef: React.RefObject<THREEPerspectiveCamera | null>;
  onCameraUpdate?: (velocity: number, fov: number) => void;
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
}) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  const cameraRef = useRef<THREEPerspectiveCamera | null>(null);
  const velocityRef = useRef(0);
  const caRef = useRef(new Vector2(0, 0));

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
          url={resolveAsset(glbFile)}
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
