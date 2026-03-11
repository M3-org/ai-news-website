/**
 * DailyCard — Node-graph daily briefing composition.
 *
 * Renders an Obsidian-like knowledge graph where the central "ElizaOS Daily"
 * hub connects to topic nodes (Key Facts, Development, Community, Feedback,
 * The Council), each with content card children. The camera pans and zooms
 * between nodes as the video progresses.
 */
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  Item,
  DailyCardProps,
  DATE_FRAMES,
  computeTotalFrames,
  computeScaleFactor,
  wordFrames,
  type FaderConfig,
  type FaderSceneKey,
} from "./timing";
import { GraphCanvas, buildGraphTimeline, resolveGraphCamera, OPENING_FRAMES, getTopicColorForFrame } from "./graph/GraphCanvas";
import { GLBFader } from "./GLBFader";
import { buildFaderSceneBounds } from "./fader";
import { CANVAS_SIZE } from "./graph/layout";

export type { Item, DailyCardProps };

const ORANGE = "#FF8A00";

// ─── Root component ──────────────────────────────────────────────────────────

export const DailyCard: React.FC<DailyCardProps> = (props) => {
  const { date, site_url } = props;
  const frame = useCurrentFrame();

  const totalFrames = computeTotalFrames(props);
  const timeline = useMemo(() => buildGraphTimeline(props), [props]);
  const brandColor = getTopicColorForFrame(props, frame, timeline);
  const graphCam = resolveGraphCamera(frame, timeline).cam;

  // Build fader configs record from props
  const faderConfigs = useMemo<Record<FaderSceneKey, FaderConfig>>(() => ({
    intro: props.fader_intro,
    key_facts: props.fader_key_facts,
    github_prs: props.fader_github_prs,
    discord: props.fader_discord,
    feedback: props.fader_feedback,
    council: props.fader_council,
    outro: props.fader_outro,
  }), [props.fader_intro, props.fader_key_facts, props.fader_github_prs, props.fader_discord, props.fader_feedback, props.fader_council, props.fader_outro]);

  const sceneBounds = useMemo(() => buildFaderSceneBounds(timeline), [timeline]);

  // Headline overlay — fades in at 160, stays until first chapter arrives
  const REVEAL_FRAME = 160;
  const firstChapterFrame = timeline.segs.find((s) => s.type === "chapter")?.from ?? 999;
  const headlineIn = interpolate(frame, [REVEAL_FRAME, REVEAL_FRAME + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineOut = interpolate(frame, [firstChapterFrame - 10, firstChapterFrame + 20], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineOpacity = headlineIn * headlineOut;
  const headlineY = interpolate(frame, [REVEAL_FRAME, REVEAL_FRAME + 18], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Section label — build spans from chapter segments
  const sectionSpans = useMemo(() => {
    const chapters = timeline.segs.filter((s) => s.type === "chapter");
    return chapters.map((ch, i) => {
      const topic = timeline.layout.topics[ch.topicIdx];
      const nextChapter = chapters[i + 1];
      const outro = timeline.segs.find((s) => s.type === "outro");
      const end = nextChapter?.from ?? outro?.from ?? timeline.totalFrames;
      return { from: ch.from, end, label: topic?.label ?? "", color: topic?.color ?? ORANGE };
    });
  }, [timeline]);

  // Find current section and compute animation
  const activeSection = sectionSpans.find((s) => frame >= s.from && frame < s.end);
  const sectionIn = activeSection
    ? interpolate(frame, [activeSection.from, activeSection.from + 18], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
      })
    : 0;
  const sectionOut = activeSection
    ? interpolate(frame, [activeSection.end - 12, activeSection.end], [1, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic),
      })
    : 0;
  const sectionOpacity = sectionIn * sectionOut;
  const sectionSlideX = activeSection
    ? interpolate(frame, [activeSection.from, activeSection.from + 16], [80, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.4)),
      })
    : 80;
  const sectionLineW = activeSection
    ? interpolate(frame, [activeSection.from + 4, activeSection.from + 22], [0, 50], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
      })
    : 0;

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
    <AbsoluteFill style={{ backgroundColor: "#0a0612" }}>
      {/* 3D background — per-scene GLB fader */}
      <GLBFader
        configs={faderConfigs}
        sceneBounds={sceneBounds}
        graphCamera={graphCam}
        graphCameraCenter={CANVAS_SIZE / 2}
      />

      {/* Graph view — the main visual */}
      <GraphCanvas props={props} />

      {/* ── Headline overlay — shown during intro segment ── */}
      {headlineOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: 72,
            right: 72,
            bottom: 160,
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: props.headline.length < 55 ? 42 : props.headline.length < 90 ? 36 : 30,
              color: "#fff",
              margin: 0,
              lineHeight: 1.3,
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              fontWeight: 600,
              letterSpacing: "-0.5px",
              textShadow: `0 2px 20px rgba(0,0,0,0.7), 0 0 40px ${ORANGE}30`,
            }}
          >
            {props.headline}
          </p>
          <div
            style={{
              width: 60,
              height: 3,
              backgroundColor: ORANGE,
              margin: "20px auto 0",
              boxShadow: `0 0 12px ${ORANGE}60`,
              opacity: 0.7,
            }}
          />
        </div>
      )}

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
        <div style={{ width: 4, height: 44, backgroundColor: brandColor, boxShadow: `0 0 14px ${brandColor}66`, flexShrink: 0 }} />
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
              color: brandColor,
              margin: 0,
              letterSpacing: "3px",
              textTransform: "uppercase",
              fontFamily: "sans-serif",
              textShadow: `0 0 16px ${brandColor}55`,
            }}
          >
            ElizaOS Daily
          </p>
        </div>
      </div>

      {/* ── HUD: Section label (bottom-right) ── */}
      {activeSection && sectionOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            bottom: 56,
            right: 40,
            opacity: sectionOpacity,
            transform: `translateX(${sectionSlideX}px)`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: sectionLineW,
              height: 2.5,
              backgroundColor: activeSection.color,
              boxShadow: `0 0 14px ${activeSection.color}80, 0 0 30px ${activeSection.color}30`,
              borderRadius: 2,
            }}
          />
          <p
            style={{
              fontSize: 16,
              color: activeSection.color,
              margin: 0,
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              fontWeight: 700,
              letterSpacing: "5px",
              textTransform: "uppercase",
              textShadow: `0 0 20px ${activeSection.color}50`,
              whiteSpace: "nowrap",
            }}
          >
            {activeSection.label}
          </p>
        </div>
      )}

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
            background: "radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 100%)",
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
