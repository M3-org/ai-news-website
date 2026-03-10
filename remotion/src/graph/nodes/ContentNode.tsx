/**
 * ContentNode — A content card on the graph (PR, Discord update, fact, etc.)
 *
 * During scan phase: glowing colored outline with subtle inner fill.
 * After zoom-in: content appears with ramp ease.
 */
import React from "react";
import { Img, interpolate, spring, useCurrentFrame } from "remotion";
import { resolveAsset } from "../../resolveAsset";
import type { Item } from "../../timing";
import type { NodePos } from "../layout";
import { RAMP_EASE } from "../camera";

interface ContentNodeProps {
  pos: NodePos;
  item: Item;
  color: string;
  focus: number;
  appearFrame: number;
  textVisible: boolean;
  scanOpacity: number;
}

function cardFontSize(text: string): number {
  const len = text.length;
  if (len < 50) return 24;
  if (len < 80) return 20;
  if (len < 120) return 17;
  return 15;
}

const CARD_W = 360;
const CARD_H = 220;

export const ContentNode: React.FC<ContentNodeProps> = ({
  pos,
  item,
  color,
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
    from: 0.4,
    to: 1,
  });
  const appearOpacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
    easing: RAMP_EASE,
  });

  const breathe = Math.sin(frame * 0.02 + pos.y * 0.008) * 2.5;
  const hasAvatar = !!(item.avatar_url || item.initials);
  const focusScale = 1 + focus * 0.08;

  const textOpacity = textVisible
    ? interpolate(localFrame, [0, 18], [0, 1], { extrapolateRight: "clamp", easing: RAMP_EASE })
    : 0;

  const nodeOpacity = textVisible
    ? appearOpacity * (0.15 + focus * 0.85)
    : appearOpacity * scanOpacity;

  const borderAlpha = textVisible ? (focus > 0.5 ? "bb" : "55") : "44";

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x - CARD_W / 2,
        top: pos.y - CARD_H / 2,
        width: CARD_W,
        height: CARD_H,
        opacity: nodeOpacity,
        transform: `scale(${scaleSpring * focusScale}) translateY(${breathe}px)`,
        transformOrigin: "center center",
      }}
    >
      {/* Glow behind card */}
      <div
        style={{
          position: "absolute",
          inset: -12,
          borderRadius: 20,
          background: `radial-gradient(ellipse, ${color}${focus > 0.3 ? "25" : "12"} 0%, transparent 70%)`,
          filter: `blur(${12 + focus * 18}px)`,
        }}
      />
      {/* Card */}
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 14,
          border: `1.5px solid ${color}${borderAlpha}`,
          backgroundColor: `rgba(12, 16, 28, ${0.92 + focus * 0.05})`,
          boxShadow: `0 0 ${8 + focus * 16}px ${color}15, inset 0 0 ${15 + focus * 10}px ${color}06`,
          display: "flex",
          flexDirection: "column",
          padding: 20,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Color accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 4,
            height: "100%",
            backgroundColor: color,
            borderRadius: "14px 0 0 14px",
            boxShadow: `0 0 10px ${color}60`,
          }}
        />

        {/* Small color dot — scan indicator */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}`,
            opacity: textVisible ? 0 : 0.8,
          }}
        />

        {/* Content — hidden during scan */}
        <div style={{ display: "flex", gap: 14, flex: 1, paddingLeft: 8, opacity: textOpacity }}>
          {hasAvatar && (
            <div style={{ flexShrink: 0, paddingTop: 2 }}>
              {item.avatar_url ? (
                <Img
                  src={resolveAsset(item.avatar_url)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    objectFit: "cover",
                    objectPosition: "top center",
                    border: `2px solid ${color}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    border: `2px solid ${color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: `${color}22`,
                    fontSize: 18,
                    fontWeight: 700,
                    color,
                    fontFamily: "sans-serif",
                  }}
                >
                  {item.initials ?? "?"}
                </div>
              )}
            </div>
          )}

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <p
              style={{
                fontSize: cardFontSize(item.primary),
                color: "#fff",
                margin: 0,
                lineHeight: 1.35,
                fontFamily: "Georgia, serif",
                display: "-webkit-box",
                WebkitLineClamp: 5,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {item.primary}
            </p>
            {item.secondary && (
              <p
                style={{
                  fontSize: 14,
                  color: `${color}bb`,
                  margin: "8px 0 0",
                  fontFamily: "sans-serif",
                  letterSpacing: "0.5px",
                }}
              >
                {item.secondary}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
