/**
 * TopicNode — A topic branch node (Key Facts, Development, Community, etc.)
 *
 * During scan phase: glowing colored outline with inner fill.
 * After zoom-in: label and count appear with ramp ease.
 */
import React from "react";
import { Easing, interpolate, spring, useCurrentFrame } from "remotion";
import type { NodePos } from "../layout";

interface TopicNodeProps {
  pos: NodePos;
  label: string;
  color: string;
  itemCount: number;
  focus: number;
  energy: number;
  appearFrame: number;
  textVisible: boolean;
  scanOpacity: number;
  /** This topic's chapter card is currently showing */
  active?: boolean;
}

export const TopicNode: React.FC<TopicNodeProps> = ({
  pos,
  label,
  color,
  itemCount,
  focus,
  energy,
  appearFrame,
  textVisible,
  scanOpacity,
  active = false,
}) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - appearFrame);
  const emphasis = Math.max(0, Math.min(1, energy));

  const appearSpring = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 18, stiffness: 58, mass: 0.9 },
    from: 0,
    to: 1,
  });
  const scaleSpring = interpolate(appearSpring, [0, 1], [0.88, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const appearLift = interpolate(appearSpring, [0, 1], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const appearOpacity = interpolate(localFrame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Floaty multi-axis drift
  const floatX = Math.sin(frame * 0.018 + pos.x * 0.005) * 4;
  const floatY = Math.cos(frame * 0.022 + pos.y * 0.007) * 5;
  const floatRot = Math.sin(frame * 0.012 + pos.x * 0.003) * 0.8;

  const textOpacity = textVisible
    ? interpolate(localFrame, [4, 24], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      })
    : 0;

  const nodeOpacity = textVisible
    ? appearOpacity * (0.22 + focus * 0.58 + emphasis * 0.2)
    : appearOpacity * scanOpacity;

  const glowSize = 15 + focus * 22 + emphasis * 22;
  const borderAlpha = emphasis > 0.75 ? "ff" : textVisible ? (focus > 0.3 ? "cc" : "88") : "66";
  const textLift = -10 * emphasis;
  const labelScale = 1 + emphasis * 0.08;
  const orbitX = Math.sin(frame * 0.014 + pos.y * 0.002) * 6 * emphasis;
  const orbitY = Math.cos(frame * 0.017 + pos.x * 0.002) * 4 * emphasis;

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x - 110,
        top: pos.y - 60,
        width: 220,
        height: 120,
        opacity: nodeOpacity,
        transform: `scale(${scaleSpring * (1 + emphasis * 0.14)}) translate(${floatX + orbitX}px, ${floatY + orbitY + appearLift}px) rotate(${floatRot + emphasis * 0.6}deg)`,
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
          background: `linear-gradient(180deg, rgba(18,24,40,${0.98 - emphasis * 0.08}) 0%, rgba(10,14,26,0.96) 100%)`,
          boxShadow: `0 0 ${12 + focus * 12 + emphasis * 16}px ${color}20, inset 0 0 ${20 + focus * 10 + emphasis * 12}px ${color}08`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${color}${Math.round(32 + emphasis * 24)
              .toString(16)
              .padStart(2, "0")} 0%, transparent 40%, transparent 100%)`,
            opacity: 0.55,
          }}
        />
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
        <div style={{ opacity: textOpacity, textAlign: "center", transform: `translateY(${textLift}px) scale(${labelScale})`, position: "relative", zIndex: 1 }}>
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
