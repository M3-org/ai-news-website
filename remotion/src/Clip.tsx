import React from "react";
import {
  AbsoluteFill,
  getRemotionEnvironment,
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
  /** Frames used for enter transition — audio fades in over this. */
  enterFrames?: number;
  /** Frames used for exit transition — audio fades out over this. */
  exitFrames?: number;
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
  enterFrames = 0,
  exitFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

  const inEnter = enterFrames > 0 && frame < enterFrames;
  // Trailer extends each clip by `exitFrames`, and next clip enters `exitFrames`
  // before nominal end. This frame is where overlap actually starts.
  const overlapStartFrame =
    exitFrames > 0
      ? Math.max(0, durationInFrames - exitFrames * 2)
      : durationInFrames;
  const inExit = exitFrames > 0 && frame >= overlapStartFrame;

  const enterProgress = inEnter ? clamp01(frame / enterFrames) : 1;
  const exitProgress = inExit
    ? clamp01((frame - overlapStartFrame) / exitFrames)
    : 0;

  // Force a true crossfade at clip level so overlap always blends visually.
  let videoOpacity = 1;
  if (inEnter) {
    videoOpacity = Math.min(videoOpacity, enterProgress);
  }
  if (inExit) {
    videoOpacity = Math.min(videoOpacity, 1 - exitProgress);
  }

  // Simple audio fade-in/out for cleaner handoffs.
  const AUDIO_FADE_IN_FRAMES = 4;
  // Slightly longer tail while keeping fade start anchored at overlapStartFrame.
  const AUDIO_FADE_OUT_FRAMES = 14;
  const exitAudioWindow =
    exitFrames > 0 ? Math.min(exitFrames, AUDIO_FADE_OUT_FRAMES) : 0;
  const enterAudioProgress = clamp01(frame / AUDIO_FADE_IN_FRAMES);
  const exitAudioProgress =
    inExit && exitAudioWindow > 0
      ? clamp01((frame - overlapStartFrame) / exitAudioWindow)
      : 0;

  let volume = 1;
  // Fast fade-in at clip start.
  volume *= enterAudioProgress;
  if (inExit && exitAudioWindow > 0) {
    volume *= 1 - exitAudioProgress;
  }

  const actorColor = getActorColor(actor);
  const actorName = formatActorName(actor);

  // Entry animation - quick punch
  const entryScale = interpolate(frame, [0, 4], [1.05, 1], {
    extrapolateRight: "clamp",
  });

  // Parallax: text scales 150% faster than video from center — closer = faster
  const videoParallax = interpolate(frame, [0, durationInFrames], [1, 1.06], {
    extrapolateRight: "clamp",
  });
  const textParallax = interpolate(frame, [0, durationInFrames], [1, 1.07], {
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

  // Resolve video path - use proxy in studio, full-res when rendering
  const isRendering = getRemotionEnvironment().isRendering;

  const getVideoUrl = (src: string | undefined) => {
    if (!src) return undefined;

    // Extract relative path from absolute paths
    let relativePath = src;
    if (src.startsWith("/")) {
      const episodesMatch = src.match(/episodes\/[^/]+\.mp4$/);
      if (episodesMatch) {
        relativePath = episodesMatch[0];
      } else {
        return undefined;
      }
    }

    // In studio: swap to proxy. When rendering: use full-res original.
    if (!isRendering) {
      relativePath = relativePath.replace(/\.mp4$/, "_proxy.mp4");
    }

    return staticFile(relativePath);
  };

  const videoUrl = getVideoUrl(videoSrc);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        transform: `scale(${entryScale})`,
      }}
    >
      {/* Video background — slow zoom for parallax depth */}
      {videoUrl && (
        <AbsoluteFill style={{ transform: `scale(${videoParallax})`, overflow: "hidden" }}>
          <OffthreadVideo
            src={videoUrl}
            startFrom={videoStartFrame}
            volume={volume}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: videoOpacity,
            }}
          />
        </AbsoluteFill>
      )}

      {/* Fallback gradient when no video */}
      {!videoUrl && (
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

      {/* Main quote text — scales from screen center, 150% faster than video */}
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 50,
          bottom: 140,
          transform: `translateY(${textSlide}px) scale(${textParallax})`,
          transformOrigin: "center center",
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
