/**
 * DotGrid — Subtle background dot pattern for the graph canvas.
 * Dark background with faint dots, Obsidian graph-view style.
 * Active nodes make nearby dots glow in their topic color.
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
}

const DOT_SPACING = 40;

export const DotGrid: React.FC<DotGridProps> = ({ cam, glows }) => {
  const parallaxFactor = 0.15;
  const parallaxX = (cam.x - CANVAS_SIZE / 2) * parallaxFactor;
  const parallaxY = (cam.y - CANVAS_SIZE / 2) * parallaxFactor;

  return (
    <div
      style={{
        position: "absolute",
        left: -CANVAS_SIZE,
        top: -CANVAS_SIZE,
        width: CANVAS_SIZE * 3,
        height: CANVAS_SIZE * 3,
        backgroundColor: BG_COLOR,
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.10) 1.5px, transparent 1.5px)",
        backgroundSize: `${DOT_SPACING}px ${DOT_SPACING}px`,
        transform: `translate(${parallaxX}px, ${parallaxY}px)`,
      }}
    >
      {/* Colored dot overlays — same container so dots align perfectly */}
      {glows?.map((g, i) => {
        if (g.intensity < 0.01) return null;
        const radius = 320 + g.intensity * 200;
        const dotOpacity = 0.25 + g.intensity * 0.65;
        // Position within the oversized container
        const cx = CANVAS_SIZE + g.pos.x;
        const cy = CANVAS_SIZE + g.pos.y;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx - radius,
              top: cy - radius,
              width: radius * 2,
              height: radius * 2,
              backgroundImage:
                `radial-gradient(circle, ${g.color} 1.5px, transparent 1.5px)`,
              backgroundSize: `${DOT_SPACING}px ${DOT_SPACING}px`,
              // Inherit dot phase from parent by matching the offset
              backgroundPosition: `${-(cx - radius)}px ${-(cy - radius)}px`,
              opacity: dotOpacity,
              maskImage: "radial-gradient(circle, black 0%, black 25%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(circle, black 0%, black 25%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
        );
      })}
    </div>
  );
};
