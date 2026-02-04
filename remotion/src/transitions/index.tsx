import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  random,
} from "remotion";

// ============================================================================
// Flash Transition
// ============================================================================

interface FlashProps {
  color: "white" | "black";
  durationInFrames: number;
}

export const Flash: React.FC<FlashProps> = ({ color, durationInFrames }) => {
  const frame = useCurrentFrame();

  // Quick flash in and out
  const opacity = interpolate(
    frame,
    [0, durationInFrames * 0.3, durationInFrames],
    [1, 1, 0],
    {
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: color,
        opacity,
        zIndex: 100,
      }}
    />
  );
};

// ============================================================================
// Zoom Punch Transition
// ============================================================================

interface ZoomPunchProps {
  durationInFrames: number;
}

export const ZoomPunch: React.FC<ZoomPunchProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();

  // Scale punch effect
  const scale = interpolate(frame, [0, durationInFrames], [1.3, 1], {
    extrapolateRight: "clamp",
  });

  // Brightness flash
  const brightness = interpolate(
    frame,
    [0, durationInFrames * 0.3, durationInFrames],
    [2, 1.5, 1],
    {
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "white",
        opacity: interpolate(frame, [0, durationInFrames * 0.5], [0.8, 0], {
          extrapolateRight: "clamp",
        }),
        zIndex: 100,
      }}
    />
  );
};

// ============================================================================
// Glitch Transition
// ============================================================================

interface GlitchProps {
  durationInFrames: number;
}

export const Glitch: React.FC<GlitchProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();

  // Generate glitch bars
  const glitchBars = Array.from({ length: 8 }, (_, i) => {
    const seed = `glitch-${i}-${frame}`;
    const y = random(seed + "-y") * 100;
    const height = random(seed + "-h") * 30 + 5;
    const offset = (random(seed + "-x") - 0.5) * 40;
    const isVisible = random(seed + "-v") > 0.3;

    return {
      y: `${y}%`,
      height: `${height}px`,
      left: `${offset}%`,
      visible: isVisible && frame < durationInFrames * 0.7,
    };
  });

  // Overall opacity
  const opacity = interpolate(
    frame,
    [0, durationInFrames * 0.5, durationInFrames],
    [1, 0.5, 0],
    {
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill
      style={{
        opacity,
        zIndex: 100,
        overflow: "hidden",
      }}
    >
      {/* Chromatic aberration effect */}
      <AbsoluteFill
        style={{
          backgroundColor: "cyan",
          opacity: 0.3,
          transform: `translateX(${interpolate(frame, [0, 3, 6], [-10, 5, 0])}px)`,
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: "magenta",
          opacity: 0.3,
          transform: `translateX(${interpolate(frame, [0, 3, 6], [10, -5, 0])}px)`,
          mixBlendMode: "screen",
        }}
      />

      {/* Glitch bars */}
      {glitchBars.map(
        (bar, i) =>
          bar.visible && (
            <div
              key={i}
              style={{
                position: "absolute",
                top: bar.y,
                left: bar.left,
                right: 0,
                height: bar.height,
                backgroundColor: `rgba(255, 255, 255, ${random(`bar-${i}-opacity`) * 0.5 + 0.3})`,
                transform: `translateX(${random(`bar-${i}-offset`) * 20}px)`,
              }}
            />
          )
      )}

      {/* Scan lines */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
          opacity: 0.5,
        }}
      />
    </AbsoluteFill>
  );
};

// Export all transitions
export { Flash, ZoomPunch, Glitch };
