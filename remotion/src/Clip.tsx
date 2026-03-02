import React from "react";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
  OffthreadVideo,
  Easing,
  spring,
  Img,
} from "remotion";
import { resolveAsset } from "./resolveAsset";

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
  /** Base directory for character thumbnail PNGs. */
  thumbnailDir?: string;
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

const ACTOR_FOLDERS: Record<string, { folder: string, count: number }> = {
  eliza: { folder: "eliza", count: 17 },
  marc: { folder: "marc", count: 15 },
  peepo: { folder: "peepo", count: 10 },
  danger_man: { folder: "shaw", count: 15 },
  shaw: { folder: "shaw", count: 15 },
  sparty: { folder: "spartan", count: 15 },
  spartan: { folder: "spartan", count: 15 },
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
  thumbnailDir,
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

  // Entry animation - massive quick punch
  const entryProgress = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const entryScale = 1.15 - 0.15 * Easing.bezier(0.1, 1, 0, 1)(entryProgress);

  // Yelling detection: if too many words are ALL CAPS, it's just the character's style
  const totalWords = words ? words.length : 0;
  const capsCount = words ? words.filter((w) => {
    const s = w.word.replace(/[^a-zA-Z]/g, "");
    return s.length >= 2 && s === s.toUpperCase();
  }).length : 0;
  const isYelling = totalWords > 0 && capsCount / totalWords > 0.4;

  // Find start frames of SINGLE CAPS words to ensure we only shake the screen for isolated hits
  const capsGroupStarts: number[] = [];
  if (words && !isYelling) {
    let i = 0;
    while (i < words.length) {
      const stripped = words[i].word.replace(/[^a-zA-Z]/g, "");
      if (stripped.length >= 2 && stripped === stripped.toUpperCase()) {
        const startSec = words[i].start;
        let groupLength = 1;
        while (i + 1 < words.length) {
          const nextStripped = words[i + 1].word.replace(/[^a-zA-Z]/g, "");
          if (nextStripped.length >= 2 && nextStripped === nextStripped.toUpperCase()) {
            i++;
            groupLength++;
          } else break;
        }
        // Only shake camera for single isolated ALL-CAPS words
        if (groupLength === 1) {
          capsGroupStarts.push(startSec);
        }
      }
      i++;
    }
  }

  // Audio-reactive pulse only at the START of an ALL-CAPS group
  let pulseIntensity = 0;
  if (!isYelling) {
    const clipStartSec = startSec || 0;
    for (const groupStartSec of capsGroupStarts) {
      const groupStartFrame = (groupStartSec - clipStartSec) * fps;
      if (frame >= groupStartFrame && frame < groupStartFrame + 6) {
         pulseIntensity = Math.max(pulseIntensity, 1 - (frame - groupStartFrame) / 6);
      }
    }
  }

  // Continuous handheld camera drift (dampened)
  const driftX = Math.sin(frame / 20) * 4 + Math.cos(frame / 35) * 2;
  const driftY = Math.cos(frame / 25) * 4 + Math.sin(frame / 40) * 2;

  // Dampened audio-reactive shake (ultra subtle)
  const pulseShakeX = (random(`bg-px-${frame}`) - 0.5) * 2 * pulseIntensity * 1.0;
  const pulseShakeY = (random(`bg-py-${frame}`) - 0.5) * 2 * pulseIntensity * 0.75;

  // Combine parallax, drift, and pulse
  const finalTx = driftX + pulseShakeX;
  const finalTy = driftY + pulseShakeY;

  // Parallax: text scales 150% faster than video from center — closer = faster
  // Scale starts slightly larger to hide edges during drift/shake
  const videoParallax = interpolate(frame, [0, durationInFrames], [1.05, 1.11], {
    extrapolateRight: "clamp",
  });
  const finalVideoScale = videoParallax + pulseIntensity * 0.08;

  // Static subtitles (no parallax)
  const textParallax = 1;

  // Text reveal animation - delayed slightly so video is visible first
  const textOpacity = interpolate(frame, [4, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const textSlide = interpolate(frame, [4, 12], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Progress indicator with spring physics
  const prevProgress = (index - 1) / total;
  const targetProgress = index / total;
  const springProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.5 },
  });
  const progress = interpolate(springProgress, [0, 1], [prevProgress, targetProgress]);

  // Calculate video start frame from seconds
  const videoStartFrame = Math.floor((startSec || 0) * fps);

  // Resolve video path - use proxy in studio, full-res when rendering
  const isRendering = getRemotionEnvironment().isRendering;

  const resolveVideoPath = (src: string | undefined) => {
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
    return relativePath;
  };

  const basePath = resolveVideoPath(videoSrc);
  const proxyPath = basePath?.replace(/\.mp4$/, "_proxy.mp4");

  // In studio: try proxy first, fall back to full-res. When rendering: always full-res.
  const [useProxy, setUseProxy] = React.useState(!isRendering);
  const videoUrl = basePath
    ? resolveAsset(useProxy && proxyPath ? proxyPath : basePath)
    : undefined;

  // Swaggy Thumbnail logic
  const actorFolderInfo = ACTOR_FOLDERS[actor.toLowerCase()];
  
  // Calculate how many hits have occurred so far to drive the thumbnail swap
  let hitCount = 0;
  let timeSinceLastHit = 9999;
  if (!isYelling) {
    const clipStartSec = startSec || 0;
    for (const groupStartSec of capsGroupStarts) {
      const groupStartFrame = (groupStartSec - clipStartSec) * fps;
      if (frame >= groupStartFrame) {
         hitCount++;
         timeSinceLastHit = frame - groupStartFrame;
      }
    }
  }

  // Determine which image to show based on the clip index + hit count so it's deterministic but changes every hit
  let currentImageIndex = 1;
  let showThumbnail = false;
  let thumbUrl = "";
  if (actorFolderInfo && thumbnailDir) {
    showThumbnail = true;
    // Randomize the starting image based on the clip index so every clip starts different
    const seedOffset = Math.floor(random(`thumb-start-${index}`) * actorFolderInfo.count);
    currentImageIndex = ((seedOffset + hitCount) % actorFolderInfo.count) + 1;
    const thumbPath = `${actorFolderInfo.folder}/${currentImageIndex}.png`;
    // Absolute thumbnailDir (headless) vs relative (Studio)
    if (thumbnailDir.startsWith("/") || /^[A-Z]:/i.test(thumbnailDir)) {
      thumbUrl = `${thumbnailDir}/${thumbPath}`;
    } else {
      thumbUrl = resolveAsset(`${thumbnailDir}/${thumbPath}`);
    }
  }

  // TikTok-style text chunking: group words into small phrases (max 4 words or until punctuation)
  const wordsWithChunks = React.useMemo(() => {
    if (!words) return [];
    let currentChunkIdx = 0;
    let wordsInCurrentChunk = 0;
    return words.map((w, idx) => {
      const hasPunctuation = /[.,?!]/.test(w.word);
      const result = { ...w, chunkIndex: currentChunkIdx, originalIndex: idx };
      wordsInCurrentChunk++;
      if (wordsInCurrentChunk >= 4 || hasPunctuation) {
        currentChunkIdx++;
        wordsInCurrentChunk = 0;
      }
      return result;
    });
  }, [words]);

  let activeChunk = 0;
  if (wordsWithChunks.length > 0) {
    const clipStartSec = startSec || 0;
    let currentWord = wordsWithChunks[0];
    for (const w of wordsWithChunks) {
      if (frame >= (w.start - clipStartSec) * fps) {
        currentWord = w;
      } else {
        break;
      }
    }
    activeChunk = currentWord.chunkIndex;
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        transform: `scale(${entryScale})`,
      }}
    >
      {/* Video background — slow zoom, handheld drift, and audio pulses */}
      {videoUrl && (
        <AbsoluteFill style={{ 
          transform: `translate(${finalTx}px, ${finalTy}px) scale(${finalVideoScale})`, 
          overflow: "hidden",
          transformOrigin: "center center"
        }}>
          <OffthreadVideo
            src={videoUrl}
            startFrom={videoStartFrame}
            volume={volume}
            onError={() => {
              if (useProxy) setUseProxy(false);
            }}
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
            transform: `translate(${finalTx}px, ${finalTy}px) scale(${finalVideoScale})`,
            transformOrigin: "center center"
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
        if (!words || isYelling) return null;

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
            // Only stamp single ALL-CAPS words — no phrases
            if (parts.length === 1) {
              capsGroups.push({
                text: parts.join(" "),
                startFrame: (words[groupStart].start - clipStartSec) * fps,
                idx: groupStart,
              });
            }
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

          // Slam in: scale 3.5→1 in 4 frames with dopamine whip
          const slamT = Easing.bezier(0.1, 1, 0, 1)(Math.min(1, localFrame / 4));
          const stampScale = 1 + (1 - slamT) * 2.5;

          // Fade out in last 6 frames
          const fadeStart = STAMP_LIFE - 6;
          const stampOpacity =
            localFrame >= fadeStart
              ? 1 - (localFrame - fadeStart) / 6
              : Math.min(1, localFrame / 1);

          // Glitch phase: first 10 frames — hard RGB split, violent jitter, blackouts
          const GLITCH_FRAMES = 10;
          const inGlitch = localFrame < GLITCH_FRAMES;
          const glitchT = inGlitch ? 1 - localFrame / GLITCH_FRAMES : 0;

          let sx = 0;
          let sy = 0;
          if (inGlitch) {
            sx = (random(`stmp-sx-${group.idx}-${frame}`) - 0.5) * 2 * glitchT * 30;
            sy = (random(`stmp-sy-${group.idx}-${frame}`) - 0.5) * 2 * glitchT * 18;
          }

          // RGB split — big offset
          const rgbOff = inGlitch ? Math.round(glitchT * 25) : 0;

          // Hard flicker — full blackouts during glitch
          const flickerOp = inGlitch
            ? stampOpacity * (random(`stmp-fl-${group.idx}-${frame}`) > 0.3 ? 1 : 0)
            : stampOpacity;

          // Horizontal slice — massive displacement
          const sliceX = inGlitch
            ? (random(`stmp-sl-${group.idx}-${frame}`) - 0.5) * 2 * glitchT * 50
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
                    opacity: glitchT * 0.9,
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
                    opacity: glitchT * 0.9,
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

      {/* Swaggy Thumbnail — character portrait that glitches on hits */}
      {showThumbnail && (
        <div
          style={{
            position: "absolute",
            left: 20,
            bottom: 30, // anchored to bottom left
            width: 320,
            height: 600,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-start",
            opacity: textOpacity,
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <Img
            src={thumbUrl}
            style={{
              maxHeight: "100%",
              maxWidth: "100%",
              objectFit: "contain",
              transformOrigin: "bottom left",
              transform: (() => {
                const isHitAnim = timeSinceLastHit < 8;
                const hitAnimProgress = isHitAnim ? timeSinceLastHit / 8 : 1;
                const hitScale = isHitAnim ? 1.15 - 0.15 * Easing.bezier(0.1, 1, 0, 1)(hitAnimProgress) : 1;
                const hitRot = isHitAnim ? (random(`thumb-rot-${hitCount}`) - 0.5) * 6 * (1 - hitAnimProgress) : 0;
                return `scale(${hitScale}) rotate(${hitRot}deg)`;
              })(),
              filter: (() => {
                const isHitAnim = timeSinceLastHit < 8;
                const hitAnimProgress = isHitAnim ? timeSinceLastHit / 8 : 1;
                const brightness = isHitAnim ? 1 + (1 - hitAnimProgress) * 0.8 : 1;
                return `brightness(${brightness}) drop-shadow(0px 0px 20px ${actorColor}80)`;
              })(),
            }}
          />
        </div>
      )}

      {/* Main quote text — TikTok style word chunks synced to speech */}
      <div
        style={{
          position: "absolute",
          left: showThumbnail ? 360 : 80,
          right: showThumbnail ? 80 : 50,
          bottom: 140,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
          transform: `translateY(${textSlide}px) scale(${textParallax})`,
          transformOrigin: "center center",
          opacity: textOpacity,
        }}
      >
        <p
          style={{
            fontSize: 84, // Slightly bigger text for CapCut style
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.15,
            margin: 0,
            textShadow: "0 4px 20px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)",
            textAlign: "center",
            width: "100%",
          }}
        >
          {wordsWithChunks && wordsWithChunks.length > 0
            ? wordsWithChunks.map((w) => {
                if (w.chunkIndex !== activeChunk) return null;
                const idx = w.originalIndex;
                
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
                  !isYelling &&
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

                    // Scale: massive punch 2.5→1 over settle with snap curve
                    const scaleProgress = Math.min(1, framesSinceStart / SETTLE_FRAMES);
                    const scaleT = Easing.bezier(0.1, 1, 0, 1)(scaleProgress);
                    wordScale = 1 + (1 - scaleT) * 1.5;

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
                      {idx < wordsWithChunks.length - 1 ? "\u00A0" : ""}
                    </span>
                  );
                }

                // --- Normal word: hype dopamine reveal ---
                const revealProgress = isUnseen ? 0 : Math.min(1, framesSinceStart / 6);
                const revealT = Easing.bezier(0.1, 1, 0, 1)(revealProgress);
                const wordScale = 1 + (1 - revealT) * 0.8;

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
                    {idx < wordsWithChunks.length - 1 ? "\u00A0" : ""}
                  </span>
                );
              })
            : text}
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
