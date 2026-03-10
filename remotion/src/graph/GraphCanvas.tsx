/**
 * GraphCanvas — Assembles all graph nodes, connection lines, and applies
 * the camera transform. This is the main visual layer of the node-graph DailyCard.
 *
 * Opening sequence:
 *   1. Overview scan — lines draw in, nodes appear (no text), initialization feel
 *   2. Nodes fade out briefly
 *   3. Aggressive ramp zoom into center "ElizaOS Daily" hub
 *   4. Text becomes visible — content phase begins
 */
import React, { useMemo } from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { CANVAS_SIZE, computeGraphLayout, type GraphLayout, type NodePos } from "./layout";
import {
  interpolateCamera,
  cameraTransform,
  targetNode,
  ZOOM,
  RAMP_EASE,
  type CameraKeyframe,
  type CameraTarget,
} from "./camera";
import { DotGrid } from "./DotGrid";
import { ConnectionLines } from "./ConnectionLines";
import { CentralNode } from "./nodes/CentralNode";
import { TopicNode } from "./nodes/TopicNode";
import { ContentNode } from "./nodes/ContentNode";
import type { DailyCardProps, Item } from "../timing";
import { DATE_FRAMES, CHAPTER_FRAMES, OUTRO_FRAMES, OPENING_FRAMES, wordFrames, computeScaleFactor } from "../timing";

// ── Opening timing ───────────────────────────────────────────────────────────

/** Frames for the scan/reveal phase (nodes appear, no text) */
const SCAN_FRAMES = 50;
/** Frames for nodes to fade out after scan */
const FADE_OUT_FRAMES = 12;
/** Frame at which text becomes visible (after zoom lands) */
const TEXT_APPEAR_FRAME = OPENING_FRAMES;

// ── Segment types ────────────────────────────────────────────────────────────

type SegType =
  | "date"
  | "intro"
  | "chapter"
  | "key_fact"
  | "github_pr"
  | "discord"
  | "feedback"
  | "council_focus"
  | "council_topic"
  | "council_question"
  | "outro";

interface Seg {
  from: number;
  dur: number;
  type: SegType;
  topicIdx: number;
  contentIdx: number;
}

// ── Build segments + camera keyframes ────────────────────────────────────────

interface GraphTimeline {
  segs: Seg[];
  keyframes: CameraKeyframe[];
  totalFrames: number;
  layout: GraphLayout;
}

function buildGraphTimeline(props: DailyCardProps): GraphTimeline {
  const layout = computeGraphLayout(props);
  const scale = computeScaleFactor(props);
  const wf = (text: string) => Math.round(wordFrames(text) * scale);

  const segs: Seg[] = [];
  const keyframes: CameraKeyframe[] = [];
  let cursor = 0;

  const topicByKey = (key: string) => layout.topics.findIndex((t) => t.key === key);

  // ── Opening: scan overview ──
  // Camera starts at overview, holds during scan
  keyframes.push({ frame: 0, target: targetNode(layout.center, ZOOM.overview) });
  // After scan + fade, aggressive ramp zoom into hub
  keyframes.push({ frame: SCAN_FRAMES + FADE_OUT_FRAMES, target: targetNode(layout.center, ZOOM.overview) });
  keyframes.push({ frame: OPENING_FRAMES, target: targetNode(layout.center, ZOOM.hub) });

  // Date splash starts after opening
  cursor = OPENING_FRAMES;
  segs.push({ from: cursor, dur: DATE_FRAMES, type: "date", topicIdx: -1, contentIdx: -1 });
  cursor += DATE_FRAMES;

  // ── Intro (headline) — slight pull back ──
  const introDur = wf(props.headline);
  segs.push({ from: cursor, dur: introDur, type: "intro", topicIdx: -1, contentIdx: -1 });
  keyframes.push({ frame: cursor, target: targetNode(layout.center, ZOOM.hub - 0.05) });
  cursor += introDur;

  // ── Key Facts ──
  const kfIdx = topicByKey("key_facts");
  if (kfIdx >= 0) {
    const topic = layout.topics[kfIdx];
    segs.push({ from: cursor, dur: CHAPTER_FRAMES, type: "chapter", topicIdx: kfIdx, contentIdx: -1 });
    keyframes.push({ frame: cursor, target: targetNode(topic.pos, ZOOM.topic) });
    cursor += CHAPTER_FRAMES;
    for (let i = 0; i < props.key_facts.length; i++) {
      const dur = wf(props.key_facts[i]);
      segs.push({ from: cursor, dur, type: "key_fact", topicIdx: kfIdx, contentIdx: i });
      keyframes.push({ frame: cursor, target: targetNode(topic.items[i].pos, ZOOM.content) });
      cursor += dur;
    }
  }

  // ── Development (GitHub PRs) ──
  const ghIdx = topicByKey("github_prs");
  if (ghIdx >= 0) {
    const topic = layout.topics[ghIdx];
    segs.push({ from: cursor, dur: CHAPTER_FRAMES, type: "chapter", topicIdx: ghIdx, contentIdx: -1 });
    keyframes.push({ frame: cursor, target: targetNode(topic.pos, ZOOM.topic) });
    cursor += CHAPTER_FRAMES;
    for (let i = 0; i < props.github_prs.length; i++) {
      const dur = wf(props.github_prs[i].primary);
      segs.push({ from: cursor, dur, type: "github_pr", topicIdx: ghIdx, contentIdx: i });
      keyframes.push({ frame: cursor, target: targetNode(topic.items[i].pos, ZOOM.content) });
      cursor += dur;
    }
  }

  // ── Community (Discord) ──
  const dcIdx = topicByKey("discord");
  if (dcIdx >= 0) {
    const topic = layout.topics[dcIdx];
    segs.push({ from: cursor, dur: CHAPTER_FRAMES, type: "chapter", topicIdx: dcIdx, contentIdx: -1 });
    keyframes.push({ frame: cursor, target: targetNode(topic.pos, ZOOM.topic) });
    cursor += CHAPTER_FRAMES;
    for (let i = 0; i < props.discord_updates.length; i++) {
      const dur = wf(props.discord_updates[i].primary);
      segs.push({ from: cursor, dur, type: "discord", topicIdx: dcIdx, contentIdx: i });
      keyframes.push({ frame: cursor, target: targetNode(topic.items[i].pos, ZOOM.content) });
      cursor += dur;
    }
  }

  // ── Feedback ──
  const fbIdx = topicByKey("feedback");
  if (fbIdx >= 0) {
    const topic = layout.topics[fbIdx];
    segs.push({ from: cursor, dur: CHAPTER_FRAMES, type: "chapter", topicIdx: fbIdx, contentIdx: -1 });
    keyframes.push({ frame: cursor, target: targetNode(topic.pos, ZOOM.topic) });
    cursor += CHAPTER_FRAMES;
    for (let i = 0; i < props.user_feedback.length; i++) {
      const dur = wf(props.user_feedback[i].primary);
      segs.push({ from: cursor, dur, type: "feedback", topicIdx: fbIdx, contentIdx: i });
      keyframes.push({ frame: cursor, target: targetNode(topic.items[i].pos, ZOOM.content) });
      cursor += dur;
    }
  }

  // ── Council ──
  const coIdx = topicByKey("council");
  if (coIdx >= 0) {
    const topic = layout.topics[coIdx];
    segs.push({ from: cursor, dur: CHAPTER_FRAMES, type: "chapter", topicIdx: coIdx, contentIdx: -1 });
    keyframes.push({ frame: cursor, target: targetNode(topic.pos, ZOOM.topic) });
    cursor += CHAPTER_FRAMES;

    let contentI = 0;
    if (props.council_focus) {
      const dur = wf(props.council_focus);
      segs.push({ from: cursor, dur, type: "council_focus", topicIdx: coIdx, contentIdx: contentI });
      keyframes.push({ frame: cursor, target: targetNode(topic.items[contentI].pos, ZOOM.content) });
      cursor += dur;
      contentI++;
    }
    for (const t of props.council_topics) {
      const dur = wf(t.primary);
      segs.push({ from: cursor, dur, type: "council_topic", topicIdx: coIdx, contentIdx: contentI });
      keyframes.push({ frame: cursor, target: targetNode(topic.items[contentI].pos, ZOOM.content) });
      cursor += dur;
      contentI++;
    }
    for (const q of props.council_questions) {
      const dur = wf(q.primary);
      segs.push({ from: cursor, dur, type: "council_question", topicIdx: coIdx, contentIdx: contentI });
      keyframes.push({ frame: cursor, target: targetNode(topic.items[contentI].pos, ZOOM.content) });
      cursor += dur;
      contentI++;
    }
  }

  // ── Outro ──
  segs.push({ from: cursor, dur: OUTRO_FRAMES, type: "outro", topicIdx: -1, contentIdx: -1 });
  keyframes.push({ frame: cursor, target: targetNode(layout.center, ZOOM.overview) });

  return { segs, keyframes, totalFrames: cursor + OUTRO_FRAMES, layout };
}

// ── Focus computation ────────────────────────────────────────────────────────

function distanceBetween(a: NodePos, b: NodePos): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function nodeFocus(nodePos: NodePos, cameraTarget: CameraTarget): number {
  const dist = distanceBetween(nodePos, { x: cameraTarget.x, y: cameraTarget.y });
  const radius = 600 / cameraTarget.zoom;
  return Math.max(0, Math.min(1, 1 - dist / radius));
}

// ── Component ────────────────────────────────────────────────────────────────

interface GraphCanvasProps {
  props: DailyCardProps;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({ props }) => {
  const frame = useCurrentFrame();

  const timeline = useMemo(() => buildGraphTimeline(props), [props]);
  const { layout, keyframes } = timeline;

  const cam = interpolateCamera(frame, keyframes);
  const { translateX, translateY, scale: camScale } = cameraTransform(cam, 1080);

  // ── Opening phase logic ──

  // During scan (0 → SCAN_FRAMES): nodes appear, no text
  // Fade out (SCAN_FRAMES → SCAN_FRAMES + FADE_OUT_FRAMES): nodes dim
  // Zoom in (→ OPENING_FRAMES): aggressive ramp into center, then text on

  const textVisible = frame >= TEXT_APPEAR_FRAME;

  // Scan progress: 0→1 during scan phase (nodes expand outward from center)
  const scanProgress = interpolate(
    frame,
    [0, SCAN_FRAMES],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: RAMP_EASE },
  );

  // Scan node visibility: appear during scan, fade out, come back after zoom
  const scanNodeOpacity = interpolate(
    frame,
    [
      0,                              // start invisible
      6,                              // quickly appear
      SCAN_FRAMES,                    // fully visible at scan end
      SCAN_FRAMES + FADE_OUT_FRAMES,  // fade out
      OPENING_FRAMES - 4,             // still faded
      OPENING_FRAMES + 8,             // come back with ramp
    ],
    [0, 0.8, 0.9, 0.03, 0.03, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // During scan, nodes expand from center. After scan, they're at final positions.
  const expandFactor = textVisible ? 1 : scanProgress;

  /** Compute position with scan expansion — nodes radiate out from center */
  const expandedPos = (pos: NodePos): NodePos => {
    if (expandFactor >= 1) return pos;
    const dx = pos.x - layout.center.x;
    const dy = pos.y - layout.center.y;
    return {
      x: layout.center.x + dx * expandFactor,
      y: layout.center.y + dy * expandFactor,
    };
  };

  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Canvas — transformed by camera */}
      <div
        style={{
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
          position: "absolute",
          transformOrigin: "0 0",
          transform: `translate(${translateX}px, ${translateY}px) scale(${camScale})`,
          willChange: "transform",
        }}
      >
        <DotGrid />

        {/* Phase 1: Lines + dots draw first (frame 0+) */}
        <ConnectionLines layout={layout} buildStartFrame={0} expandFactor={expandFactor} />

        {/* Phase 2: Central hub appears after lines start reaching out (frame 12+) */}
        <CentralNode
          pos={layout.center}
          date={props.date}
          focus={nodeFocus(layout.center, cam)}
          appearFrame={12}
          textVisible={textVisible}
          scanOpacity={scanNodeOpacity}
        />

        {/* Phase 3: Topic boxes pop in after their connection line lands (frame 20+) */}
        {layout.topics.map((topic, ti) => (
          <TopicNode
            key={topic.key}
            pos={expandedPos(topic.pos)}
            label={topic.label}
            color={topic.color}
            itemCount={topic.items.length}
            focus={nodeFocus(topic.pos, cam)}
            appearFrame={20 + ti * 5}
            textVisible={textVisible}
            scanOpacity={scanNodeOpacity}
          />
        ))}

        {/* Phase 4: Content cards pop in last (frame 30+) */}
        {layout.topics.map((topic, ti) =>
          topic.items.map((content, ci) => (
            <ContentNode
              key={`${topic.key}-${ci}`}
              pos={expandedPos(content.pos)}
              item={content.item}
              color={topic.color}
              focus={nodeFocus(content.pos, cam)}
              appearFrame={30 + ti * 4 + ci * 3}
              textVisible={textVisible}
              scanOpacity={scanNodeOpacity}
            />
          )),
        )}
      </div>

      {/* Vignette overlay — fixed to viewport */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(10, 14, 23, 0.6) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

// Re-export for use in DailyCard
export { buildGraphTimeline, type GraphTimeline, OPENING_FRAMES };
