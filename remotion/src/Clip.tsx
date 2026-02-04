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

  // Text reveal animation - delayed slightly so video is visible first
  const textOpacity = interpolate(frame, [4, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const textSlide = interpolate(frame, [4, 12], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Progress indicator
  const progress = index / total;

  // Calculate video start frame from seconds
  const videoStartFrame = Math.floor((startSec || 0) * fps);

  // Resolve video path - use staticFile for relative paths (served from public/)
  // For absolute paths, extract the relative path after the project root
  const getVideoUrl = (src: string | undefined) => {
    if (!src) return undefined;

    // If it's an absolute path, try to extract relative path
    if (src.startsWith("/")) {
      // Look for episodes/ in the path and use that as relative
      const episodesMatch = src.match(/episodes\/[^/]+\.mp4$/);
      if (episodesMatch) {
        return staticFile(episodesMatch[0]);
      }
      return undefined;
    }

    // Already relative path (e.g., "episodes/video.mp4")
    return staticFile(src);
  };

  const videoUrl = getVideoUrl(videoSrc);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        transform: `scale(${entryScale})`,
      }}
    >
      {/* Video background - FULL visibility */}
      {videoUrl && (
        <AbsoluteFill>
          <OffthreadVideo
            src={videoUrl}
            startFrom={videoStartFrame}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </AbsoluteFill>
      )}

      {/* Fallback gradient when no video */}
      {!videoSrc && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`,
          }}
        />
      )}

      {/* Bottom gradient for text readability */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, transparent 70%)`,
        }}
      />

      {/* Actor indicator - top left */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 50,
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: textOpacity,
        }}
      >
        <div
          style={{
            width: 6,
            height: 36,
            backgroundColor: actorColor,
            borderRadius: 3,
            boxShadow: `0 0 10px ${actorColor}`,
          }}
        />
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: actorColor,
            letterSpacing: "2px",
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          {actorName}
        </span>
      </div>

      {/* Main quote text - larger, more prominent */}
      <div
        style={{
          position: "absolute",
          left: 50,
          right: 50,
          bottom: 140,
          transform: `translateY(${textSlide}px)`,
          opacity: textOpacity,
        }}
      >
        <p
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.15,
            margin: 0,
            textShadow: "0 4px 20px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)",
            maxWidth: 1600,
          }}
        >
          "{text}"
        </p>
      </div>

      {/* Progress bar - bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: 50,
          right: 50,
          height: 4,
          backgroundColor: "rgba(255,255,255,0.15)",
          borderRadius: 2,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            backgroundColor: actorColor,
            borderRadius: 2,
            boxShadow: `0 0 8px ${actorColor}`,
          }}
        />
      </div>

      {/* Clip counter */}
      <div
        style={{
          position: "absolute",
          bottom: 70,
          right: 50,
          fontSize: 16,
          color: "rgba(255,255,255,0.5)",
          fontWeight: 600,
          opacity: textOpacity,
          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
        }}
      >
        {index}/{total}
      </div>

      {/* Animated accent line under text */}
      <div
        style={{
          position: "absolute",
          left: 50,
          bottom: 125,
          width: interpolate(frame, [6, 14], [0, 80], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          height: 3,
          backgroundColor: actorColor,
          boxShadow: `0 0 10px ${actorColor}`,
        }}
      />
    </AbsoluteFill>
  );
};
