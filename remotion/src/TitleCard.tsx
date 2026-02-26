import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeDBackground } from "./ThreeDBackground";
import type { ModulationProps } from "./Trailer";

interface TitleCardProps {
  title: string;
  subtitle?: string;
  modulation?: ModulationProps;
}

export const TitleCard: React.FC<TitleCardProps> = ({ title, subtitle, modulation }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Animation timing
  const fadeIn = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.3, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
    }
  );

  const opacity = Math.min(fadeIn, fadeOut);

  // Slide up animation
  const translateY = interpolate(frame, [0, fps * 0.5], [30, 0], {
    extrapolateRight: "clamp",
  });

  // Scale punch on entry
  const scale = interpolate(frame, [0, fps * 0.2], [1.1, 1], {
    extrapolateRight: "clamp",
  });

  // Glowing pulse effect
  const glowIntensity = interpolate(
    frame,
    [0, fps * 0.5, fps * 1, fps * 1.5],
    [0, 20, 10, 20],
    {
      extrapolateRight: "extend",
    }
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      {/* 3D animated background */}
      <ThreeDBackground
        glbFile={modulation?.glbFile}
        effectMap={modulation?.effectMap as any}
        effectorInnerRadius={modulation?.effectorInnerRadius}
        effectorOuterRadius={modulation?.effectorOuterRadius}
        effectorStrength={modulation?.effectorStrength}
        rotationAxis={modulation?.rotationAxis}
        fisheyeStrength={modulation?.fisheyeStrength}
        fisheyeAudioMod={modulation?.fisheyeAudioMod}
        fisheyeZoom={modulation?.fisheyeZoom}
        audioFile={modulation?.audioFile}
        audioShakeIntensity={modulation?.audioShakeIntensity}
        audioShakeBass={modulation?.audioShakeBass}
        opacity={modulation?.opacity ?? 1}
      />

      {/* Intro boot sound */}
      <Audio src={staticFile("introBoot.mp3")} />

      {/* Dark overlay for text readability */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Main title */}
      <div
        style={{
          transform: `translateY(${translateY}px) scale(${scale})`,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: 90,
            fontWeight: 800,
            color: "#fff",
            margin: 0,
            letterSpacing: "-2px",
            textShadow: `0 0 ${glowIntensity}px rgba(255, 100, 100, 0.8), 0 0 ${glowIntensity * 2}px rgba(255, 100, 100, 0.4)`,
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            style={{
              fontSize: 28,
              color: "#888",
              marginTop: 20,
              letterSpacing: "4px",
              textTransform: "uppercase",
              opacity: interpolate(frame, [fps * 0.4, fps * 0.7], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Animated lines */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          display: "flex",
          gap: 10,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              width: 40,
              height: 4,
              backgroundColor: "#ff6464",
              opacity: interpolate(
                frame,
                [fps * 0.5 + i * 3, fps * 0.7 + i * 3],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              ),
              transform: `scaleX(${interpolate(
                frame,
                [fps * 0.5 + i * 3, fps * 0.7 + i * 3],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              )})`,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
