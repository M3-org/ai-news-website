/**
 * ContentNode — A content card on the graph (PR, Discord update, fact, etc.)
 *
 * During scan phase: glowing colored outline with subtle inner fill.
 * After zoom-in: content appears.
 * When active: scales up, reveals section background image behind text.
 */
import React from "react";
import { Easing, Img, interpolate, spring, useCurrentFrame } from "remotion";
import { resolveAsset } from "../../resolveAsset";
import type { Item } from "../../timing";
import type { NodePos } from "../layout";

interface ContentNodeProps {
  pos: NodePos;
  item: Item;
  color: string;
  focus: number;
  energy: number;
  appearFrame: number;
  textVisible: boolean;
  scanOpacity: number;
  /** This content node is currently being narrated */
  active: boolean;
  /** This node belongs to the currently active topic */
  inActiveTopic: boolean;
  /** Section background image URL */
  sectionImage: string;
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
const ACTIVE_SCALE = 1.35;
const AVATAR_SIZE = 52;

export const ContentNode: React.FC<ContentNodeProps> = ({
  pos,
  item,
  color,
  focus,
  energy,
  appearFrame,
  textVisible,
  scanOpacity,
  active,
  inActiveTopic,
  sectionImage,
}) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - appearFrame);
  const emphasis = Math.max(0, Math.min(1, energy));

  const appearSpring = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 18, stiffness: 55, mass: 0.9 },
    from: 0,
    to: 1,
  });
  const scaleSpring = interpolate(appearSpring, [0, 1], [0.86, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const appearLift = interpolate(appearSpring, [0, 1], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const appearOpacity = interpolate(localFrame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Floaty multi-axis drift — each card gets unique phase from position
  // Increase drift slightly if active to make it feel more unsettled
  const floatMultiplier = 1 + emphasis * 1.1;
  const floatX = Math.sin(frame * 0.015 + pos.x * 0.004) * 5 * floatMultiplier;
  const floatY = Math.cos(frame * 0.02 + pos.y * 0.006) * 6 * floatMultiplier;
  const floatRot = Math.sin(frame * 0.01 + pos.y * 0.003) * 1.0 * floatMultiplier;
  const hasAvatar = !!(item.avatar_url || item.initials);
  const avatarSpring = spring({
    frame: Math.max(0, localFrame - 2),
    fps: 30,
    config: { damping: 13, stiffness: 150, mass: 0.72 },
    from: 0,
    to: 1,
  });
  const avatarScale = interpolate(avatarSpring, [0, 1], [0.56, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.6)),
  });
  const avatarLift = interpolate(avatarSpring, [0, 1], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const avatarOpacity = interpolate(localFrame, [2, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const avatarBob = Math.cos(frame * 0.021 + pos.y * 0.005) * (0.8 + emphasis * 1.4);
  const avatarTilt = Math.sin(frame * 0.018 + pos.x * 0.003) * (0.9 + emphasis * 1.1);
  const avatarFlashIn = interpolate(localFrame, [4, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const avatarFlashOut = interpolate(localFrame, [10, 20], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const avatarFlash = Math.max(0, Math.min(avatarFlashIn, avatarFlashOut));
  const avatarRingScale = 0.88 + avatarSpring * 0.26 + emphasis * 0.08;
  const avatarGlow = 14 + focus * 12 + emphasis * 20;

  const textOpacity = textVisible
    ? interpolate(localFrame, [4, 24], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      })
    : 0;

  const activeScale = 1 + (ACTIVE_SCALE - 1) * emphasis;
  const imgOpacity = 0.08 + emphasis * 0.46;
  const bgScale = 1.08 + emphasis * 0.1;
  const bgOffsetX = (-floatX * 1.15) + Math.sin(frame * 0.01 + pos.x * 0.002) * 10 * emphasis;
  const bgOffsetY = (-floatY * 1.15) + Math.cos(frame * 0.012 + pos.y * 0.002) * 8 * emphasis;
  const textLift = -12 * emphasis;
  const textScale = 1 + emphasis * 0.05;
  const secondaryLift = -7 * emphasis;
  const titleShadow = 0.35 + emphasis * 0.55;

  // Nodes in active topic but not the active card stay visible but dimmer
  const topicDim = inActiveTopic && !active ? 0.68 : 1;

  const nodeOpacity = textVisible
    ? appearOpacity * (0.18 + focus * 0.62 + emphasis * 0.2) * topicDim
    : appearOpacity * scanOpacity;

  // Brighter border when active
  const borderAlpha = emphasis > 0.78 ? "ff" : textVisible ? (focus > 0.5 ? "bb" : "55") : "44";
  const glowIntensity = 12 + focus * 14 + emphasis * 24;

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x - CARD_W / 2,
        top: pos.y - CARD_H / 2,
        width: CARD_W,
        height: CARD_H,
        opacity: nodeOpacity,
        transform: `scale(${scaleSpring * activeScale}) translate(${floatX}px, ${floatY + appearLift}px) rotate(${floatRot + emphasis * 1.15}deg)`,
        transformOrigin: "center center",
        zIndex: active ? 10 : inActiveTopic ? 6 : 1,
      }}
    >
      {/* Glow behind card */}
      <div
        style={{
          position: "absolute",
          inset: -12,
          borderRadius: 20,
          background: `radial-gradient(ellipse, ${color}${emphasis > 0.72 ? "40" : focus > 0.3 ? "25" : "12"} 0%, transparent 70%)`,
          filter: `blur(${glowIntensity}px)`,
        }}
      />
      {/* Card */}
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 14,
          border: `${1.5 + emphasis * 1.2}px solid ${color}${borderAlpha}`,
          background: `linear-gradient(180deg, rgba(16,21,36,${0.96 - emphasis * 0.18}) 0%, rgba(8,12,22,0.96) 100%)`,
          boxShadow: `0 0 ${8 + focus * 10 + emphasis * 26}px ${color}${Math.round(21 + emphasis * 27)
            .toString(16)
            .padStart(2, "0")}, 0 0 ${6 + emphasis * 18}px ${color}${Math.round(10 + emphasis * 16)
            .toString(16)
            .padStart(2, "0")}, inset 0 0 ${15 + focus * 8 + emphasis * 18}px ${color}${Math.round(6 + emphasis * 10)
            .toString(16)
            .padStart(2, "0")}`,
          display: "flex",
          flexDirection: "column",
          padding: 20,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Background image — revealed when active */}
        {sectionImage && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 14,
              overflow: "hidden",
              opacity: imgOpacity,
            }}
          >
            <Img
              src={resolveAsset(sectionImage)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `translate(${bgOffsetX}px, ${bgOffsetY}px) scale(${bgScale})`,
                filter: `brightness(${0.5 + emphasis * 0.08}) saturate(${1.15 + emphasis * 0.2})`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(180deg, rgba(0,0,0,${0.3 - emphasis * 0.08}) 0%, rgba(0,0,0,0.72) 100%)`,
              }}
            />
          </div>
        )}

        {/* Color accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 4 + emphasis * 2,
            height: "100%",
            backgroundColor: color,
            borderRadius: "14px 0 0 14px",
            boxShadow: `0 0 ${10 + emphasis * 18}px ${color}60`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${color}${Math.round(14 + emphasis * 22)
              .toString(16)
              .padStart(2, "0")} 0%, transparent 45%, transparent 100%)`,
            pointerEvents: "none",
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
        <div style={{ display: "flex", gap: 14, flex: 1, paddingLeft: 8, opacity: textOpacity, position: "relative", zIndex: 1 }}>
          {hasAvatar && (
            <div style={{ flexShrink: 0, paddingTop: 0 }}>
              <div
                style={{
                  position: "relative",
                  width: 60,
                  height: 60,
                  opacity: avatarOpacity,
                  transform: `translateY(${avatarLift + avatarBob}px) scale(${avatarScale}) rotate(${avatarTilt}deg)`,
                  transformOrigin: "center center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: -9,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${color}${Math.round(34 + emphasis * 40)
                      .toString(16)
                      .padStart(2, "0")} 0%, transparent 72%)`,
                    filter: `blur(${avatarGlow}px)`,
                    opacity: 0.56,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: -3,
                    borderRadius: "50%",
                    border: `1.5px solid ${color}${Math.round(128 + emphasis * 70)
                      .toString(16)
                      .padStart(2, "0")}`,
                    transform: `scale(${avatarRingScale})`,
                    opacity: 0.68 + emphasis * 0.18,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: `linear-gradient(145deg, rgba(255,255,255,${0.18 + avatarFlash * 0.24}) 0%, transparent 44%, ${color}${Math.round(10 + emphasis * 18)
                      .toString(16)
                      .padStart(2, "0")} 100%)`,
                    opacity: 0.7,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 4,
                    top: 4,
                    width: AVATAR_SIZE,
                    height: AVATAR_SIZE,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: `2px solid ${color}`,
                    boxShadow: `0 0 ${10 + emphasis * 14}px ${color}66, inset 0 0 ${8 + emphasis * 8}px rgba(255,255,255,0.12)`,
                    background: `${color}18`,
                  }}
                >
              {item.avatar_url ? (
                <Img
                  src={resolveAsset(item.avatar_url)}
                  style={{
                    width: AVATAR_SIZE,
                    height: AVATAR_SIZE,
                    objectFit: "cover",
                    objectPosition: "top center",
                    filter: `saturate(${1.04 + emphasis * 0.12}) brightness(${0.96 + emphasis * 0.06})`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: AVATAR_SIZE,
                    height: AVATAR_SIZE,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.14) 0%, ${color}20 38%, rgba(0,0,0,0.86) 100%)`,
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
                <div
                  style={{
                    position: "absolute",
                    width: 16,
                    height: 16,
                    right: 6,
                    top: 2,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, rgba(255,255,255,${0.52 + avatarFlash * 0.26}) 0%, rgba(255,255,255,0) 72%)`,
                    mixBlendMode: "screen",
                    opacity: 0.68,
                  }}
                />
              </div>
            </div>
          )}

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              position: "relative",
              transform: `translateY(${textLift}px) scale(${textScale})`,
            }}
          >
            {/* Base text */}
            <p
              style={{
                fontSize: cardFontSize(item.primary),
                color: "#fff",
                margin: 0,
                lineHeight: 1.35,
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                fontWeight: 600,
                letterSpacing: "-0.5px",
                display: "-webkit-box",
                WebkitLineClamp: 5,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textShadow: `0 1px ${Math.round(6 + emphasis * 8)}px rgba(0,0,0,${titleShadow})`,
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
                  textShadow: `0 1px ${Math.round(3 + emphasis * 5)}px rgba(0,0,0,${0.35 + emphasis * 0.25})`,
                  transform: `translateY(${secondaryLift}px)`,
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
