import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface TitleCardProps {
  title: string;
  subtitle?: string;
}

export const TitleCard: React.FC<TitleCardProps> = ({ title, subtitle }) => {
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
        background: "linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%)",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      {/* Background grid effect */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), " +
            "linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
          opacity: 0.5,
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
