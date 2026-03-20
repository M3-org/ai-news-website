/**
 * GLBFader — Renders 0-2 ThreeDBackground instances with crossfade opacity.
 *
 * Thin wrapper that resolves which GLB scenes are active at the current frame
 * and passes through all config fields to ThreeDBackground.
 */
import React, { useEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { useGLTF } from "@react-three/drei";
import { ThreeDBackground, type GraphCamera } from "./ThreeDBackground";
import { resolveActiveFaderScenes, type FaderSceneBounds } from "./fader";
import { resolveAsset } from "./resolveAsset";
import type { FaderConfig, FaderSceneKey } from "./timing";

interface GLBFaderProps {
  configs: Record<FaderSceneKey, FaderConfig>;
  sceneBounds: FaderSceneBounds[];
  graphCamera: GraphCamera;
  graphCameraCenter: number;
}

export const GLBFader: React.FC<GLBFaderProps> = ({
  configs,
  sceneBounds,
  graphCamera,
  graphCameraCenter,
}) => {
  // Preload all GLBs upfront so scene transitions don't flash raw transforms.
  const glbUrls = useMemo(
    () => Object.values(configs).map((c) => c.glbFile).filter(Boolean),
    [configs],
  );
  useEffect(() => { for (const url of glbUrls) useGLTF.preload(resolveAsset(url)); }, [glbUrls]);

  const frame = useCurrentFrame();
  const activeScenes = resolveActiveFaderScenes(frame, sceneBounds, configs);

  return (
    <>
      {activeScenes.filter((s) => s.config.glbFile).map((scene) => (
        <ThreeDBackground
          key={scene.sceneKey}
          glbFile={scene.config.glbFile}
          opacity={scene.computedOpacity}
          sceneScale={scene.config.sceneScale}
          sceneOffset={[scene.config.sceneOffsetX, scene.config.sceneOffsetY, scene.config.sceneOffsetZ]}
          sceneRotation={[scene.config.sceneRotationX, scene.config.sceneRotationY, scene.config.sceneRotationZ]}
          cameraYOffset={scene.config.cameraYOffset}
          fov={scene.config.fov}
          custom={scene.config.mode === "custom"}
          useStandardAnimation={scene.config.mode === "standard"}
          loopMode={scene.config.loopMode}
          startFrame={scene.sceneFrom + scene.config.startFrame}
          rimGlow={scene.config.rimGlow}
          rimColor={scene.config.rimColor}
          rimIntensity={scene.config.rimIntensity}
          rimPower={scene.config.rimPower}
          effectorInnerRadius={scene.config.effectorInnerRadius}
          effectorOuterRadius={scene.config.effectorOuterRadius}
          effectorStrength={scene.config.effectorStrength}
          rotationAxis={scene.config.rotationAxis}
          effectorReveal={scene.config.effectorReveal}
          effectorRevealFrames={scene.config.effectorRevealFrames}
          effectorRevealPower={scene.config.effectorRevealPower}
          graphCamera={graphCamera}
          graphCameraCenter={graphCameraCenter}
        />
      ))}
    </>
  );
};
