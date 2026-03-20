/**
 * DotGrid — Background dot pattern with active-node glow and ignition reveal.
 *
 * Active-node glow: Subtle colored dots + soft bloom (2 layers, toned down).
 * Ignition wave: During initial reveal, a radial front of bright dots expands
 * from center with a white leading edge and orange fill behind it.
 */
import React from "react";
import { CANVAS_SIZE } from "./layout";
import type { CameraTarget } from "./camera";
import type { NodePos } from "./layout";

export const BG_COLOR = "#0a0612";

export interface GlowSpot {
  pos: NodePos;
  color: string;
  intensity: number; // 0–1
}

interface DotGridProps {
  cam: CameraTarget;
  glows?: GlowSpot[];
  /** 0–1 radial expansion of the ignition wave */
  ignition?: number;
  /** 0–1 brightness of the ignition wave */
  ignitionIntensity?: number;
}

const DOT_SPACING = 40;

/** 0–1 float → 2-digit hex for CSS alpha suffix */
const hexA = (a: number) =>
  Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0");

/** Center of canvas in the oversized 3× container */
const CTR = CANVAS_SIZE + CANVAS_SIZE / 2;

export const DotGrid: React.FC<DotGridProps> = ({
  cam,
  glows,
  ignition,
  ignitionIntensity,
}) => {
  const parallaxFactor = 0.15;
  const parallaxX = (cam.x - CANVAS_SIZE / 2) * parallaxFactor;
  const parallaxY = (cam.y - CANVAS_SIZE / 2) * parallaxFactor;

  const showIgnition =
    ignition !== undefined &&
    ignition > 0.005 &&
    ignitionIntensity !== undefined &&
    ignitionIntensity > 0.01;
  const ign = ignition ?? 0;
  const ignI = ignitionIntensity ?? 0;

  return (
    <div
      style={{
        position: "absolute",
        left: -CANVAS_SIZE,
        top: -CANVAS_SIZE,
        width: CANVAS_SIZE * 3,
        height: CANVAS_SIZE * 3,
        backgroundColor: "transparent",
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.10) 1.5px, transparent 1.5px)",
        backgroundSize: `${DOT_SPACING}px ${DOT_SPACING}px`,
        transform: `translate(${parallaxX}px, ${parallaxY}px)`,
      }}
    >
      {/* ── Ignition wave — expanding radial ring of bright dots ── */}
      {showIgnition &&
        (() => {
          const waveR = ign * CANVAS_SIZE * 1.2;
          // Ring fraction gets thinner as wave expands
          const ringFrac = 0.18 / Math.max(0.15, ign);
          const innerPct = Math.max(0, (1 - ringFrac) * 100);
          const midPct = Math.min(100, innerPct + ringFrac * 50);

          return (
            <>
              {/* White dot wave front — the bright leading edge */}
              <div
                style={{
                  position: "absolute",
                  left: CTR - waveR,
                  top: CTR - waveR,
                  width: waveR * 2,
                  height: waveR * 2,
                  backgroundImage:
                    "radial-gradient(circle, rgba(255,255,255,0.94) 2px, transparent 2px)",
                  backgroundSize: `${DOT_SPACING}px ${DOT_SPACING}px`,
                  backgroundPosition: `${-(CTR - waveR)}px ${-(CTR - waveR)}px`,
                  opacity: ignI * 0.8,
                  maskImage: `radial-gradient(circle, transparent ${innerPct}%, white ${midPct}%, white ${Math.min(100, midPct + 8)}%, transparent 100%)`,
                  WebkitMaskImage: `radial-gradient(circle, transparent ${innerPct}%, white ${midPct}%, white ${Math.min(100, midPct + 8)}%, transparent 100%)`,
                  pointerEvents: "none",
                }}
              />
              {/* Orange fill behind the wave */}
              <div
                style={{
                  position: "absolute",
                  left: CTR - waveR,
                  top: CTR - waveR,
                  width: waveR * 2,
                  height: waveR * 2,
                  backgroundImage:
                    "radial-gradient(circle, #FF8A00 1.5px, transparent 1.5px)",
                  backgroundSize: `${DOT_SPACING}px ${DOT_SPACING}px`,
                  backgroundPosition: `${-(CTR - waveR)}px ${-(CTR - waveR)}px`,
                  opacity: ignI * 0.3,
                  maskImage: `radial-gradient(circle, white 0%, white ${innerPct * 0.5}%, transparent ${innerPct}%)`,
                  WebkitMaskImage: `radial-gradient(circle, white 0%, white ${innerPct * 0.5}%, transparent ${innerPct}%)`,
                  pointerEvents: "none",
                }}
              />
              {/* Soft bloom haze behind the wave */}
              <div
                style={{
                  position: "absolute",
                  left: CTR - waveR * 1.2,
                  top: CTR - waveR * 1.2,
                  width: waveR * 2.4,
                  height: waveR * 2.4,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, #FF8A00${hexA(ignI * 0.15)} 0%, transparent 55%)`,
                  filter: `blur(${28 + ign * 40}px)`,
                  pointerEvents: "none",
                }}
              />
            </>
          );
        })()}

      {/* ── Active-node glow (subtle — 2 layers) ── */}
      {glows?.map((g, i) => {
        if (g.intensity < 0.01) return null;
        const t = g.intensity;
        const bloomR = 380 + t * 240;
        const colorR = 320 + t * 200;
        // Subtract parallax so glow center tracks the node (which has no parallax)
        // backgroundPosition formula auto-adjusts so dots stay grid-aligned
        const cx = CANVAS_SIZE + g.pos.x - parallaxX;
        const cy = CANVAS_SIZE + g.pos.y - parallaxY;

        return (
          <React.Fragment key={i}>
            {/* Soft bloom */}
            <div
              style={{
                position: "absolute",
                left: cx - bloomR,
                top: cy - bloomR,
                width: bloomR * 2,
                height: bloomR * 2,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${g.color}${hexA(t * 0.16)} 0%, ${g.color}${hexA(t * 0.05)} 40%, transparent 68%)`,
                filter: `blur(${16 + t * 14}px)`,
                pointerEvents: "none",
              }}
            />
            {/* Colored dots */}
            <div
              style={{
                position: "absolute",
                left: cx - colorR,
                top: cy - colorR,
                width: colorR * 2,
                height: colorR * 2,
                backgroundImage: `radial-gradient(circle, ${g.color} 1.5px, transparent 1.5px)`,
                backgroundSize: `${DOT_SPACING}px ${DOT_SPACING}px`,
                backgroundPosition: `${-(cx - colorR)}px ${-(cy - colorR)}px`,
                opacity: 0.25 + t * 0.35,
                maskImage:
                  "radial-gradient(circle, black 0%, black 20%, transparent 58%)",
                WebkitMaskImage:
                  "radial-gradient(circle, black 0%, black 20%, transparent 58%)",
                pointerEvents: "none",
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};
