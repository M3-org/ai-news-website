import React from "react";
import {
  AbsoluteFill,
  Easing,
  useCurrentFrame,
  useVideoConfig,
  random,
} from "remotion";

/**
 * Overlap duration per transition type (frames at 30fps).
 * This is how many frames the outgoing clip extends into the incoming clip.
 */
export const OVERLAP_FRAMES: Record<string, number> = {
  "hard-cut": 0,
  "flash-white": 8,
  "flash-black": 8,
  "zoom-punch": 10,
  "glitch": 12,
  "side-scroll-left": 14,
  "split": 28,
};

// ---------------------------------------------------------------------------
// Shake utility — deterministic per-frame random offset
// ---------------------------------------------------------------------------

function shake(
  frame: number,
  seed: string,
  intensity: number,
): { x: number; y: number } {
  const x = (random(seed + "-x-" + frame) - 0.5) * 2 * intensity * 18;
  const y = (random(seed + "-y-" + frame) - 0.5) * 2 * intensity * 12;
  return { x, y };
}

/**
 * Fast-start / slow-end ramp:
 * starts instantly, then eases out into the cut.
 */
function animeRamp(t: number, power = 4.8): number {
  const clamped = Math.max(0, Math.min(1, t));
  const eased = 1 - Math.pow(1 - clamped, power);
  const kick = Math.sin(clamped * Math.PI) * 0.012 * (1 - clamped);
  return Math.max(0, Math.min(1, eased + kick));
}

function animeRampVelocity(t: number): number {
  const dt = 0.015;
  const prev = Math.max(0, t - dt);
  const v = (animeRamp(t) - animeRamp(prev)) / dt;
  return Math.max(0, Math.min(1, v));
}

// ---------------------------------------------------------------------------
// ClipTransition — wraps a Clip, drives enter/exit animations
// ---------------------------------------------------------------------------

interface ClipTransitionProps {
  children: React.ReactNode;
  enterType: string;
  exitType: string;
  enterFrames: number;
  exitFrames: number;
}

export const ClipTransition: React.FC<ClipTransitionProps> = ({
  children,
  enterType,
  exitType,
  enterFrames,
  exitFrames,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  let opacity = 1;
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let brightness = 1;
  let saturate = 1; // 1 = normal, 0 = full grayscale
  let blurPx = 0;
  let overlayColor: string | null = null;
  let overlayOpacity = 0;
  let showGlitch = false;
  let glitchIntensity = 0;
  let clipPath: string | undefined;
  const sideScrollDistance = Math.round(width * 0.85);

  // Match Clip.tsx overlap timing: exit starts exitFrames*2 before end
  const exitStart = exitFrames > 0 ? Math.max(0, durationInFrames - exitFrames * 2) : durationInFrames;
  const inExit = exitFrames > 0 && frame >= exitStart;
  const inEnter = enterFrames > 0 && frame < enterFrames;

  // ===== ENTER =====
  if (inEnter) {
    const t = Math.min(frame / enterFrames, 1); // 0 → 1

    switch (enterType) {
      case "flash-white": {
        const e = animeRamp(t);
        opacity = e;
        brightness = 1 + (1 - e) * 2.5;
        overlayColor = "white";
        overlayOpacity = (1 - e) * 0.9;
        break;
      }
      case "flash-black": {
        const e = animeRamp(t);
        opacity = e;
        brightness = 0.3 + e * 0.7;
        overlayColor = "black";
        overlayOpacity = (1 - e) * 0.9;
        break;
      }
      case "zoom-punch": {
        const e = animeRamp(t);
        scale = 1.25 - 0.25 * e;
        opacity = e;
        const s = shake(frame, "zp-enter", (1 - t) * 0.6);
        tx = s.x;
        ty = s.y;
        break;
      }
      case "glitch": {
        // Violent digital corruption that stabilizes
        const e = Easing.out(Easing.cubic)(t);
        // Hard flicker — full blackouts in early frames
        const flicker = random(`gl-en-fl-${frame}`);
        const blackout = t < 0.3 && flicker < 0.35 ? 0 : 1;
        const noise = (random(`gl-en-op-${frame}`) - 0.5) * 1.2 * (1 - t);
        opacity = Math.max(0, Math.min(1, e + noise)) * blackout;
        // Massive shake that decays
        const s = shake(frame, "gl-enter", (1 - t) * 2.5);
        tx = s.x;
        ty = s.y;
        // Random scale jitter
        scale = 1 + (random(`gl-en-sc-${frame}`) - 0.5) * 0.15 * (1 - t);
        // Color corruption
        brightness = 1 + (random(`gl-en-br-${frame}`) - 0.3) * 1.5 * (1 - t);
        showGlitch = true;
        glitchIntensity = Math.min(1, (1 - t) * 1.8);
        break;
      }
      case "side-scroll-left": {
        const e = animeRamp(t);
        const s = shake(frame, "ss-enter", 0.1 + (1 - t) * 0.28);
        tx = (1 - e) * sideScrollDistance + s.x;
        ty = s.y * 0.6;
        opacity = 0.85 + e * 0.15;
        break;
      }
      case "split": {
        // Enter: right half → hold split → expand fullscreen
        // Phase 1 (0–0.3): slide in from right, crop to right half
        // Phase 2 (0.3–0.7): hold the split
        // Phase 3 (0.7–1): expand to fullscreen
        const GAP_PX = 4;
        const halfW = width / 2;
        if (t < 0.3) {
          // Slide in from right
          const st = Easing.out(Easing.cubic)(t / 0.3);
          const slideOff = (1 - st) * halfW;
          tx = slideOff;
          clipPath = `inset(0 0 0 ${halfW + GAP_PX / 2}px)`;
          opacity = 0.6 + st * 0.4;
        } else if (t < 0.7) {
          // Hold in right half
          clipPath = `inset(0 0 0 ${halfW + GAP_PX / 2}px)`;
        } else {
          // Expand to fullscreen
          const et = Easing.out(Easing.cubic)((t - 0.7) / 0.3);
          const leftInset = (halfW + GAP_PX / 2) * (1 - et);
          clipPath = `inset(0 0 0 ${leftInset}px)`;
        }
        break;
      }
    }
  }

  // ===== EXIT =====
  if (inExit) {
    const exitWindow = exitFrames * 2;
    const ef = frame - exitStart;
    const t = Math.min(ef / exitWindow, 1); // 0 → 1

    // Desaturate on most exits — keep side-scroll/split color intact.
    saturate =
      exitType === "hard-cut" || exitType === "side-scroll-left" || exitType === "split"
        ? 1
        : 1 - animeRamp(t);

    switch (exitType) {
      case "flash-white": {
        const e = animeRamp(t);
        brightness = 1 + e * 3.5;
        scale = 1 + e * 0.06;
        overlayColor = "white";
        overlayOpacity = e;
        const s = shake(frame, "fw-exit", e * 1.0);
        tx = s.x;
        ty = s.y;
        break;
      }
      case "flash-black": {
        const e = animeRamp(t);
        brightness = 1 - e * 0.85;
        scale = 1 - e * 0.03;
        overlayColor = "black";
        overlayOpacity = e;
        const s = shake(frame, "fb-exit", e * 0.7);
        tx = s.x;
        ty = s.y;
        break;
      }
      case "zoom-punch": {
        const e = animeRamp(t);
        scale = 1 + e * 0.5;
        opacity = 1 - e;
        const s = shake(frame, "zp-exit", e * 1.5);
        tx = s.x;
        ty = s.y;
        break;
      }
      case "glitch": {
        // Clip tears apart — violent exit
        const e = Easing.in(Easing.cubic)(t);
        // Hard flicker + blackouts in final frames
        const flicker = random(`gl-ex-fl-${frame}`);
        const blackout = t > 0.7 && flicker < 0.4 ? 0 : 1;
        const noise = (random(`gl-ex-op-${frame}`) - 0.5) * 1.0 * e;
        opacity = Math.max(0, 1 - e + noise) * blackout;
        // Massive shake ramps up
        const s = shake(frame, "gl-exit", e * 3.0);
        tx = s.x;
        ty = s.y;
        // Scale jitter
        scale = 1 + (random(`gl-ex-sc-${frame}`) - 0.5) * 0.2 * e;
        // Color blowout
        brightness = 1 + (random(`gl-ex-br-${frame}`) - 0.3) * 2.0 * e;
        showGlitch = true;
        glitchIntensity = Math.min(1, e * 2.0);
        break;
      }
      case "side-scroll-left": {
        const e = animeRamp(t);
        const s = shake(frame, "ss-exit", 0.1 + t * 0.24);
        tx = -e * sideScrollDistance + s.x;
        ty = s.y * 0.6;
        opacity = 1 - e * 0.08;
        break;
      }
      case "split": {
        // Exit window is exitFrames*2, but new clip only overlaps the
        // second half (t >= 0.5). Don't clip until then or we get black.
        const GAP_PX = 4;
        const halfW = width / 2;
        if (t < 0.5) {
          // Pre-overlap: just desaturate, still fullscreen
          saturate = 1 - Easing.out(Easing.cubic)(t / 0.5);
        } else {
          // Overlap: crop to left half
          saturate = 0;
          clipPath = `inset(0 ${halfW + GAP_PX / 2}px 0 0)`;
          if (t > 0.8) {
            // Fade out as new clip goes fullscreen
            opacity = 1 - Easing.in(Easing.cubic)((t - 0.8) / 0.2);
          }
        }
        break;
      }
      case "hard-cut":
      default:
        saturate = 1; // no desaturate on hard cut
        break;
    }
  }

  const filters: string[] = [];
  if (brightness !== 1) filters.push(`brightness(${brightness})`);
  if (saturate !== 1) filters.push(`saturate(${saturate})`);
  if (blurPx > 0.01) filters.push(`blur(${blurPx}px)`);

  const style: React.CSSProperties = {
    opacity,
    transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
    filter: filters.length > 0 ? filters.join(" ") : undefined,
    clipPath,
  };

  return (
    <AbsoluteFill style={style}>
      {children}

      {/* Color overlay (flash) */}
      {overlayColor && overlayOpacity > 0.01 && (
        <AbsoluteFill
          style={{
            backgroundColor: overlayColor,
            opacity: overlayOpacity,
            zIndex: 100,
          }}
        />
      )}

      {/* Glitch overlay */}
      {showGlitch && glitchIntensity > 0.01 && (
        <GlitchOverlay frame={frame} intensity={glitchIntensity} />
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// GlitchOverlay — RGB split, random bars, scanlines
// ---------------------------------------------------------------------------

const GlitchOverlay: React.FC<{ frame: number; intensity: number }> = ({
  frame,
  intensity,
}) => {
  // More bars, thicker, harder displacement
  const bars = Array.from({ length: 14 }, (_, i) => {
    const seed = `gbar-${i}-${frame}`;
    return {
      y: random(seed + "-y") * 100,
      height: random(seed + "-h") * 60 + 8,
      offset: (random(seed + "-x") - 0.5) * 120 * intensity,
      visible: random(seed + "-v") > 0.2,
      alpha: random(seed + "-a") * 0.8 * intensity,
      color: random(seed + "-c") > 0.5 ? "cyan" : random(seed + "-c2") > 0.5 ? "magenta" : "white",
    };
  });

  // Big horizontal slice — whole chunk of the frame displaced
  const sliceY = random(`gslice-y-${frame}`) * 60 + 20; // 20-80%
  const sliceH = random(`gslice-h-${frame}`) * 15 + 5; // 5-20%
  const sliceOff = (random(`gslice-x-${frame}`) - 0.5) * 200 * intensity;

  const rgbOff = intensity * 30;

  return (
    <AbsoluteFill
      style={{ zIndex: 100, overflow: "hidden", pointerEvents: "none" }}
    >
      {/* RGB split — aggressive offset */}
      <AbsoluteFill
        style={{
          backgroundColor: "cyan",
          opacity: 0.4 * intensity,
          transform: `translateX(${rgbOff}px) translateY(${intensity * 4}px)`,
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: "magenta",
          opacity: 0.4 * intensity,
          transform: `translateX(${-rgbOff}px) translateY(${-intensity * 4}px)`,
          mixBlendMode: "screen",
        }}
      />

      {/* Displacement bars */}
      {bars.map((bar, i) =>
        bar.visible ? (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${bar.y}%`,
              left: 0,
              right: 0,
              height: `${bar.height}px`,
              backgroundColor: bar.color,
              opacity: bar.alpha,
              transform: `translateX(${bar.offset}px)`,
              mixBlendMode: "screen",
            }}
          />
        ) : null,
      )}

      {/* Big horizontal slice displacement */}
      {intensity > 0.3 && (
        <div
          style={{
            position: "absolute",
            top: `${sliceY}%`,
            left: 0,
            right: 0,
            height: `${sliceH}%`,
            backgroundColor: "rgba(0,0,0,0.6)",
            transform: `translateX(${sliceOff}px)`,
          }}
        />
      )}

      {/* White noise flash */}
      {random(`gnoise-${frame}`) > 0.6 && intensity > 0.4 && (
        <AbsoluteFill
          style={{
            backgroundColor: "#fff",
            opacity: random(`gnoise-op-${frame}`) * 0.3 * intensity,
          }}
        />
      )}

      {/* Scanlines — heavier */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px)",
          opacity: intensity * 0.8,
        }}
      />
    </AbsoluteFill>
  );
};

// Legacy exports — kept so nothing breaks if imported elsewhere
export const Flash: React.FC<{
  color: "white" | "black";
  durationInFrames: number;
}> = () => null;
export const Glitch: React.FC<{ durationInFrames: number }> = () => null;
export const ZoomPunch: React.FC<{ durationInFrames: number }> = () => null;
