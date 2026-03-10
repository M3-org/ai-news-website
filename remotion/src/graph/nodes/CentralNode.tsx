/**
 * CentralNode — The "ElizaOS Daily" hub at the center of the graph.
 *
 * During scan phase: glowing circle with pulsing ring, no text.
 * After zoom-in: text appears with ramp ease.
 */
import React from "react";
import { Easing, interpolate, spring, useCurrentFrame } from "remotion";
import type { NodePos } from "../layout";
import { RAMP_EASE } from "../camera";

const ORANGE = "#FF8A00";

interface CentralNodeProps {
  pos: NodePos;
  date: string;
  focus: number;
  appearFrame: number;
  textVisible: boolean;
  scanOpacity: number;
}

export const CentralNode: React.FC<CentralNodeProps> = ({
  pos,
  date,
  focus,
  appearFrame,
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
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const appearLift = interpolate(appearSpring, [0, 1], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const appearOpacity = interpolate(localFrame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const textOpacity = textVisible
    ? interpolate(localFrame, [5, 24], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: RAMP_EASE,
      })
    : 0;

  const nodeOpacity = textVisible
    ? appearOpacity
    : appearOpacity * scanOpacity;

  const glowPulse = 0.5 + 0.25 * Math.sin(frame * 0.04);
  const glowSize = 35 + focus * 25;

  // Pulsing ring during scan
  const ringPulse = Math.sin(frame * 0.08) * 0.5 + 0.5;

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x - 130,
        top: pos.y - 130,
        width: 260,
        height: 260,
        opacity: nodeOpacity,
        transform: `scale(${scaleSpring}) translateY(${appearLift}px)`,
        transformOrigin: "center center",
      }}
    >
      {/* Outer glow */}
      <div
        style={{
          position: "absolute",
          inset: -30,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ORANGE}${Math.round(glowPulse * 50).toString(16).padStart(2, "0")} 0%, transparent 65%)`,
          filter: `blur(${glowSize}px)`,
        }}
      />
      {/* Scan pulse ring — visible only during scan */}
      {!textVisible && (
        <div
          style={{
            position: "absolute",
            inset: -8 - ringPulse * 12,
            borderRadius: "50%",
            border: `1px solid ${ORANGE}${Math.round(ringPulse * 60).toString(16).padStart(2, "0")}`,
          }}
        />
      )}
      {/* Main circle */}
      <div
        style={{
          width: 260,
          height: 260,
          borderRadius: "50%",
          border: `3px solid ${ORANGE}${textVisible ? "cc" : "88"}`,
          backgroundColor: "rgba(12, 16, 28, 0.95)",
          boxShadow: `0 0 ${20 + focus * 25}px ${ORANGE}25, inset 0 0 30px ${ORANGE}08`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {/* Scan dot — visible only during scan */}
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: ORANGE,
            boxShadow: `0 0 12px ${ORANGE}`,
            opacity: textVisible ? 0 : 1,
            position: "absolute",
          }}
        />
        {/* Text content — hidden during scan */}
        <div style={{ opacity: textOpacity }}>
          <div style={{ width: 50, height: 3, backgroundColor: ORANGE, margin: "0 auto 8px", boxShadow: `0 0 8px ${ORANGE}60` }} />
          <p
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#fff",
              margin: 0,
              fontFamily: "sans-serif",
              letterSpacing: "2px",
              textAlign: "center",
              textShadow: `0 0 15px ${ORANGE}40`,
            }}
          >
            ElizaOS
          </p>
          <p
            style={{
              fontSize: 17,
              color: ORANGE,
              margin: "4px 0",
              fontFamily: "sans-serif",
              letterSpacing: "4px",
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            Daily
          </p>
          <div style={{ width: 50, height: 3, backgroundColor: ORANGE, margin: "0 auto", boxShadow: `0 0 8px ${ORANGE}60` }} />
          <p
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.6)",
              margin: "8px 0 0",
              fontFamily: "sans-serif",
              letterSpacing: "1px",
              textAlign: "center",
            }}
          >
            {date}
          </p>
        </div>
      </div>
    </div>
  );
};
