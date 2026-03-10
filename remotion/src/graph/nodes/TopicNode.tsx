/**
 * TopicNode — A topic branch node (Key Facts, Development, Community, etc.)
 *
 * During scan phase: glowing colored outline with inner fill.
 * After zoom-in: label and count appear with ramp ease.
 */
import React from "react";
import { interpolate, spring, useCurrentFrame } from "remotion";
import type { NodePos } from "../layout";
import { RAMP_EASE } from "../camera";

interface TopicNodeProps {
  pos: NodePos;
  label: string;
  color: string;
  itemCount: number;
  focus: number;
  appearFrame: number;
  textVisible: boolean;
  scanOpacity: number;
}

export const TopicNode: React.FC<TopicNodeProps> = ({
  pos,
  label,
  color,
  itemCount,
  focus,
  appearFrame,
  textVisible,
  scanOpacity,
}) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - appearFrame);

  const scaleSpring = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 18, stiffness: 160 },
    from: 0.3,
    to: 1,
  });
  const appearOpacity = interpolate(localFrame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
    easing: RAMP_EASE,
  });

  const breathe = Math.sin(frame * 0.025 + pos.x * 0.01) * 3;

  const textOpacity = textVisible
    ? interpolate(localFrame, [0, 18], [0, 1], { extrapolateRight: "clamp", easing: RAMP_EASE })
    : 0;

  const nodeOpacity = textVisible
    ? appearOpacity * (0.25 + focus * 0.75)
    : appearOpacity * scanOpacity;

  const glowSize = 15 + focus * 30;
  const borderAlpha = textVisible ? (focus > 0.3 ? "cc" : "88") : "66";

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x - 110,
        top: pos.y - 60,
        width: 220,
        height: 120,
        opacity: nodeOpacity,
        transform: `scale(${scaleSpring}) translateY(${breathe}px)`,
        transformOrigin: "center center",
      }}
    >
      {/* Glow */}
      <div
        style={{
          position: "absolute",
          inset: -15,
          borderRadius: 22,
          background: `radial-gradient(ellipse, ${color}30 0%, transparent 70%)`,
          filter: `blur(${glowSize}px)`,
        }}
      />
      {/* Card body */}
      <div
        style={{
          width: 220,
          height: 120,
          borderRadius: 16,
          border: `2px solid ${color}${borderAlpha}`,
          backgroundColor: `rgba(12, 16, 28, 0.95)`,
          boxShadow: `0 0 ${12 + focus * 20}px ${color}20, inset 0 0 ${20 + focus * 15}px ${color}08`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {/* Small color dot — always visible, acts as scan indicator */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
            opacity: textVisible ? 0 : 1,
          }}
        />
        {/* Text — hidden during scan */}
        <div style={{ opacity: textOpacity, textAlign: "center" }}>
          <p
            style={{
              fontSize: 18,
              fontWeight: 700,
              color,
              margin: 0,
              fontFamily: "sans-serif",
              letterSpacing: "3px",
              textTransform: "uppercase",
              textShadow: `0 0 12px ${color}60`,
            }}
          >
            {label}
          </p>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "sans-serif",
              marginTop: 4,
            }}
          >
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </div>
        </div>
      </div>
    </div>
  );
};
