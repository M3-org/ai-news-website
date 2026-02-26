/**
 * BezierGraph.tsx — SVG overlay that visualizes the cubic-bezier easing curve.
 *
 * Shows the curve shape, control point handles, and a playhead dot that
 * tracks the current frame position. Renders as an absolute-positioned
 * overlay in the composition — updates live as you drag Studio sliders.
 */
import React from "react";
import { Easing } from "remotion";

interface BezierGraphProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 0-1 progress through the composition */
  progress: number;
  /** Pixel size of the graph (square) */
  size?: number;
}

export const BezierGraph: React.FC<BezierGraphProps> = ({
  x1,
  y1,
  x2,
  y2,
  progress,
  size = 200,
}) => {
  // Padding around the graph for control points that exceed 0-1 range
  const pad = 30;
  const graphSize = size - pad * 2;

  // Map normalized coords to SVG pixel coords.
  // Y is flipped: SVG y=0 is top, but curve y=0 should be bottom.
  const toSvgX = (n: number) => pad + n * graphSize;
  const toSvgY = (n: number) => pad + (1 - n) * graphSize;

  // Control point positions in SVG space
  const p0 = { x: toSvgX(0), y: toSvgY(0) };
  const cp1 = { x: toSvgX(x1), y: toSvgY(y1) };
  const cp2 = { x: toSvgX(x2), y: toSvgY(y2) };
  const p1 = { x: toSvgX(1), y: toSvgY(1) };

  // Evaluate the easing function at current progress to get the playhead Y
  const easingFn = Easing.bezier(x1, y1, x2, y2);
  const easedValue = easingFn(Math.min(1, Math.max(0, progress)));
  const playheadX = toSvgX(progress);
  const playheadY = toSvgY(easedValue);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        right: 20,
        width: size,
        height: size,
        pointerEvents: "none",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background */}
        <rect
          x={pad}
          y={pad}
          width={graphSize}
          height={graphSize}
          fill="rgba(0,0,0,0.6)"
          rx={4}
        />

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((t) => (
          <React.Fragment key={t}>
            <line
              x1={toSvgX(t)} y1={toSvgY(0)}
              x2={toSvgX(t)} y2={toSvgY(1)}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
            <line
              x1={toSvgX(0)} y1={toSvgY(t)}
              x2={toSvgX(1)} y2={toSvgY(t)}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
          </React.Fragment>
        ))}

        {/* Linear reference (diagonal) */}
        <line
          x1={p0.x} y1={p0.y}
          x2={p1.x} y2={p1.y}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Control point handles — lines from anchors to control points */}
        <line
          x1={p0.x} y1={p0.y}
          x2={cp1.x} y2={cp1.y}
          stroke="rgba(100,180,255,0.6)"
          strokeWidth={1.5}
        />
        <line
          x1={p1.x} y1={p1.y}
          x2={cp2.x} y2={cp2.y}
          stroke="rgba(100,180,255,0.6)"
          strokeWidth={1.5}
        />

        {/* The bezier curve */}
        <path
          d={`M ${p0.x} ${p0.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p1.x} ${p1.y}`}
          fill="none"
          stroke="#4af"
          strokeWidth={2.5}
        />

        {/* Control point dots */}
        <circle cx={cp1.x} cy={cp1.y} r={4} fill="#4af" />
        <circle cx={cp2.x} cy={cp2.y} r={4} fill="#4af" />

        {/* Playhead — vertical line + dot on curve */}
        <line
          x1={playheadX} y1={toSvgY(0)}
          x2={playheadX} y2={toSvgY(1)}
          stroke="rgba(255,255,100,0.4)"
          strokeWidth={1}
        />
        <circle cx={playheadX} cy={playheadY} r={5} fill="#ff4" />

        {/* Axis labels */}
        <text x={toSvgX(0.5)} y={size - 4} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={10} fontFamily="monospace">
          time
        </text>
        <text x={4} y={toSvgY(0.5)} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={10} fontFamily="monospace" transform={`rotate(-90, 4, ${toSvgY(0.5)})`}>
          value
        </text>
      </svg>
    </div>
  );
};
