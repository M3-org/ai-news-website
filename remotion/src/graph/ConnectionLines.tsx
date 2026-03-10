/**
 * ConnectionLines — SVG paths connecting nodes in the graph.
 *
 * Lines draw in with animated stroke-dashoffset, expand outward during scan.
 * Glowing endpoint dots appear at line destinations before boxes pop in.
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { CANVAS_SIZE, CENTER, type GraphLayout, type NodePos } from "./layout";

interface ConnectionLinesProps {
  layout: GraphLayout;
  buildStartFrame: number;
  expandFactor: number;
}

function controlPoint(from: NodePos, to: NodePos, offset: number): NodePos {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  return { x: mx + px * offset, y: my + py * offset };
}

function pathD(from: NodePos, to: NodePos, curveOffset: number): string {
  const cp = controlPoint(from, to, curveOffset);
  return `M ${from.x} ${from.y} Q ${cp.x} ${cp.y} ${to.x} ${to.y}`;
}

function pathLength(from: NodePos, to: NodePos): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy) * 1.1;
}

function expandPos(pos: NodePos, center: NodePos, factor: number): NodePos {
  if (factor >= 1) return pos;
  const dx = pos.x - center.x;
  const dy = pos.y - center.y;
  return { x: center.x + dx * factor, y: center.y + dy * factor };
}

export const ConnectionLines: React.FC<ConnectionLinesProps> = ({
  layout,
  buildStartFrame,
  expandFactor,
}) => {
  const frame = useCurrentFrame();
  const lines: React.ReactNode[] = [];
  const dots: React.ReactNode[] = [];
  let lineIdx = 0;

  const ctr = layout.center;

  // Center dot — appears immediately
  const centerDotOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const centerPulse = 1 + 0.3 * Math.sin(frame * 0.08);
  dots.push(
    <circle
      key="center-dot"
      cx={ctr.x}
      cy={ctr.y}
      r={6 * centerPulse}
      fill="#FF8A00"
      opacity={centerDotOpacity * 0.9}
    />,
    <circle
      key="center-glow"
      cx={ctr.x}
      cy={ctr.y}
      r={18 * centerPulse}
      fill="none"
      stroke="#FF8A00"
      strokeWidth={1}
      opacity={centerDotOpacity * 0.3}
    />,
  );

  for (let ti = 0; ti < layout.topics.length; ti++) {
    const topic = layout.topics[ti];
    const topicPos = expandPos(topic.pos, ctr, expandFactor);

    // Center → Topic line
    const ctDelay = buildStartFrame + ti * 6;
    const ctLen = pathLength(ctr, topicPos);
    const ctDraw = interpolate(frame, [ctDelay, ctDelay + 15], [ctLen, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const ctOpacity = interpolate(frame, [ctDelay, ctDelay + 6], [0, 1], {
      extrapolateRight: "clamp",
    });
    const ctPulse = 0.45 + 0.2 * Math.sin(frame * 0.04 + ti * 1.3);

    lines.push(
      <path
        key={`ct-${ti}`}
        d={pathD(ctr, topicPos, 40 * (ti % 2 === 0 ? 1 : -1))}
        stroke={topic.color}
        strokeWidth={2}
        fill="none"
        opacity={ctOpacity * ctPulse}
        strokeDasharray={ctLen}
        strokeDashoffset={ctDraw}
      />,
    );

    // Topic endpoint dot — appears as line arrives
    const topicDotDelay = ctDelay + 10;
    const topicDotOpacity = interpolate(frame, [topicDotDelay, topicDotDelay + 6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const topicDotPulse = 1 + 0.25 * Math.sin(frame * 0.06 + ti * 2);
    dots.push(
      <circle
        key={`td-${ti}`}
        cx={topicPos.x}
        cy={topicPos.y}
        r={5 * topicDotPulse}
        fill={topic.color}
        opacity={topicDotOpacity * 0.85}
      />,
      <circle
        key={`tg-${ti}`}
        cx={topicPos.x}
        cy={topicPos.y}
        r={14 * topicDotPulse}
        fill="none"
        stroke={topic.color}
        strokeWidth={1}
        opacity={topicDotOpacity * 0.25}
      />,
    );

    // Topic → Content lines + dots
    for (let ci = 0; ci < topic.items.length; ci++) {
      const content = topic.items[ci];
      const contentPos = expandPos(content.pos, ctr, expandFactor);

      const tcDelay = ctDelay + 8 + ci * 5;
      const tcLen = pathLength(topicPos, contentPos);
      const tcDraw = interpolate(frame, [tcDelay, tcDelay + 12], [tcLen, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const tcOpacity = interpolate(frame, [tcDelay, tcDelay + 6], [0, 1], {
        extrapolateRight: "clamp",
      });
      const tcPulse = 0.35 + 0.15 * Math.sin(frame * 0.035 + lineIdx * 0.7);

      lines.push(
        <path
          key={`tc-${ti}-${ci}`}
          d={pathD(topicPos, contentPos, 25 * (ci % 2 === 0 ? 1 : -1))}
          stroke={topic.color}
          strokeWidth={1.5}
          fill="none"
          opacity={tcOpacity * tcPulse}
          strokeDasharray={tcLen}
          strokeDashoffset={tcDraw}
        />,
      );

      // Content endpoint dot
      const contentDotDelay = tcDelay + 8;
      const contentDotOpacity = interpolate(frame, [contentDotDelay, contentDotDelay + 5], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const contentDotPulse = 1 + 0.2 * Math.sin(frame * 0.05 + lineIdx * 1.1);
      dots.push(
        <circle
          key={`cd-${ti}-${ci}`}
          cx={contentPos.x}
          cy={contentPos.y}
          r={4 * contentDotPulse}
          fill={topic.color}
          opacity={contentDotOpacity * 0.7}
        />,
      );

      lineIdx++;
    }
  }

  return (
    <svg
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      {lines}
      {dots}
    </svg>
  );
};
