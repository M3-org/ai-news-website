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
  "flash-white": 14,
  "flash-black": 14,
  "zoom-punch": 20,
  "glitch": 18,
  "side-scroll-left": 22,
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
function animeRamp(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  // Very aggressive ease-out: big movement right at the start.
  const eased = 1 - Math.pow(1 - clamped, 4.8);
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
  const { durationInFrames, width } = useVideoConfig();

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
        const e = Easing.out(Easing.exp)(t);
        opacity = e;
        brightness = 1 + (1 - e) * 2.5;
        overlayColor = "white";
        overlayOpacity = (1 - Easing.out(Easing.cubic)(t)) * 0.9;
        break;
      }
      case "flash-black": {
        const e = Easing.out(Easing.exp)(t);
        opacity = e;
        brightness = 0.3 + e * 0.7;
        overlayColor = "black";
        overlayOpacity = (1 - Easing.out(Easing.cubic)(t)) * 0.9;
        break;
      }
      case "zoom-punch": {
        const e = Easing.out(Easing.back(1.7))(t);
        scale = 1.18 - 0.18 * e;
        opacity = Easing.out(Easing.cubic)(t);
        const s = shake(frame, "zp-enter", (1 - t) * 0.4);
        tx = s.x;
        ty = s.y;
        break;
      }
      case "glitch": {
        const e = Easing.out(Easing.cubic)(t);
        // Noisy opacity — random flicker that stabilises
        const noise = (random(`gl-en-op-${frame}`) - 0.5) * 0.6 * (1 - t);
        opacity = Math.max(0, Math.min(1, e + noise));
        const s = shake(frame, "gl-enter", (1 - t) * 0.9);
        tx = s.x;
        ty = s.y;
        showGlitch = true;
        glitchIntensity = 1 - t;
        break;
      }
      case "side-scroll-left": {
        // Fast-start side-scroll with velocity blur + shake.
        const e = animeRamp(t);
        const v = animeRampVelocity(t);
        const s = shake(frame, "ss-enter", 0.1 + v * 0.28);
        tx = (1 - e) * sideScrollDistance + s.x;
        ty = s.y * 0.6;
        blurPx = 1.5 + v * 16;
        opacity = 0.85 + e * 0.15;
        break;
      }
    }
  }

  // ===== EXIT =====
  if (inExit) {
    const exitWindow = exitFrames * 2;
    const ef = frame - exitStart;
    const t = Math.min(ef / exitWindow, 1); // 0 → 1

    // Desaturate on most exits — keep side-scroll color intact.
    saturate =
      exitType === "hard-cut" || exitType === "side-scroll-left"
        ? 1
        : 1 - Easing.in(Easing.cubic)(t);

    switch (exitType) {
      case "flash-white": {
        const e = Easing.in(Easing.exp)(t);
        brightness = 1 + e * 3.5;
        scale = 1 + e * 0.04;
        overlayColor = "white";
        overlayOpacity = Easing.in(Easing.cubic)(t);
        const s = shake(frame, "fw-exit", e * 0.7);
        tx = s.x;
        ty = s.y;
        break;
      }
      case "flash-black": {
        const e = Easing.in(Easing.exp)(t);
        brightness = 1 - e * 0.85;
        scale = 1 - e * 0.02;
        overlayColor = "black";
        overlayOpacity = Easing.in(Easing.cubic)(t);
        const s = shake(frame, "fb-exit", e * 0.5);
        tx = s.x;
        ty = s.y;
        break;
      }
      case "zoom-punch": {
        const e = Easing.in(Easing.back(2.5))(t);
        scale = 1 + e * 0.4;
        opacity = 1 - Easing.in(Easing.cubic)(t);
        const s = shake(frame, "zp-exit", e * 1.2);
        tx = s.x;
        ty = s.y;
        break;
      }
      case "glitch": {
        const e = Easing.in(Easing.cubic)(t);
        const noise = (random(`gl-ex-op-${frame}`) - 0.5) * 0.5 * e;
        opacity = Math.max(0, 1 - e + noise);
        const s = shake(frame, "gl-exit", e * 1.3);
        tx = s.x;
        ty = s.y;
        showGlitch = true;
        glitchIntensity = e;
        break;
      }
      case "side-scroll-left": {
        const e = animeRamp(t);
        const v = animeRampVelocity(t);
        const s = shake(frame, "ss-exit", 0.1 + v * 0.24);
        tx = -e * sideScrollDistance + s.x;
        ty = s.y * 0.6;
        blurPx = 1.5 + v * 16;
        opacity = 1 - e * 0.08;
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
  const bars = Array.from({ length: 6 }, (_, i) => {
    const seed = `gbar-${i}-${frame}`;
    return {
      y: random(seed + "-y") * 100,
      height: random(seed + "-h") * 25 + 5,
      offset: (random(seed + "-x") - 0.5) * 35 * intensity,
      visible: random(seed + "-v") > 0.35,
      alpha: random(seed + "-a") * 0.45 * intensity,
    };
  });

  return (
    <AbsoluteFill
      style={{ zIndex: 100, overflow: "hidden", pointerEvents: "none" }}
    >
      {/* RGB split */}
      <AbsoluteFill
        style={{
          backgroundColor: "cyan",
          opacity: 0.2 * intensity,
          transform: `translateX(${intensity * 10}px)`,
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: "magenta",
          opacity: 0.2 * intensity,
          transform: `translateX(${-intensity * 10}px)`,
          mixBlendMode: "screen",
        }}
      />

      {/* Random displacement bars */}
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
              backgroundColor: `rgba(255,255,255,${bar.alpha})`,
              transform: `translateX(${bar.offset}px)`,
            }}
          />
        ) : null,
      )}

      {/* Scanlines */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
          opacity: intensity * 0.5,
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
