/**
 * ConnectionLines — SVG paths connecting nodes in the graph.
 *
 * Lines draw in with animated stroke-dashoffset, expand outward during scan.
 * Glowing endpoint dots appear at line destinations before boxes pop in.
 * Includes energy pulses travelling along the connections for a high-tech feel.
 */
import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
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

function renderSynapsePulse(
  key: string,
  d: string,
  len: number,
  progress: number,
  opacity: number,
  color: string,
  width: number,
) {
  return (
    <React.Fragment key={key}>
      <path
        d={d}
        stroke={color}
        strokeWidth={width + 7}
        fill="none"
        opacity={opacity * 0.28}
        strokeDasharray={`48 ${len}`}
        strokeDashoffset={progress}
        filter="url(#glow-synapse-wide)"
        strokeLinecap="round"
      />
      <path
        d={d}
        stroke="#FF9A2F"
        strokeWidth={width + 3.5}
        fill="none"
        opacity={opacity * 0.65}
        strokeDasharray={`22 ${len}`}
        strokeDashoffset={progress + 2}
        filter="url(#glow-amber)"
        strokeLinecap="round"
      />
      <path
        d={d}
        stroke="#FFFFFF"
        strokeWidth={width + 0.8}
        fill="none"
        opacity={opacity}
        strokeDasharray={`10 ${len}`}
        strokeDashoffset={progress + 5}
        filter="url(#glow-white)"
        strokeLinecap="round"
      />
    </React.Fragment>
  );
}

function renderSynapseShimmer(
  key: string,
  d: string,
  len: number,
  opacity: number,
  color: string,
  filterId: string,
  dashOffset: number,
  width: number,
) {
  return (
    <React.Fragment key={key}>
      <path
        d={d}
        stroke={color}
        strokeWidth={width + 3}
        fill="none"
        opacity={opacity * 0.16}
        strokeDasharray={`26 ${len}`}
        strokeDashoffset={dashOffset * 0.55}
        filter={`url(#glow-${filterId})`}
        strokeLinecap="round"
      />
      <path
        d={d}
        stroke="#9FE9FF"
        strokeWidth={width + 0.6}
        fill="none"
        opacity={opacity * 0.4}
        strokeDasharray={`12 ${len}`}
        strokeDashoffset={dashOffset}
        filter="url(#glow-white)"
        strokeLinecap="round"
      />
    </React.Fragment>
  );
}

function activationEnvelope(
  frame: number,
  start: number,
  attack = 6,
  decay = 18,
) {
  const rise = interpolate(frame, [start, start + attack], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const fall = interpolate(frame, [start + attack, start + attack + decay], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  return rise * fall;
}

export const ConnectionLines: React.FC<ConnectionLinesProps> = ({
  layout,
  buildStartFrame,
  expandFactor,
}) => {
  const frame = useCurrentFrame();
  const lines: React.ReactNode[] = [];
  const shimmers: React.ReactNode[] = [];
  const pulses: React.ReactNode[] = [];
  const dots: React.ReactNode[] = [];
  let lineIdx = 0;

  const ctr = layout.center;
  const EASE_DRAW = Easing.bezier(0.25, 1, 0.5, 1);

  // Center dot — appears immediately
  const centerDotOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) });
  const centerPulse = 1 + 0.3 * Math.sin(frame * 0.08);
  dots.push(
    <circle
      key="center-dot"
      cx={ctr.x}
      cy={ctr.y}
      r={6 * centerPulse}
      fill="#FF8A00"
      opacity={centerDotOpacity * 0.9}
      filter="url(#glow-orange)"
    />,
    <circle
      key="center-glow"
      cx={ctr.x}
      cy={ctr.y}
      r={18 * centerPulse}
      fill="none"
      stroke="#FF8A00"
      strokeWidth={2}
      opacity={centerDotOpacity * 0.4}
      filter="url(#glow-orange-wide)"
    />,
  );

  for (let ti = 0; ti < layout.topics.length; ti++) {
    const topic = layout.topics[ti];
    const topicPos = expandPos(topic.pos, ctr, expandFactor);
    const d = pathD(ctr, topicPos, 40 * (ti % 2 === 0 ? 1 : -1));

    // Center → Topic line
    const ctDelay = buildStartFrame + ti * 6;
    const ctLen = pathLength(ctr, topicPos);
    const ctDraw = interpolate(frame, [ctDelay, ctDelay + 20], [ctLen, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_DRAW,
    });
    const ctOpacity = interpolate(frame, [ctDelay, ctDelay + 10], [0, 1], {
      extrapolateRight: "clamp",
    });
    const ctPulse = 0.55 + 0.15 * Math.sin(frame * 0.04 + ti * 1.3);

    lines.push(
      <path
        key={`ct-${ti}`}
        d={d}
        stroke={topic.color}
        strokeWidth={2.5}
        fill="none"
        opacity={ctOpacity * ctPulse}
        strokeDasharray={ctLen}
        strokeDashoffset={ctDraw}
        filter={`url(#glow-${topic.key})`}
      />,
    );

    const topicDotDelay = ctDelay + 10;
    const topicActivation = activationEnvelope(frame, topicDotDelay, 7, 22);
    const topicLineLive = interpolate(frame, [topicDotDelay - 2, topicDotDelay + 10], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });

    shimmers.push(
      renderSynapseShimmer(
        `ct-shimmer-${ti}`,
        d,
        ctLen,
        ctOpacity * topicLineLive * (0.55 + 0.45 * topicActivation + 0.25 * Math.sin(frame * 0.025 + ti * 0.9)),
        topic.color,
        topic.key,
        -frame * 1.4 - ti * 18,
        1.8,
      ),
    );

    // Energy packet travelling along Center → Topic line
    const packetDelay = topicDotDelay;
    const ctPulseCycle = 84;
    const ctPulseTravel = 42;
    const ctPulseFrame = Math.max(0, frame - packetDelay) % ctPulseCycle;
    const packetProgress = interpolate(ctPulseFrame, [0, ctPulseTravel], [ctLen + 30, -48], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    const packetOpacity = interpolate(ctPulseFrame, [0, 5, 28, ctPulseTravel], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    if (frame >= packetDelay) {
      pulses.push(
        renderSynapsePulse(
          `ct-pulse-${ti}`,
          d,
          ctLen,
          packetProgress,
          packetOpacity * (0.72 + topicActivation * 0.95),
          topic.color,
          3.4,
        ),
      );
    }

    // Topic endpoint dot — appears as line arrives
    const topicDotOpacity = interpolate(frame, [topicDotDelay, topicDotDelay + 8], [0, 1], {
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
        opacity={topicDotOpacity * 0.9}
        filter={`url(#glow-${topic.key})`}
      />,
      <circle
        key={`tg-${ti}`}
        cx={topicPos.x}
        cy={topicPos.y}
        r={14 * topicDotPulse}
        fill="none"
        stroke={topic.color}
        strokeWidth={1.5}
        opacity={topicDotOpacity * 0.35}
      />,
    );

    // Topic → Content lines + dots
    for (let ci = 0; ci < topic.items.length; ci++) {
      const content = topic.items[ci];
      const contentPos = expandPos(content.pos, ctr, expandFactor);
      const tcD = pathD(topicPos, contentPos, 25 * (ci % 2 === 0 ? 1 : -1));

      const tcDelay = ctDelay + 8 + ci * 5;
      const tcLen = pathLength(topicPos, contentPos);
      const tcDraw = interpolate(frame, [tcDelay, tcDelay + 15], [tcLen, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASE_DRAW,
      });
      const tcOpacity = interpolate(frame, [tcDelay, tcDelay + 8], [0, 1], {
        extrapolateRight: "clamp",
      });
      const tcPulse = 0.45 + 0.15 * Math.sin(frame * 0.035 + lineIdx * 0.7);

      lines.push(
        <path
          key={`tc-${ti}-${ci}`}
          d={tcD}
          stroke={topic.color}
          strokeWidth={1.5}
          fill="none"
          opacity={tcOpacity * tcPulse}
          strokeDasharray={tcLen}
          strokeDashoffset={tcDraw}
        />,
      );

      const contentDotDelay = tcDelay + 8;
      const contentActivation = activationEnvelope(frame, contentDotDelay, 6, 18);
      const contentLineLive = interpolate(frame, [contentDotDelay - 2, contentDotDelay + 9], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      });

      shimmers.push(
        renderSynapseShimmer(
          `tc-shimmer-${ti}-${ci}`,
          tcD,
          tcLen,
          tcOpacity * contentLineLive * (0.65 + 0.55 * contentActivation + 0.4 * Math.sin(frame * 0.03 + lineIdx * 0.7)),
          topic.color,
          topic.key,
          -frame * 2.2 - lineIdx * 19,
          1.45,
        ),
      );

      // Energy packet travelling along Topic → Content line
      const cPacketDelay = contentDotDelay;
      const cPulseCycle = 64;
      const cPulseTravel = 34;
      const cPulseFrame = Math.max(0, frame - cPacketDelay) % cPulseCycle;
      const cPacketProgress = interpolate(cPulseFrame, [0, cPulseTravel], [tcLen + 20, -28], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      });
      const cPacketOpacity = interpolate(cPulseFrame, [0, 4, 22, cPulseTravel], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

      if (frame >= cPacketDelay) {
        pulses.push(
          renderSynapsePulse(
            `tc-pulse-${ti}-${ci}`,
            tcD,
            tcLen,
            cPacketProgress,
            cPacketOpacity * (0.7 + contentActivation),
            topic.color,
            2.6,
          ),
        );
      }

      // Content endpoint dot
      const contentDotOpacity = interpolate(frame, [contentDotDelay, contentDotDelay + 6], [0, 1], {
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
          opacity={contentDotOpacity * 0.8}
        />,
      );

      lineIdx++;
    }
  }

  // Extract unique topic colors for SVG filters
  const uniqueTopics = Array.from(new Set(layout.topics.map(t => JSON.stringify({key: t.key, color: t.color})))).map(s => JSON.parse(s));

  return (
    <svg
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}
    >
      <defs>
        {/* White glow for data pulses */}
        <filter id="glow-white" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-amber" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-synapse-wide" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        {/* Orange glow for central hub */}
        <filter id="glow-orange" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-orange-wide" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        {/* Dynamic glows for topic colors */}
        {uniqueTopics.map((t) => (
          <filter key={`glow-filter-${t.key}`} id={`glow-${t.key}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feFlood floodColor={t.color} result="color" />
            <feComposite in="color" in2="blur" operator="in" result="coloredBlur" />
            <feComposite in="SourceGraphic" in2="coloredBlur" operator="over" />
          </filter>
        ))}
      </defs>
      {lines}
      {shimmers}
      {pulses}
      {dots}
    </svg>
  );
};
