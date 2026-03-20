/**
 * Graph timeline builder — constructs segments and camera keyframes
 * from DailyCardProps. Extracted from GraphCanvas.tsx.
 */
import { type NodePos } from "./layout";
import {
  targetNode,
  ZOOM,
  type CameraKeyframe,
} from "./camera";
import type { DailyCardProps } from "../timing";
import { DATE_FRAMES, CHAPTER_FRAMES, OUTRO_FRAMES, OPENING_FRAMES, wordFrames, computeScaleFactor } from "../timing";
import { computeGraphLayout, type GraphLayout } from "./layout";

// ── Segment types ────────────────────────────────────────────────────────────

export type SegType =
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

export interface Seg {
  from: number;
  dur: number;
  type: SegType;
  topicIdx: number;
  contentIdx: number;
}

export interface GraphTimeline {
  segs: Seg[];
  keyframes: CameraKeyframe[];
  totalFrames: number;
  layout: GraphLayout;
}

// ── Opening timing ───────────────────────────────────────────────────────────

/** Frames for the scan/reveal phase (nodes appear, no text) */
export const SCAN_FRAMES = 35;
/** Frames for nodes to fade out after scan */
export const FADE_OUT_FRAMES = 8;

// ── Builder ──────────────────────────────────────────────────────────────────

export function buildGraphTimeline(props: DailyCardProps): GraphTimeline {
  const layout = computeGraphLayout(props);
  const scale = computeScaleFactor(props);
  const wf = (text: string) => Math.round(wordFrames(text) * scale);

  const segs: Seg[] = [];
  const keyframes: CameraKeyframe[] = [];
  let cursor = 0;

  const topicByKey = (key: string) => layout.topics.findIndex((t) => t.key === key);

  // ── Opening: scan overview ──
  keyframes.push({ frame: 0, target: targetNode(layout.center, ZOOM.overview) });
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

  // ── Helper: build a topic section with travel transition ──
  function buildTopicSection(
    topicKey: string,
    items: { primary: string }[],
    segTypes: SegType[],
  ) {
    const idx = topicByKey(topicKey);
    if (idx < 0) return;
    const topic = layout.topics[idx];

    // Chapter title — camera arrives at topic area
    segs.push({ from: cursor, dur: CHAPTER_FRAMES, type: "chapter", topicIdx: idx, contentIdx: -1 });
    keyframes.push({ frame: cursor, target: targetNode(topic.pos, ZOOM.topic) });
    cursor += CHAPTER_FRAMES;

    // All content items — camera stays floating in topic area
    const sectionStart = cursor;
    let sectionDur = 0;
    for (let i = 0; i < items.length; i++) {
      const dur = wf(items[i].primary);
      const segType = segTypes[Math.min(i, segTypes.length - 1)];
      segs.push({ from: cursor, dur, type: segType, topicIdx: idx, contentIdx: i });
      sectionDur += dur;
      cursor += dur;
    }

    // Camera holds at topic area for entire content section
    if (sectionDur > 0) {
      keyframes.push({ frame: sectionStart, target: targetNode(topic.pos, ZOOM.topic) });
      keyframes.push({ frame: cursor, target: targetNode(topic.pos, ZOOM.topic) });
    }
  }

  // ── Key Facts ──
  buildTopicSection("key_facts", props.key_facts.map((f) => ({ primary: f })), ["key_fact"]);

  // ── Development (GitHub PRs) ──
  buildTopicSection("github_prs", props.github_prs, ["github_pr"]);

  // ── Community (Discord) ──
  buildTopicSection("discord", props.discord_updates, ["discord"]);

  // ── Feedback ──
  buildTopicSection("feedback", props.user_feedback, ["feedback"]);

  // ── Council ──
  buildCouncilSection(props, layout, topicByKey, wf, segs, keyframes, () => cursor, (v) => { cursor = v; });

  // ── Outro: zoom out with travel feel ──
  segs.push({ from: cursor, dur: OUTRO_FRAMES, type: "outro", topicIdx: -1, contentIdx: -1 });
  keyframes.push({ frame: cursor, target: targetNode(layout.center, ZOOM.hub - 0.05) });
  keyframes.push({ frame: cursor + 40, target: targetNode(layout.center, 0.34) });
  keyframes.push({ frame: cursor + 80, target: targetNode(layout.center, ZOOM.overview) });

  return { segs, keyframes, totalFrames: cursor + OUTRO_FRAMES, layout };
}

// ── Council section builder ──────────────────────────────────────────────────

function buildCouncilSection(
  props: DailyCardProps,
  layout: GraphLayout,
  topicByKey: (key: string) => number,
  wf: (text: string) => number,
  segs: Seg[],
  keyframes: CameraKeyframe[],
  getCursor: () => number,
  setCursor: (v: number) => void,
) {
  const coIdx = topicByKey("council");
  if (coIdx < 0) return;
  const topic = layout.topics[coIdx];
  let cursor = getCursor();

  segs.push({ from: cursor, dur: CHAPTER_FRAMES, type: "chapter", topicIdx: coIdx, contentIdx: -1 });
  keyframes.push({ frame: cursor, target: targetNode(topic.pos, ZOOM.topic) });
  cursor += CHAPTER_FRAMES;

  const sectionStart = cursor;
  let contentI = 0;
  if (props.council_focus) {
    const dur = wf(props.council_focus);
    segs.push({ from: cursor, dur, type: "council_focus", topicIdx: coIdx, contentIdx: contentI });
    cursor += dur;
    contentI++;
  }
  for (const t of props.council_topics) {
    const dur = wf(t.primary);
    segs.push({ from: cursor, dur, type: "council_topic", topicIdx: coIdx, contentIdx: contentI });
    cursor += dur;
    contentI++;
  }
  for (const q of props.council_questions) {
    const dur = wf(q.primary);
    segs.push({ from: cursor, dur, type: "council_question", topicIdx: coIdx, contentIdx: contentI });
    cursor += dur;
    contentI++;
  }
  if (cursor > sectionStart) {
    keyframes.push({ frame: sectionStart, target: targetNode(topic.pos, ZOOM.topic) });
    keyframes.push({ frame: cursor, target: targetNode(topic.pos, ZOOM.topic) });
  }

  setCursor(cursor);
}
