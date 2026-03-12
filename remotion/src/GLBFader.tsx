/**
 * GLBFader — Renders 0-2 ThreeDBackground instances with crossfade opacity.
 *
 * Thin wrapper that resolves which GLB scenes are active at the current frame
 * and passes through all config fields to ThreeDBackground.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { ThreeDBackground, type GraphCamera } from "./ThreeDBackground";
import { resolveActiveFaderScenes, type FaderSceneBounds } from "./fader";
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
          custom={scene.config.custom}
          useStandardAnimation={scene.config.useStandardAnimation}
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
