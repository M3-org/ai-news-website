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
      {activeScenes.map((scene) => (
        <ThreeDBackground
          key={scene.sceneKey}
          glbFile={scene.config.glbFile}
          opacity={scene.computedOpacity}
          sceneScale={scene.config.sceneScale}
          sceneOffset={[scene.config.sceneOffsetX, scene.config.sceneOffsetY, scene.config.sceneOffsetZ]}
          cameraYOffset={scene.config.cameraYOffset}
          custom={scene.config.custom}
          useStandardAnimation={scene.config.useStandardAnimation}
          animationLoop={scene.config.animationLoop}
          startFrame={scene.sceneFrom + scene.config.startFrame}
          rimGlow={scene.config.rimGlow}
          rimColor={scene.config.rimColor}
          rimIntensity={scene.config.rimIntensity}
          rimPower={scene.config.rimPower}
          effectorInnerRadius={scene.config.effectorInnerRadius}
          effectorOuterRadius={scene.config.effectorOuterRadius}
          effectorStrength={scene.config.effectorStrength}
          rotationAxis={scene.config.rotationAxis}
          graphCamera={graphCamera}
          graphCameraCenter={graphCameraCenter}
        />
      ))}
    </>
  );
};
