/**
 * CentralNode — The "ElizaOS Daily" hub at the center of the graph.
 *
 * Skeuomorphic watch face design with arc text, tick marks, and rotating bezels.
 */
import React from "react";
import { Easing, interpolate, spring, useCurrentFrame } from "remotion";
import type { NodePos } from "../layout";
import { RAMP_EASE } from "../camera";

const ORANGE = "#FF8A00";
const SIZE = 420;
const HALF = SIZE / 2;

interface CentralNodeProps {
  pos: NodePos;
  date: string;
  focus: number;
  appearFrame: number;
  revealFrame: number;
  textVisible: boolean;
  scanOpacity: number;
}

/** Generate tick marks around the circle */
function Ticks({ count, r, length, width, color, opacity }: {
  count: number; r: number; length: number; width: number; color: string; opacity: number;
}) {
  const ticks = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 360;
    ticks.push(
      <line
        key={i}
        x1={HALF}
        y1={HALF - r}
        x2={HALF}
        y2={HALF - r + length}
        stroke={color}
        strokeWidth={width}
        opacity={i % (count / 12) === 0 ? opacity * 1.5 : opacity}
        transform={`rotate(${angle} ${HALF} ${HALF})`}
      />
    );
  }
  return <>{ticks}</>;
}

/** Text along an arc path */
function ArcText({ text, r, startAngle, letterSpacing, fontSize, color, opacity, id }: {
  text: string; r: number; startAngle: number; letterSpacing: number;
  fontSize: number; color: string; opacity: number; id: string;
}) {
  const circumference = 2 * Math.PI * r;
  const arcLength = text.length * letterSpacing;
  const arcAngle = (arcLength / circumference) * 360;
  const actualStart = startAngle - arcAngle / 2;

  return (
    <>
      <defs>
        <path
          id={id}
          d={`M ${HALF},${HALF} m ${-r},0 a ${r},${r} 0 1,1 ${r * 2},0 a ${r},${r} 0 1,1 ${-r * 2},0`}
          fill="none"
        />
      </defs>
      <text
        fill={color}
        fontSize={fontSize}
        fontFamily='"Helvetica Neue", Helvetica, Arial, sans-serif'
        fontWeight={600}
        letterSpacing={letterSpacing}
        opacity={opacity}
      >
        <textPath
          href={`#${id}`}
          startOffset={`${(actualStart / 360) * circumference}px`}
        >
          {text}
        </textPath>
      </text>
    </>
  );
}

export const CentralNode: React.FC<CentralNodeProps> = ({
  pos,
  date,
  focus,
  appearFrame,
  revealFrame,
  textVisible,
  scanOpacity,
}) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - appearFrame);

  const appearSpring = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 20, stiffness: 80, mass: 0.95 },
    from: 0,
    to: 1,
  });
  const scaleSpring = interpolate(appearSpring, [0, 1], [0.9, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  const appearLift = interpolate(appearSpring, [0, 1], [12, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  const appearOpacity = interpolate(localFrame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad),
  });

  const textOpacity = textVisible
    ? interpolate(localFrame, [5, 24], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: RAMP_EASE,
      })
    : 0;

  const nodeOpacity = textVisible ? appearOpacity : appearOpacity * scanOpacity;

  const framesSinceReveal = frame - revealFrame;
  const inRevealPhase = framesSinceReveal >= 0 && framesSinceReveal < 20;

  const flareScale = inRevealPhase ? interpolate(framesSinceReveal, [0, 4, 15], [1, 1.25, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  }) : 1;

  const flashOpacity = inRevealPhase ? interpolate(framesSinceReveal, [0, 2, 10], [0, 1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }) : 0;

  const glowPulse = 0.5 + 0.25 * Math.sin(frame * 0.04);
  const glowSize = 40 + focus * 30 + (inRevealPhase ? flashOpacity * 120 : 0);
  const ringPulse = Math.sin(frame * 0.08) * 0.5 + 0.5;

  // Bezel rotations
  const bezelOuter = frame * 0.15;
  const bezelInner = frame * -0.25;
  const secondHand = frame * 6; // full rotation every 2 seconds

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x - HALF,
        top: pos.y - HALF,
        width: SIZE,
        height: SIZE,
        opacity: nodeOpacity,
        transform: `scale(${scaleSpring * flareScale}) translateY(${appearLift}px)`,
        transformOrigin: "center center",
      }}
    >
      {/* Glow layers */}
      <div
        style={{
          position: "absolute",
          inset: -50,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ORANGE}${Math.round(Math.min(1, glowPulse + flashOpacity) * 35).toString(16).padStart(2, "0")} 0%, transparent 60%)`,
          filter: `blur(${glowSize}px)`,
        }}
      />

      {/* Scan pulse ring */}
      {!textVisible && (
        <div
          style={{
            position: "absolute",
            inset: -8 - ringPulse * 14,
            borderRadius: "50%",
            border: `1.5px solid ${ORANGE}${Math.round(ringPulse * 70).toString(16).padStart(2, "0")}`,
            boxShadow: `0 0 12px ${ORANGE}${Math.round(ringPulse * 30).toString(16).padStart(2, "0")}`,
          }}
        />
      )}

      {/* SVG watch face */}
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {/* Outer bezel — rotating tick marks */}
        <g transform={`rotate(${bezelOuter} ${HALF} ${HALF})`} opacity={textVisible ? 0.5 : 0.2}>
          <Ticks count={60} r={HALF - 6} length={10} width={1} color={ORANGE} opacity={0.5} />
          <Ticks count={12} r={HALF - 6} length={18} width={2} color={ORANGE} opacity={0.9} />
        </g>

        {/* Inner bezel — counter-rotating fine ticks */}
        <g transform={`rotate(${bezelInner} ${HALF} ${HALF})`} opacity={textVisible ? 0.3 : 0.12}>
          <Ticks count={120} r={HALF - 30} length={6} width={0.5} color="#ffffff" opacity={0.3} />
        </g>

        {/* Outer ring */}
        <circle
          cx={HALF} cy={HALF} r={HALF - 3}
          fill="none"
          stroke={ORANGE}
          strokeWidth={1.5}
          opacity={textVisible ? 0.8 : 0.4}
        />
        {/* Secondary ring */}
        <circle
          cx={HALF} cy={HALF} r={HALF - 24}
          fill="none"
          stroke={ORANGE}
          strokeWidth={0.5}
          opacity={0.25}
          strokeDasharray="4 8"
        />

        {/* Arc text — "ELIZAOS" along the top */}
        <g opacity={textOpacity * 0.7}>
          <ArcText
            text="E L I Z A O S"
            r={HALF - 44}
            startAngle={90}
            letterSpacing={14}
            fontSize={11}
            color="rgba(255,255,255,0.5)"
            opacity={1}
            id="arc-top"
          />
        </g>

        {/* Arc text — date along the bottom */}
        <g opacity={textOpacity * 0.5} transform={`scale(1,-1) translate(0,${-SIZE})`}>
          <ArcText
            text={`\u2022  ${date}  \u2022`}
            r={HALF - 44}
            startAngle={90}
            letterSpacing={10}
            fontSize={10}
            color="rgba(255,255,255,0.45)"
            opacity={1}
            id="arc-bottom"
          />
        </g>

        {/* Second hand — thin sweeping line */}
        <g opacity={textVisible ? 0.35 : 0.15}>
          <line
            x1={HALF} y1={HALF}
            x2={HALF} y2={HALF - HALF + 50}
            stroke={ORANGE}
            strokeWidth={1}
            transform={`rotate(${secondHand} ${HALF} ${HALF})`}
            strokeLinecap="round"
          />
          {/* Center pivot dot */}
          <circle cx={HALF} cy={HALF} r={3} fill={ORANGE} opacity={0.8} />
          <circle cx={HALF} cy={HALF} r={6} fill="none" stroke={ORANGE} strokeWidth={0.5} opacity={0.4} />
        </g>
      </svg>

      {/* Watch face background */}
      <div
        style={{
          position: "absolute",
          inset: 24,
          borderRadius: "50%",
          background: `radial-gradient(circle at 42% 38%, rgba(28,34,52,0.97) 0%, rgba(12,16,28,0.99) 45%, rgba(4,6,14,1) 100%)`,
          boxShadow: `inset 0 0 40px rgba(0,0,0,0.6), inset 0 0 15px ${ORANGE}06`,
          zIndex: -1,
        }}
      />

      {/* Flash Overlay */}
      {flashOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 24,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(255,255,255,${flashOpacity}) 0%, rgba(255,200,120,${flashOpacity * 0.5}) 40%, transparent 70%)`,
            zIndex: 10,
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* Scan dot */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: ORANGE,
          boxShadow: `0 0 14px ${ORANGE}, 0 0 30px ${ORANGE}60`,
          opacity: textVisible ? 0 : 1,
          zIndex: 5,
        }}
      />

      {/* Center text */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: textOpacity,
          zIndex: 5,
        }}
      >
        <p
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: "#fff",
            margin: 0,
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            letterSpacing: "4px",
            textAlign: "center",
            textShadow: `0 0 20px ${ORANGE}40, 0 2px 8px rgba(0,0,0,0.7)`,
          }}
        >
          ElizaOS
        </p>
        <p
          style={{
            fontSize: 16,
            color: ORANGE,
            margin: "4px 0 0",
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            letterSpacing: "6px",
            textTransform: "uppercase",
            textAlign: "center",
            textShadow: `0 0 14px ${ORANGE}60`,
          }}
        >
          Daily Briefing
        </p>
        <div
          style={{
            width: 40,
            height: 1.5,
            background: `linear-gradient(90deg, transparent, ${ORANGE}aa, transparent)`,
            margin: "10px auto",
          }}
        />
        <p
          style={{
            fontSize: 18,
            color: ORANGE,
            margin: 0,
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            letterSpacing: "2px",
            textAlign: "center",
            textShadow: `0 0 12px ${ORANGE}40`,
            opacity: 0.8,
          }}
        >
          {date}
        </p>
      </div>
    </div>
  );
};
