import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface EndCardProps {
  text: string;
  subtext: string;
}

export const EndCard: React.FC<EndCardProps> = ({ text, subtext }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Fade in animation
  const fadeIn = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Scale animation - punch in
  const scale = interpolate(frame, [0, fps * 0.15], [1.3, 1], {
    extrapolateRight: "clamp",
  });

  // Logo animation
  const logoRotation = interpolate(frame, [0, fps * 0.3], [-5, 0], {
    extrapolateRight: "clamp",
  });

  // Subtext slide up
  const subtextY = interpolate(frame, [fps * 0.2, fps * 0.5], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subtextOpacity = interpolate(frame, [fps * 0.2, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeIn,
      }}
    >
      {/* Radial glow background */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 100, 100, 0.15) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Main content */}
      <div
        style={{
          transform: `scale(${scale}) rotate(${logoRotation}deg)`,
          textAlign: "center",
        }}
      >
        {/* Logo / Title */}
        <h1
          style={{
            fontSize: 120,
            fontWeight: 900,
            color: "#fff",
            margin: 0,
            letterSpacing: "-4px",
            textShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          {text}
        </h1>

        {/* Subtext */}
        <p
          style={{
            fontSize: 32,
            color: "#ff6464",
            marginTop: 30,
            fontWeight: 500,
            letterSpacing: "6px",
            textTransform: "uppercase",
            transform: `translateY(${subtextY}px)`,
            opacity: subtextOpacity,
          }}
        >
          {subtext}
        </p>
      </div>

      {/* Bottom accent line */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          width: interpolate(frame, [fps * 0.3, fps * 0.6], [0, 200], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          height: 4,
          backgroundColor: "#ff6464",
        }}
      />

      {/* Corner accents */}
      {[
        { top: 40, left: 40 },
        { top: 40, right: 40 },
        { bottom: 40, left: 40 },
        { bottom: 40, right: 40 },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            ...pos,
            width: 30,
            height: 30,
            borderColor: "#ff6464",
            borderStyle: "solid",
            borderWidth: 0,
            ...(pos.top !== undefined && pos.left !== undefined
              ? { borderTopWidth: 3, borderLeftWidth: 3 }
              : {}),
            ...(pos.top !== undefined && pos.right !== undefined
              ? { borderTopWidth: 3, borderRightWidth: 3 }
              : {}),
            ...(pos.bottom !== undefined && pos.left !== undefined
              ? { borderBottomWidth: 3, borderLeftWidth: 3 }
              : {}),
            ...(pos.bottom !== undefined && pos.right !== undefined
              ? { borderBottomWidth: 3, borderRightWidth: 3 }
              : {}),
            opacity: interpolate(frame, [fps * 0.4 + i * 3, fps * 0.6 + i * 3], [0, 0.6], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
