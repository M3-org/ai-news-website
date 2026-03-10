/**
 * DotGrid — Subtle background dot pattern for the graph canvas.
 * Dark background with faint dots, Obsidian graph-view style.
 */
import React from "react";
import { CANVAS_SIZE } from "./layout";

export const BG_COLOR = "#0a0e17";

export const DotGrid: React.FC = () => (
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
    }}
  />
);
