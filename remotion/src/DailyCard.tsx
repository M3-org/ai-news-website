/**
 * DailyCard — Node-graph daily briefing composition.
 *
 * Renders an Obsidian-like knowledge graph where the central "ElizaOS Daily"
 * hub connects to topic nodes (Key Facts, Development, Community, Feedback,
 * The Council), each with content card children. The camera pans and zooms
 * between nodes as the video progresses.
 */
import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Item,
  DailyCardProps,
  DailyCardImages,
  DATE_FRAMES,
  computeTotalFrames,
} from "./timing";
import { GraphCanvas, OPENING_FRAMES } from "./graph/GraphCanvas";

export type { Item, DailyCardProps };

const ORANGE = "#FF8A00";

// ─── Root component ──────────────────────────────────────────────────────────

export const DailyCard: React.FC<DailyCardProps> = (props) => {
  const { date, site_url } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = computeTotalFrames(props);

  // HUD elements fade in after opening + date splash
  const hudStart = OPENING_FRAMES + DATE_FRAMES;
  const hudOpacity = interpolate(frame, [hudStart + 10, hudStart + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Outro overlay
  const outroStart = totalFrames - 120;
  const outroOpacity = interpolate(frame, [outroStart + 60, outroStart + 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outroFade = interpolate(frame, [totalFrames - 30, totalFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0e17" }}>
      {/* Graph view — the main visual */}
      <GraphCanvas props={props} />

      {/* ── HUD: Brand bar (top-left, fixed to viewport) ── */}
      <div
        style={{
          position: "absolute",
          top: 36,
          left: 40,
          opacity: hudOpacity,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div style={{ width: 4, height: 44, backgroundColor: ORANGE, flexShrink: 0 }} />
        <div>
          <p
            style={{
              fontSize: 22,
              color: "#fff",
              margin: 0,
              fontWeight: 700,
              letterSpacing: "1px",
              fontFamily: "sans-serif",
            }}
          >
            {date}
          </p>
          <p
            style={{
              fontSize: 14,
              color: ORANGE,
              margin: 0,
              letterSpacing: "3px",
              textTransform: "uppercase",
              fontFamily: "sans-serif",
            }}
          >
            ElizaOS Daily
          </p>
        </div>
      </div>

      {/* ── HUD: Site URL (bottom, fixed to viewport) ── */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: hudOpacity * 0.5,
        }}
      >
        <p
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.4)",
            margin: 0,
            fontFamily: "sans-serif",
            letterSpacing: "2px",
          }}
        >
          {site_url}
        </p>
      </div>

      {/* ── Outro overlay — "Read the full briefing" ── */}
      {frame > outroStart + 50 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: outroOpacity * outroFade,
            background: "radial-gradient(ellipse at center, rgba(10,14,23,0.85) 0%, rgba(10,14,23,0.5) 100%)",
          }}
        >
          <p
            style={{
              fontSize: 20,
              color: "rgba(255,255,255,0.6)",
              margin: "0 0 16px",
              fontFamily: "sans-serif",
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            Read the full briefing
          </p>
          <p
            style={{
              fontSize: 40,
              color: ORANGE,
              margin: 0,
              fontWeight: 700,
              fontFamily: "sans-serif",
            }}
          >
            {site_url}
          </p>
        </div>
      )}

      {/* ── Music ── */}
      <Audio
        src={staticFile("cronjobMusic.mp3")}
        volume={(f) =>
          interpolate(f, [0, 30, totalFrames - 60, totalFrames], [0, 1, 1, 0], {
            extrapolateRight: "clamp",
          })
        }
      />
    </AbsoluteFill>
  );
};
