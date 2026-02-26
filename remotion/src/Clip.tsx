import React from "react";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
  OffthreadVideo,
  staticFile,
} from "remotion";

interface WordData {
  word: string;
  start: number; // absolute seconds in the source video
  end: number;
}

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
  /** Per-word timing data for Max Payne 3 style reveal. */
  words?: WordData[];
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
  words,
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

      {/* Floating CAPS stamps — consecutive CAPS words grouped as one phrase */}
      {(() => {
        if (!words) return null;
        // Yelling detection: if too many words are ALL CAPS, it's just
        // the character's style — skip stamps so the screen isn't chaos
        const totalWords = words.length;
        const capsCount = words.filter((w) => {
          const s = w.word.replace(/[^a-zA-Z]/g, "");
          return s.length >= 2 && s === s.toUpperCase();
        }).length;
        if (totalWords > 0 && capsCount / totalWords > 0.4) return null;

        // Group consecutive ALL CAPS words into phrases
        const capsGroups: { text: string; startFrame: number; idx: number }[] = [];
        const clipStartSec = startSec || 0;
        let i = 0;
        while (i < words.length) {
          const stripped = words[i].word.replace(/[^a-zA-Z]/g, "");
          const isCaps = stripped.length >= 2 && stripped === stripped.toUpperCase();
          if (isCaps) {
            const groupStart = i;
            const parts: string[] = [stripped];
            // Gather consecutive CAPS
            while (i + 1 < words.length) {
              const nextStripped = words[i + 1].word.replace(/[^a-zA-Z]/g, "");
              if (nextStripped.length >= 2 && nextStripped === nextStripped.toUpperCase()) {
                i++;
                parts.push(nextStripped);
              } else break;
            }
            capsGroups.push({
              text: parts.join(" "),
              startFrame: (words[groupStart].start - clipStartSec) * fps,
              idx: groupStart,
            });
          }
          i++;
        }

        const STAMP_LIFE = 24; // stay longer — ~0.8s at 30fps
        return capsGroups.map((group) => {
          const localFrame = frame - group.startFrame;
          if (localFrame < 0 || localFrame > STAMP_LIFE) return null;

          // Deterministic random position — upper 60% of screen, avoid edges
          const px = random(`stamp-x-${group.idx}`) * 0.6 + 0.15;
          const py = random(`stamp-y-${group.idx}`) * 0.4 + 0.08;
          const rot = (random(`stamp-r-${group.idx}`) - 0.5) * 4;
          const stampSize = 80 + random(`stamp-s-${group.idx}`) * 50;

          // Slam in: scale 1.5→1 in 2 frames
          const slamT = Math.min(1, localFrame / 2);
          const stampScale = 1 + (1 - slamT) * 0.5;

          // Fade out in last 6 frames
          const fadeStart = STAMP_LIFE - 6;
          const stampOpacity =
            localFrame >= fadeStart
              ? 1 - (localFrame - fadeStart) / 6
              : Math.min(1, localFrame / 1);

          // Glitch phase: first 6 frames — RGB split, jitter, flicker
          const GLITCH_FRAMES = 6;
          const inGlitch = localFrame < GLITCH_FRAMES;
          const glitchT = inGlitch ? 1 - localFrame / GLITCH_FRAMES : 0;

          // Shake — stronger during glitch, subtle after
          let sx = 0;
          let sy = 0;
          if (inGlitch) {
            sx = (random(`stmp-sx-${group.idx}-${frame}`) - 0.5) * 2 * glitchT * 14;
            sy = (random(`stmp-sy-${group.idx}-${frame}`) - 0.5) * 2 * glitchT * 8;
          }

          // RGB split offsets — decay with glitch
          const rgbOff = inGlitch ? Math.round(glitchT * 10) : 0;

          // Random opacity flicker during glitch
          const flickerOp = inGlitch
            ? stampOpacity * (0.7 + random(`stmp-fl-${group.idx}-${frame}`) * 0.3)
            : stampOpacity;

          // Horizontal slice offset — random per-frame displacement
          const sliceX = inGlitch
            ? (random(`stmp-sl-${group.idx}-${frame}`) - 0.5) * 2 * glitchT * 20
            : 0;

          // Break long phrases: max 2 words per line
          const phraseWords = group.text.split(" ");
          const lines: string[] = [];
          for (let li = 0; li < phraseWords.length; li += 2) {
            lines.push(phraseWords.slice(li, li + 2).join(" "));
          }
          const stampContent = lines.map((line, li) => (
            <React.Fragment key={li}>
              {line}
              {li < lines.length - 1 && <br />}
            </React.Fragment>
          ));

          const baseStyle: React.CSSProperties = {
            position: "absolute",
            left: `${px * 100}%`,
            top: `${py * 100}%`,
            fontSize: stampSize,
            fontWeight: 900,
            fontStyle: "italic",
            letterSpacing: "4px",
            pointerEvents: "none",
            textAlign: "center",
            lineHeight: 1.05,
          };

          return (
            <React.Fragment key={`stamp-${group.idx}`}>
              {/* Cyan ghost — offset left */}
              {rgbOff > 0 && (
                <div
                  style={{
                    ...baseStyle,
                    color: "cyan",
                    opacity: glitchT * 0.5,
                    transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${stampScale}) translate(${sx - rgbOff + sliceX}px, ${sy}px)`,
                    mixBlendMode: "screen",
                  }}
                >
                  {stampContent}
                </div>
              )}
              {/* Magenta ghost — offset right */}
              {rgbOff > 0 && (
                <div
                  style={{
                    ...baseStyle,
                    color: "magenta",
                    opacity: glitchT * 0.5,
                    transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${stampScale}) translate(${sx + rgbOff + sliceX}px, ${sy}px)`,
                    mixBlendMode: "screen",
                  }}
                >
                  {stampContent}
                </div>
              )}
              {/* Main white text */}
              <div
                style={{
                  ...baseStyle,
                  color: "#fff",
                  opacity: flickerOp,
                  transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${stampScale}) translate(${sx + sliceX}px, ${sy}px)`,
                  textShadow: `0 4px 30px rgba(0,0,0,0.9), 0 0 20px ${actorColor}40`,
                }}
              >
                {stampContent}
              </div>
            </React.Fragment>
          );
        });
      })()}

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

      {/* Main quote text — word-by-word reveal synced to speech */}
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
          "
          {words && words.length > 0
            ? words.map((w, idx) => {
                // Convert absolute word time to clip-local frame
                const clipStartSec = startSec || 0;
                const wordStartFrame = (w.start - clipStartSec) * fps;
                const wordEndFrame = (w.end - clipStartSec) * fps;

                // Word states: unseen → speaking → spoken
                const isSpeaking =
                  frame >= wordStartFrame && frame < wordEndFrame;
                const isUnseen = frame < wordStartFrame;
                const framesSinceStart = frame - wordStartFrame;

                // Detect ALL CAPS words (strip punctuation for check)
                const stripped = w.word.replace(/[^a-zA-Z]/g, "");
                const isCaps =
                  stripped.length >= 2 &&
                  stripped === stripped.toUpperCase();

                // --- CAPS WORD: flash + micro shake ---
                if (isCaps) {
                  const FLASH_FRAMES = 3;
                  const SHAKE_FRAMES = 6;
                  const SETTLE_FRAMES = 5;

                  let wordOpacity: number;
                  let wordColor: string;
                  let wordScale: number;
                  let shakeX = 0;
                  let shakeY = 0;
                  let textShadowExtra = "";

                  if (isUnseen) {
                    wordOpacity = 0;
                    wordColor = "#fff";
                    wordScale = 1;
                  } else {
                    wordOpacity = 1;

                    // Flash: bright white burst that fades to actor color
                    const flashT = Math.min(1, framesSinceStart / FLASH_FRAMES);
                    const flashBrightness = 1 - flashT;
                    wordColor = flashT < 1
                      ? `color-mix(in srgb, #fff ${Math.round(flashBrightness * 100)}%, ${actorColor})`
                      : isSpeaking
                        ? actorColor
                        : `color-mix(in srgb, ${actorColor} ${Math.round(Math.max(0, 1 - (framesSinceStart - (wordEndFrame - wordStartFrame)) / 10) * 100)}%, #fff)`;

                    // Glow on flash
                    if (flashT < 1) {
                      textShadowExtra = `, 0 0 ${20 + flashBrightness * 40}px ${actorColor}, 0 0 ${10 + flashBrightness * 20}px #fff`;
                    }

                    // Scale: big punch 1.3→1 over settle
                    const scaleT = Math.min(1, framesSinceStart / SETTLE_FRAMES);
                    wordScale = 1 + (1 - scaleT) * 0.3;

                    // Micro shake: random jitter that decays
                    if (framesSinceStart < SHAKE_FRAMES) {
                      const shakeIntensity = 1 - framesSinceStart / SHAKE_FRAMES;
                      shakeX = (random(`caps-sx-${idx}-${frame}`) - 0.5) * 2 * shakeIntensity * 6;
                      shakeY = (random(`caps-sy-${idx}-${frame}`) - 0.5) * 2 * shakeIntensity * 4;
                    }
                  }

                  return (
                    <span
                      key={idx}
                      style={{
                        display: "inline-block",
                        opacity: wordOpacity,
                        color: wordColor,
                        transform: `scale(${wordScale}) translate(${shakeX}px, ${shakeY}px)`,
                        transformOrigin: "center bottom",
                        textShadow: `0 4px 20px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)${textShadowExtra}`,
                      }}
                    >
                      {w.word}
                      {idx < words.length - 1 ? "\u00A0" : ""}
                    </span>
                  );
                }

                // --- Normal word: simple reveal ---
                const revealT = isUnseen
                  ? 0
                  : Math.min(1, framesSinceStart / 4);
                const wordScale = 1 + (1 - revealT) * 0.15;

                let wordOpacity: number;
                let wordColor: string;
                if (isUnseen) {
                  wordOpacity = 0;
                  wordColor = "rgba(255,255,255,0.3)";
                } else if (isSpeaking) {
                  wordOpacity = 1;
                  wordColor = actorColor;
                } else {
                  const fadeT = Math.min(
                    1,
                    (frame - wordEndFrame) / 10,
                  );
                  wordOpacity = 1;
                  wordColor = `color-mix(in srgb, ${actorColor} ${Math.round((1 - fadeT) * 100)}%, #fff)`;
                }

                return (
                  <span
                    key={idx}
                    style={{
                      display: "inline-block",
                      opacity: wordOpacity,
                      color: wordColor,
                      transform: revealT < 1
                        ? `scale(${wordScale})`
                        : undefined,
                      transformOrigin: "center bottom",
                    }}
                  >
                    {w.word}
                    {idx < words.length - 1 ? "\u00A0" : ""}
                  </span>
                );
              })
            : text}
          "
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
