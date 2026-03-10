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
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      backgroundColor: BG_COLOR,
      backgroundImage:
        "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
      backgroundSize: "40px 40px",
    }}
  />
);
