/**
 * GlbScene.tsx — Main scene composition.
 *
 * Defines the Zod schema (drives Remotion Studio sliders), loads the GLB model,
 * and wires up the effector system. Camera animation is read from the GLB file
 * (Blender-animated camera) and applied via direct track sampling.
 */
import { useRef, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useVideoConfig, useCurrentFrame, staticFile, Audio } from "remotion";
import { useGLTF, PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Vignette, ChromaticAberration, Noise, ToneMapping, Bloom } from "@react-three/postprocessing";
import { ToneMappingMode, BlendFunction } from "postprocessing";
import { Vector2, AnimationClip, PerspectiveCamera as THREEPerspectiveCamera } from "three";
import { z } from "zod";
import type { EffectorConfig, EffectMap } from "./Effector";
import { useEffector } from "./useEffector";
import { useCameraAnimation } from "./useCameraAnimation";
import { Fisheye } from "./Fisheye";
import { useAudioShake } from "./useAudioShake";


/**
 * Loads a .glb model and applies effector-driven animation to its named groups.
 * Must be rendered inside a ThreeCanvas (R3F context required).
 */
const GlbModel = ({
  url,
  scale = 1,
  effectorConfig,
  rotationAxis,
  effectMap,
  cameraRef,
  onCameraUpdate,
}: {
  url: string;
  scale?: number;
  effectorConfig: EffectorConfig;
  rotationAxis: "x" | "y" | "z";
  effectMap?: EffectMap;
  cameraRef: React.RefObject<THREEPerspectiveCamera | null>;
  onCameraUpdate?: (velocity: number, fov: number) => void;
}) => {
  // useGLTF returns { scene, nodes, animations } — nodes keyed by Blender object names
  const { scene, nodes, animations } = useGLTF(url);

  // Apply camera animation from the GLB (Blender-animated camera)
  const { velocity, fov } = useCameraAnimation({
    animations: animations as AnimationClip[],
    cameraRef,
  });

  // Report velocity and fov back for post-processing effects and modulation
  if (onCameraUpdate) onCameraUpdate(velocity, fov);

  // The hook scans `nodes` for named groups and animates their children each frame
  useEffector({ nodes, config: effectorConfig, rotationAxis, effectMap, animations, gltfScene: scene });

  return (
    <primitive
      object={scene}
      scale={scale}
      rotation={[0, 0, 0]}
    />
  );
};



/**
 * Zod schema — each field becomes a slider in Remotion Studio's sidebar.
 * Changing values in the Studio instantly re-renders the scene.
 *
 * Camera position/animation now comes from the GLB (Blender-animated).
 */
export const ainewsSchema = z.object({
  /** Master switch — false disables all effector-driven effects (scene renders static). */
  enabled: z.boolean().default(true),
  /** GLB file to load from public/ folder. */
  glbFile: z.string().default("ClankTank.glb"),
  /** Effect assignments — passed via inputProps for automation, merged with DEBUG_EFFECT_MAP. */
  effectMap: z.record(z.string(), z.union([
    z.array(z.string()),
    z.record(z.string(), z.any()),
  ])).default({}),
  effectorInnerRadius: z.number().step(0.1),
  effectorOuterRadius: z.number().step(0.1),
  effectorStrength: z.number().step(0.01),
  rotationAxis: z.enum(["x", "y", "z"]).default("x"),
  fisheyeStrength: z.number().step(0.01).default(-0.3),
  /** Audio modulation on fisheye. Adds bass energy * this value on top of fisheyeStrength (0 = off). */
  fisheyeAudioMod: z.number().step(0.01).default(0),
  fisheyeZoom: z.number().step(0.01).default(1.0),
  /** Audio file in public/ for sound-reactive shake. Empty string = disabled. */
  audioFile: z.string().default(""),
  /** Audio shake intensity multiplier (0 = off). */
  audioShakeIntensity: z.number().step(0.01).default(0.15),
  /** Bass vs overall energy weight for audio shake. 0 = all RMS, 1 = all bass. */
  audioShakeBass: z.number().step(0.01).default(0.7),
});

/**
 * Debug effect overrides — edit this object for manual testing.
 * These take priority over schema effectMap (automation props).
 * Leave empty for production / automated renders.
 *
 * Examples:
 *   "GearAssembly": { effects: ["rotate"], rotationAxis: "xyz", rotationSpeed: 0.05 },
 *   "Logo":         ["burn", "glow"],
 *   "Stage":        { effects: ["holoReveal"], holoReverse: true, holoStart: 400 },
 */
const DEBUG_EFFECT_MAP: EffectMap = {
  // Uncomment or add entries here for quick debugging:
};

/** Top-level composition component — receives props from the schema. */
export const AINEWS_trailer: React.FC<z.infer<typeof ainewsSchema>> = ({
  enabled,
  glbFile,
  effectMap: propsEffectMap,
  effectorInnerRadius,
  effectorOuterRadius,
  effectorStrength,
  rotationAxis,
  fisheyeStrength,
  fisheyeAudioMod,
  fisheyeZoom,
  audioFile,
  audioShakeIntensity,
  audioShakeBass,
}) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  // Ref for the camera — passed to GlbModel so useCameraAnimation can apply animation
  const cameraRef = useRef<THREEPerspectiveCamera | null>(null);

  // Camera state for post-processing effects (chromatic aberration, shake) and FOV modulation
  const velocityRef = useRef(0);
  const fovRef = useRef(80);

  // Stable Vector2 ref for ChromaticAberration — mutated in-place each frame.
  // Creating a new Vector2 every render causes postprocessing to reinitialize render targets → black flash.
  const caRef = useRef(new Vector2(0, 0));

  // Merge effect maps: debug overrides take priority over automation props
  const mergedEffectMap = useMemo(
    () => ({ ...propsEffectMap, ...DEBUG_EFFECT_MAP }) as EffectMap,
    [propsEffectMap],
  );

  // Bundle slider values into a config object for the effector hook
  // When disabled, force strength to 0 — all effects become dormant
  const effectorConfig: EffectorConfig = {
    innerRadius: effectorInnerRadius,
    outerRadius: effectorOuterRadius,
    strength: enabled ? effectorStrength : 0,
  };

  // Velocity-driven chromatic aberration — mutate existing Vector2, never create new
  const velocity = velocityRef.current;
  const deadzone = 0.15;
  const caOffset = velocity > deadzone
    ? Math.min((velocity - deadzone) * 0.15, 0.003)
    : 0;
  caRef.current.set(caOffset, caOffset * 0.4);

  // Audio-reactive shake — bass hits drive camera movement
  const audioShake = useAudioShake({
    audioFile,
    intensity: audioShakeIntensity,
    bassWeight: audioShakeBass,
  });

  // Camera shake — velocity shake + audio shake combined.
  // Applied on top of Blender-animated camera position.
  const velShake = velocity > deadzone ? Math.min((velocity - deadzone) * 0.3, 0.08) : 0;
  const shakeX = (Math.sin(frame * 127.1 + 311.7) * 43758.5453 % 1) * 2 - 1;
  const shakeY = (Math.sin(frame * 269.5 + 183.3) * 43758.5453 % 1) * 2 - 1;
  const totalShakeX = shakeX * velShake + audioShake.shakeX;
  const totalShakeY = shakeY * velShake + audioShake.shakeY;

  // Fisheye modulated by audio bass — baseline + bass pulse
  const modulatedFisheye = fisheyeStrength + audioShake.bass * fisheyeAudioMod;

  return (
    <AbsoluteFill>
      {/* Audio playback — same file used for shake analysis */}
      {audioFile && <Audio src={staticFile(audioFile)} />}
      <ThreeCanvas width={width} height={height}>
        {/* Camera — animation applied by useCameraAnimation hook in GlbModel */}
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault
          position={[0, 0, 10]}
          fov={50}
        />

        {/* Three-point-ish lighting */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />

        <GlbModel
          url={staticFile(glbFile)}
          scale={1}
          effectorConfig={effectorConfig}
          rotationAxis={rotationAxis}
          effectMap={mergedEffectMap}
          cameraRef={cameraRef}
          onCameraUpdate={(v, f) => { velocityRef.current = v; fovRef.current = f; }}
        />

        {/* Shake AFTER GlbModel — camera animation must be applied first */}
        <CameraShake cameraRef={cameraRef} shakeX={totalShakeX} shakeY={totalShakeY} />

        {/* Post-processing stack */}
        <EffectComposer>
          {/* Fisheye barrel distortion — strength can be modulated by FOV */}
          <Fisheye strength={modulatedFisheye} zoom={fisheyeZoom} />
          {/* ACES filmic tonemapping — tames hot emissive values into a pleasing curve */}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          {/* Bloom — picks up emissive objects driven by the glow effect */}
          <Bloom
            luminanceThreshold={1}
            luminanceSmoothing={0.3}
            intensity={2.6}
            mipmapBlur
          />
          {/* Velocity-driven chromatic aberration — heavy during camera rush, zero when settled */}
          <ChromaticAberration offset={caRef.current} radialModulation={false} />
          {/* Film grain — breaks CG cleanliness */}
          <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.3} />
          {/* Vignette — darkened edges for cinematic framing */}
          <Vignette offset={0.3} darkness={0.7} />
        </EffectComposer>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

/**
 * Applies shake offset to camera position after animation has been applied.
 * Runs in useFrame to ensure it happens after useCameraAnimation.
 */
const CameraShake = ({
  cameraRef,
  shakeX,
  shakeY,
}: {
  cameraRef: React.RefObject<THREEPerspectiveCamera | null>;
  shakeX: number;
  shakeY: number;
}) => {
  // Apply shake offset to camera position
  if (cameraRef.current) {
    cameraRef.current.position.x += shakeX;
    cameraRef.current.position.y += shakeY;
  }
  return null;
};
