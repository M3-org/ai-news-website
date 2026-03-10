/**
 * DotGrid — Subtle background dot pattern for the graph canvas.
 * Dark background with faint dots, Obsidian graph-view style.
 */
import React from "react";
import { CANVAS_SIZE } from "./layout";
import type { CameraTarget } from "./camera";

export const BG_COLOR = "#0a0e17";

interface DotGridProps {
  cam: CameraTarget;
}

export const DotGrid: React.FC<DotGridProps> = ({ cam }) => {
  // Parallax effect: background moves slower than the foreground nodes.
  // When camera moves right (positive x), grid moves left slightly relative to canvas.
  // A parallax factor of 0.2 means the grid moves 20% as much as the camera.
  const parallaxFactor = 0.15;
  const parallaxX = (cam.x - CANVAS_SIZE / 2) * parallaxFactor;
  const parallaxY = (cam.y - CANVAS_SIZE / 2) * parallaxFactor;

  return (
    <div
      style={{
        position: "absolute",
        // Massively oversize the grid and center it so camera panning never sees edges
        left: -CANVAS_SIZE,
        top: -CANVAS_SIZE,
        width: CANVAS_SIZE * 3,
        height: CANVAS_SIZE * 3,
        backgroundColor: BG_COLOR,
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.10) 1.5px, transparent 1.5px)",
        backgroundSize: "40px 40px",
        // Apply counter-movement to create the illusion of depth
        transform: `translate(${parallaxX}px, ${parallaxY}px)`,
      }}
    />
  );
};
