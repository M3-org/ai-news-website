import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  OffthreadVideo,
  staticFile,
} from "remotion";

interface ClipProps {
  text: string;
  actor: string;
  index: number;
  total: number;
  videoSrc?: string;
  startSec?: number;
}

// Actor color mapping
const ACTOR_COLORS: Record<string, string> = {
  eliza: "#8B5CF6", // Purple
  jin: "#F59E0B", // Orange
  hk47: "#EF4444", // Red
  sparty: "#10B981", // Green
  marc: "#3B82F6", // Blue
  peepo: "#84CC16", // Lime
  danger_man: "#F97316", // Orange red
  default: "#6B7280", // Gray
};

const getActorColor = (actor: string): string => {
  return ACTOR_COLORS[actor.toLowerCase()] || ACTOR_COLORS.default;
};

const formatActorName = (actor: string): string => {
  // Convert actor IDs to display names
  const names: Record<string, string> = {
    eliza: "ELIZA",
    jin: "JIN",
    hk47: "HK-47",
    sparty: "SPARTY",
    marc: "MARC",
    peepo: "PEEPO",
    danger_man: "DANGER MAN",
  };
  return names[actor.toLowerCase()] || actor.toUpperCase();
};

export const Clip: React.FC<ClipProps> = ({
  text,
  actor,
  index,
  total,
  videoSrc,
  startSec,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const actorColor = getActorColor(actor);
  const actorName = formatActorName(actor);

  // Entry animation - quick punch
  const entryScale = interpolate(frame, [0, 4], [1.05, 1], {
    extrapolateRight: "clamp",
  });

  // Text reveal animation
  const textOpacity = interpolate(frame, [2, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const textSlide = interpolate(frame, [2, 8], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Progress indicator
  const progress = index / total;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, #0a0a0a 0%, #151520 100%)`,
        transform: `scale(${entryScale})`,
      }}
    >
      {/* Video background (if provided) */}
      {videoSrc && (
        <AbsoluteFill style={{ opacity: 0.3 }}>
          <OffthreadVideo
            src={staticFile(videoSrc)}
            startFrom={Math.floor((startSec || 0) * fps)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </AbsoluteFill>
      )}

      {/* Gradient overlay */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.7) 100%)`,
        }}
      />

      {/* Actor indicator - top left */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 60,
          display: "flex",
          alignItems: "center",
          gap: 15,
          opacity: textOpacity,
        }}
      >
        <div
          style={{
            width: 8,
            height: 40,
            backgroundColor: actorColor,
            borderRadius: 4,
          }}
        />
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: actorColor,
            letterSpacing: "3px",
          }}
        >
          {actorName}
        </span>
      </div>

      {/* Main quote text */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          bottom: 180,
          transform: `translateY(${textSlide}px)`,
          opacity: textOpacity,
        }}
      >
        <p
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.2,
            margin: 0,
            textShadow: "0 4px 20px rgba(0,0,0,0.8)",
            maxWidth: 1400,
          }}
        >
          "{text}"
        </p>
      </div>

      {/* Progress bar - bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 60,
          right: 60,
          height: 4,
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: 2,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            backgroundColor: actorColor,
            borderRadius: 2,
            transition: "width 0.1s ease-out",
          }}
        />
      </div>

      {/* Clip counter */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          right: 60,
          fontSize: 18,
          color: "rgba(255,255,255,0.4)",
          fontWeight: 500,
          opacity: textOpacity,
        }}
      >
        {index}/{total}
      </div>

      {/* Animated accent line */}
      <div
        style={{
          position: "absolute",
          left: 60,
          bottom: 160,
          width: interpolate(frame, [4, 12], [0, 100], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          height: 3,
          backgroundColor: actorColor,
        }}
      />
    </AbsoluteFill>
  );
};
