/**
 * GraphCanvas — Assembles all graph nodes, connection lines, and applies
 * the camera transform. This is the main visual layer of the node-graph DailyCard.
 *
 * Opening sequence:
 *   1. Overview scan — lines draw in, nodes appear (no text), initialization feel
 *   2. Nodes fade out briefly
 *   3. Aggressive ramp zoom into center "ElizaOS Daily" hub
 *   4. Text becomes visible — content phase begins
 *
 * Content phase:
 *   Camera floats around each topic's area while content nodes
 *   activate one-by-one (scale up + show background image).
 *   Between sections, camera zooms out to mid-overview then into next topic.
 *   Active content nodes magnetize the camera slightly toward them.
 */
import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
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
import { DotGrid, type GlowSpot } from "./DotGrid";
import { ConnectionLines } from "./ConnectionLines";
import { CentralNode } from "./nodes/CentralNode";
import { TopicNode } from "./nodes/TopicNode";
import { ContentNode } from "./nodes/ContentNode";
import type { DailyCardProps, DailyCardImages, Item } from "../timing";
import { DATE_FRAMES, CHAPTER_FRAMES, OUTRO_FRAMES, OPENING_FRAMES, wordFrames, computeScaleFactor } from "../timing";

// ── Opening timing ───────────────────────────────────────────────────────────

/** Frames for the scan/reveal phase (nodes appear, no text) */
const SCAN_FRAMES = 35;
/** Frames for nodes to fade out after scan */
const FADE_OUT_FRAMES = 8;

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

// ── Image mapping ────────────────────────────────────────────────────────────

function imageForTopic(topicKey: string, images: DailyCardImages): string {
  if (topicKey === "github_prs") return images.github;
  if (topicKey === "discord") return images.discord;
  if (topicKey === "feedback") return images.discord;
  if (topicKey === "key_facts") return images.market;
  if (topicKey === "council") return images.strategic;
  return images.overall;
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
  const coIdx = topicByKey("council");
  if (coIdx >= 0) {
    const topic = layout.topics[coIdx];

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
  }

  // ── Outro: zoom out with travel feel ──
  segs.push({ from: cursor, dur: OUTRO_FRAMES, type: "outro", topicIdx: -1, contentIdx: -1 });
  // Gradual pull-out to overview
  keyframes.push({ frame: cursor, target: targetNode(layout.center, ZOOM.hub - 0.05) });
  keyframes.push({ frame: cursor + 40, target: targetNode(layout.center, 0.34) });
  keyframes.push({ frame: cursor + 80, target: targetNode(layout.center, ZOOM.overview) });

  return { segs, keyframes, totalFrames: cursor + OUTRO_FRAMES, layout };
}

// ── Active segment lookup ───────────────────────────────────────────────────

function findActiveSeg(frame: number, segs: Seg[]): Seg | null {
  for (const seg of segs) {
    if (frame >= seg.from && frame < seg.from + seg.dur) {
      return seg;
    }
  }
  return null;
}

function segmentWeightAtFrame(
  frame: number,
  seg: Seg,
  softness: number,
  minSigma: number,
): number {
  const mid = seg.from + seg.dur / 2;
  const sigma = Math.max(minSigma, seg.dur * softness);
  const u = (frame - mid) / sigma;
  return Math.exp(-0.5 * u * u);
}

function smoothstep01(v: number): number {
  const x = Math.max(0, Math.min(1, v));
  return x * x * (3 - 2 * x);
}

function aggressiveSCurve01(v: number): number {
  const x = clamp01(v);
  const strength = 8.5;
  const sigmoid = (t: number) => 1 / (1 + Math.exp(-strength * (t - 0.5)));
  const low = sigmoid(0);
  const high = sigmoid(1);
  return (sigmoid(x) - low) / (high - low);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

function segmentEmphasisAtFrame(
  frame: number,
  seg: Seg,
  riseFrames: number,
  fallFrames: number,
): number {
  const enter = aggressiveSCurve01((frame - seg.from) / Math.max(1, riseFrames));
  const exitStart = seg.from + seg.dur - fallFrames;
  const exit = 1 - aggressiveSCurve01((frame - exitStart) / Math.max(1, fallFrames));
  return clamp01(enter * exit);
}

function contentCameraWeightAtFrame(frame: number, seg: Seg): number {
  return segmentWeightAtFrame(frame, seg, 0.42, 22);
}

function categoryZoomOutAtFrame(frame: number, segs: Seg[]): number {
  let zoomOut = 0;

  for (let i = 0; i < segs.length - 1; i++) {
    const fromSeg = segs[i];
    const toSeg = segs[i + 1];
    if (fromSeg.topicIdx < 0 || toSeg.topicIdx < 0) continue;
    if (fromSeg.topicIdx === toSeg.topicIdx) continue;

    const switchFrame = toSeg.from;
    const leadIn = Math.min(16, Math.max(8, Math.round(fromSeg.dur * 0.28)));
    const leadOut = 18;

    let local = 0;
    if (frame >= switchFrame - leadIn && frame < switchFrame) {
      local = smoothstep01((frame - (switchFrame - leadIn)) / leadIn);
    } else if (frame >= switchFrame && frame <= switchFrame + leadOut) {
      local = 1 - smoothstep01((frame - switchFrame) / leadOut);
    }

    if (local > zoomOut) {
      zoomOut = local;
    }
  }

  return zoomOut;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getTopicColorForFrame(props: DailyCardProps, frame: number, cachedTimeline?: GraphTimeline): string {
  const timeline = cachedTimeline ?? buildGraphTimeline(props);
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;

  for (const seg of timeline.segs) {
    if (seg.topicIdx < 0) continue;
    const topic = timeline.layout.topics[seg.topicIdx];
    if (!topic) continue;
    const weight = segmentWeightAtFrame(frame, seg, 0.58, 34);
    if (weight < 0.001) continue;
    const rgb = hexToRgb(topic.color);
    r += rgb.r * weight;
    g += rgb.g * weight;
    b += rgb.b * weight;
    total += weight;
  }

  if (total <= 0) {
    const activeSeg = findActiveSeg(frame, timeline.segs);
    if (activeSeg && activeSeg.topicIdx >= 0) {
      return timeline.layout.topics[activeSeg.topicIdx]?.color ?? "#FF8A00";
    }
    return "#FF8A00";
  }

  return rgbToHex(r / total, g / total, b / total);
}

interface ResolvedGraphCamera {
  cam: CameraTarget;
  dynamicBlend: number;
}

function resolveGraphCamera(frame: number, timeline: GraphTimeline): ResolvedGraphCamera {
  const { layout, keyframes, segs, totalFrames } = timeline;
  const baseCam = interpolateCamera(frame, keyframes);
  const activeSeg = findActiveSeg(frame, segs);
  const activeTopicIdx = activeSeg?.topicIdx ?? -1;
  const activeTopic = activeTopicIdx >= 0 ? layout.topics[activeTopicIdx] : null;

  const firstChapter = segs.find((s) => s.type === "chapter");
  const outroSeg = segs.find((s) => s.type === "outro");
  const dynamicStart = firstChapter?.from ?? OPENING_FRAMES + DATE_FRAMES;
  const dynamicEnd = outroSeg?.from ?? totalFrames - OUTRO_FRAMES;
  const enterDynamic = smoothstep01((frame - (dynamicStart - 18)) / 36);
  const leaveDynamic = 1 - smoothstep01((frame - (dynamicEnd - 20)) / 40);
  const dynamicBlend = clamp01(enterDynamic * leaveDynamic);

  // Broad topic attractor keeps the camera hovering around the current section.
  let topicX = 0;
  let topicY = 0;
  let topicZoom = 0;
  let topicWeight = 0;
  for (const seg of segs) {
    if (seg.type !== "chapter") continue;
    const topic = layout.topics[seg.topicIdx];
    if (!topic) continue;
    const w = segmentWeightAtFrame(frame, seg, 0.9, 34);
    if (w < 0.001) continue;
    topicX += topic.pos.x * w;
    topicY += topic.pos.y * w;
    topicZoom += (ZOOM.topic + 0.25) * w;
    topicWeight += w;
  }
  // Content nodes pull the camera inside the topic without snapping to cards.
  let contentX = 0;
  let contentY = 0;
  let contentZoom = 0;
  let contentWeight = 0;
  for (const seg of segs) {
    if (seg.contentIdx < 0) continue;
    const topic = layout.topics[seg.topicIdx];
    if (!topic) continue;
    const content = topic.items[seg.contentIdx];
    if (!content) continue;

    const w = contentCameraWeightAtFrame(frame, seg);
    if (w < 0.001) continue;

    const anchorX = topic.pos.x * 0.18 + content.pos.x * 0.82;
    const anchorY = topic.pos.y * 0.18 + content.pos.y * 0.82;
    const anchorZoom = ZOOM.topic + 0.3;

    contentX += anchorX * w;
    contentY += anchorY * w;
    contentZoom += anchorZoom * w;
    contentWeight += w;
  }
  let topicTargetX = topicWeight > 0 ? topicX / topicWeight : activeTopic?.pos.x ?? layout.center.x;
  let topicTargetY = topicWeight > 0 ? topicY / topicWeight : activeTopic?.pos.y ?? layout.center.y;
  let topicTargetZoom = topicWeight > 0 ? topicZoom / topicWeight : activeTopic ? ZOOM.topic + 0.25 : ZOOM.hub + 0.02;

  const contentTargetX = contentWeight > 0 ? contentX / contentWeight : topicTargetX;
  const contentTargetY = contentWeight > 0 ? contentY / contentWeight : topicTargetY;
  const contentTargetZoom = contentWeight > 0 ? contentZoom / contentWeight : topicTargetZoom;

  const contentInfluence = smoothstep01(
    clamp01(contentWeight / (topicWeight * 0.9 + 1e-6)),
  );
  const zoomInfluence = smoothstep01(
    clamp01(contentWeight / (topicWeight * 0.62 + 1e-6)),
  );
  let targetX = topicTargetX + (contentTargetX - topicTargetX) * contentInfluence;
  let targetY = topicTargetY + (contentTargetY - topicTargetY) * contentInfluence;
  let targetZoom =
    topicTargetZoom + (contentTargetZoom - topicTargetZoom) * zoomInfluence;

  const roamScale = 1 - contentInfluence * 0.62;
  const driftX =
    (Math.sin(frame * 0.0075) * 34 + Math.sin(frame * 0.016 + 1.2) * 14) *
    roamScale;
  const driftY =
    (Math.cos(frame * 0.009) * 26 + Math.cos(frame * 0.013 + 0.8) * 12) *
    roamScale;
  const zoomBreath = Math.sin(frame * 0.005 + 0.6) * 0.004 * roamScale;
  const transitionZoomOut = categoryZoomOutAtFrame(frame, segs) * 0.11;

  const dynamicCam: CameraTarget = {
    x: targetX + driftX,
    y: targetY + driftY,
    zoom: Math.max(ZOOM.topic - 0.08, targetZoom + zoomBreath - transitionZoomOut),
  };

  return {
    cam: {
      x: baseCam.x + (dynamicCam.x - baseCam.x) * dynamicBlend,
      y: baseCam.y + (dynamicCam.y - baseCam.y) * dynamicBlend,
      zoom: baseCam.zoom + (dynamicCam.zoom - baseCam.zoom) * dynamicBlend,
    },
    dynamicBlend,
  };
}

function sampleCameraRoll(
  frame: number,
  timeline: GraphTimeline,
  resolved: ResolvedGraphCamera,
  viewportSize: number,
): number {
  const transforms = [
    cameraTransform(resolved.cam, viewportSize),
    cameraTransform(resolveGraphCamera(frame - 1, timeline).cam, viewportSize),
    cameraTransform(resolveGraphCamera(frame - 2, timeline).cam, viewportSize),
    cameraTransform(resolveGraphCamera(frame - 3, timeline).cam, viewportSize),
  ];

  const velocityWeights = [0.54, 0.29, 0.17];
  let motionX = 0;
  let motionY = 0;
  for (let i = 0; i < velocityWeights.length; i++) {
    motionX += (transforms[i].translateX - transforms[i + 1].translateX) * velocityWeights[i];
    motionY += (transforms[i].translateY - transforms[i + 1].translateY) * velocityWeights[i];
  }

  const rollFromPan = -motionX * 0.018;
  const rollFromLift = motionY * 0.006;
  const roll = (rollFromPan + rollFromLift) * resolved.dynamicBlend;
  return clamp(roll, -1.1, 1.1);
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
  const { layout, segs } = timeline;

  // Resolve images
  const images: DailyCardImages = props.images ?? {
    overall: props.poster_url,
    github: props.poster_url,
    discord: props.poster_url,
    market: props.poster_url,
    strategic: props.poster_url,
  };

  // Active segment
  const activeSeg = findActiveSeg(frame, segs);
  const activeTopicIdx = activeSeg?.topicIdx ?? -1;
  const activeContentIdx = activeSeg?.contentIdx ?? -1;

  const resolvedCamera = resolveGraphCamera(frame, timeline);
  const cam = resolvedCamera.cam;
  const visualCam: CameraTarget = {
    x: cam.x,
    y: cam.y,
    zoom: cam.zoom * 1.16,
  };
  const { translateX, translateY, scale: camScale } = cameraTransform(visualCam, 1080);
  const camRoll = sampleCameraRoll(frame, timeline, resolvedCamera, 1080);

  // Microshake — fast sub-pixel vibration for mechanical/alive feel
  // 3 overlapping irrational-ratio frequencies per axis so they never sync
  const shakeX =
    Math.sin(frame * 0.73 + 1.1) * 0.4 +
    Math.sin(frame * 0.47 + 2.8) * 0.28 +
    Math.cos(frame * 1.13 + 0.5) * 0.18;
  const shakeY =
    Math.cos(frame * 0.67 + 0.7) * 0.35 +
    Math.sin(frame * 0.53 + 3.2) * 0.24 +
    Math.cos(frame * 0.97 + 1.8) * 0.16;

  // ── Opening phase logic ──

  const textVisible = frame >= SCAN_FRAMES + FADE_OUT_FRAMES;

  const scanProgress = interpolate(
    frame,
    [0, SCAN_FRAMES],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: RAMP_EASE },
  );

  const scanNodeOpacity = interpolate(
    frame,
    [
      0,
      6,
      SCAN_FRAMES,
      SCAN_FRAMES + FADE_OUT_FRAMES - 2,
      SCAN_FRAMES + FADE_OUT_FRAMES,
    ],
    [0, 0.8, 0.9, 0.03, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const expandFactor = textVisible ? 1 : scanProgress;

  const expandedPos = (pos: NodePos): NodePos => {
    if (expandFactor >= 1) return pos;
    const dx = pos.x - layout.center.x;
    const dy = pos.y - layout.center.y;
    return {
      x: layout.center.x + dx * expandFactor,
      y: layout.center.y + dy * expandFactor,
    };
  };

  // Build glow spots from active content nodes
  const glowSpots: GlowSpot[] = [];
  for (const topic of layout.topics) {
    for (let ci = 0; ci < topic.items.length; ci++) {
      const content = topic.items[ci];
      const energy = Math.max(
        0,
        ...segs
          .filter((seg) => seg.topicIdx === layout.topics.indexOf(topic) && seg.contentIdx === ci)
          .map((seg) => segmentEmphasisAtFrame(frame, seg, 14, 20)),
      );
      if (energy > 0.05) {
        glowSpots.push({ pos: content.pos, color: topic.color, intensity: energy });
      }
    }
  }

  // ── Reveal FX computations ──────────────────────────────────────────────────

  // Grid ignition wave — radial front of bright dots expanding from center
  const ignitionProgress = interpolate(frame, [4, SCAN_FRAMES], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: RAMP_EASE,
  });
  const ignitionIntensity = interpolate(
    frame,
    [4, 14, SCAN_FRAMES - 6, SCAN_FRAMES + 6],
    [0, 0.9, 0.7, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Shockwave ring 1 — fast expanding ring from center
  const sw1 = interpolate(frame, [6, 40], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: RAMP_EASE,
  });
  const sw1Op = interpolate(frame, [6, 10, 32, 40], [0, 0.7, 0.25, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Shockwave ring 2 — staggered
  const sw2 = interpolate(frame, [16, 48], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: RAMP_EASE,
  });
  const sw2Op = interpolate(frame, [16, 20, 40, 48], [0, 0.5, 0.18, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Center energy buildup — intensifying glow that feeds into the flash
  const centerEnergy = interpolate(frame, [0, SCAN_FRAMES - 4], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic),
  });
  const centerEnergyOp = interpolate(frame, [4, 14, SCAN_FRAMES - 4, SCAN_FRAMES + 5], [0, 0.6, 1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Big reveal flash (viewport-space) — screen whiteout at transition
  const flashOp = interpolate(
    frame,
    [SCAN_FRAMES - 2, SCAN_FRAMES + 2, SCAN_FRAMES + 6, SCAN_FRAMES + FADE_OUT_FRAMES + 10],
    [0, 0.9, 0.5, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Lens flare cross (viewport-space)
  const flareOp = interpolate(
    frame,
    [SCAN_FRAMES - 1, SCAN_FRAMES + 3, SCAN_FRAMES + FADE_OUT_FRAMES + 14],
    [0, 0.65, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Scan bar — horizontal line sweeping down during scan
  const scanBarY = interpolate(frame, [0, SCAN_FRAMES], [0, 1080], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const scanBarOp = interpolate(frame, [0, 4, SCAN_FRAMES - 4, SCAN_FRAMES], [0, 0.4, 0.3, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Aftermath ring — soft residual wavefront after flash
  const afterStart = SCAN_FRAMES + 2;
  const afterEnd = SCAN_FRAMES + FADE_OUT_FRAMES + 22;
  const afterProgress = interpolate(frame, [afterStart, afterEnd], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  const afterOp = interpolate(frame, [afterStart, afterStart + 4, afterEnd - 8, afterEnd], [0, 0.35, 0.12, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Animated vignette — starts tight (tunnel vision), opens to normal
  const vigInner = interpolate(frame, [0, SCAN_FRAMES + FADE_OUT_FRAMES], [20, 40], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });

  // Glitch jitter — sharp micro-jumps during scan on specific frame patterns
  const glitchActive = !textVisible && frame % 29 === 0;
  const glitchX = glitchActive ? Math.sin(frame * 127.1) * 1.1 : 0;
  const glitchY = glitchActive ? Math.cos(frame * 311.7) * 0.8 : 0;

  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "center center",
          transform: `rotate(${camRoll}deg)`,
          willChange: "transform",
        }}
      >
        {/* Canvas — transformed by camera */}
        <div
          style={{
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            position: "absolute",
            transformOrigin: "0 0",
            transform: `translate(${translateX + shakeX + glitchX}px, ${translateY + shakeY + glitchY}px) scale(${camScale})`,
            willChange: "transform",
          }}
        >
          <DotGrid
            cam={visualCam}
            glows={glowSpots}
            ignition={ignitionProgress}
            ignitionIntensity={ignitionIntensity * 0.62}
          />

          {/* ── Reveal FX: Canvas-space ── */}

          {/* Center energy buildup — growing glow that feeds into flash */}
          {centerEnergyOp > 0.01 && (
            <div
              style={{
                position: "absolute",
                left: layout.center.x - 360,
                top: layout.center.y - 360,
                width: 720,
                height: 720,
                borderRadius: "50%",
                background: `radial-gradient(circle, rgba(255,138,0,${(0.06 + centerEnergy * 0.16).toFixed(3)}) 0%, rgba(255,138,0,${(0.02 + centerEnergy * 0.05).toFixed(3)}) 36%, transparent 66%)`,
                filter: `blur(${8 + centerEnergy * 14}px)`,
                opacity: centerEnergyOp * 0.52,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Shockwave ring 1 */}
          {sw1Op > 0.01 && (
            <div
              style={{
                position: "absolute",
                left: layout.center.x - 1600,
                top: layout.center.y - 1600,
                width: 3200,
                height: 3200,
                borderRadius: "50%",
                border: "1.5px solid rgba(255,138,0,0.5)",
                transform: `scale(${sw1})`,
                transformOrigin: "center center",
                opacity: sw1Op * 0.45,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Phase 1: Lines + dots draw first (frame 0+) */}
          <ConnectionLines layout={layout} buildStartFrame={0} expandFactor={expandFactor} />

          {/* Phase 2: Central hub appears after lines start reaching out (frame 12+) */}
          <CentralNode
            pos={layout.center}
            date={props.date}
            focus={nodeFocus(layout.center, visualCam)}
            appearFrame={12}
            revealFrame={SCAN_FRAMES + FADE_OUT_FRAMES}
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
              focus={nodeFocus(topic.pos, visualCam)}
              energy={Math.max(
                0,
                ...segs
                  .filter((seg) => seg.topicIdx === ti && seg.type === "chapter")
                  .map((seg) => segmentEmphasisAtFrame(frame, seg, 12, 14)),
              )}
              appearFrame={20 + ti * 5}
              textVisible={textVisible}
              scanOpacity={scanNodeOpacity}
            />
          ))}

          {/* Phase 4: Content cards pop in last (frame 30+) */}
          {layout.topics.map((topic, ti) =>
            topic.items.map((content, ci) => {
              const isActive = activeTopicIdx === ti && activeContentIdx === ci;
              const isInActiveTopic = activeTopicIdx === ti;
              const sectionImage = imageForTopic(topic.key, images);

              return (
                <ContentNode
                  key={`${topic.key}-${ci}`}
                  pos={expandedPos(content.pos)}
                  item={content.item}
                  color={topic.color}
                  focus={nodeFocus(content.pos, visualCam)}
                  energy={Math.max(
                    0,
                    ...segs
                      .filter((seg) => seg.topicIdx === ti && seg.contentIdx === ci)
                      .map((seg) => segmentEmphasisAtFrame(frame, seg, 14, 20)),
                  )}
                  appearFrame={30 + ti * 4 + ci * 3}
                  textVisible={textVisible}
                  scanOpacity={scanNodeOpacity}
                  active={isActive}
                  inActiveTopic={isInActiveTopic}
                  sectionImage={sectionImage}
                />
              );
            }),
          )}
        </div>
      </div>

      {/* ── Reveal FX: Viewport-space ── */}

      {/* Big reveal flash — screen whiteout at transition */}
      {flashOp > 0.01 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle, rgba(255,255,255,0.52) 0%, rgba(255,200,120,0.18) 24%, transparent 58%)",
            opacity: flashOp * 0.4,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Lens flare cross */}
      {flareOp > 0.01 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 1,
            transform: "translateY(-50%)",
            background: "linear-gradient(90deg, transparent 12%, rgba(255,180,80,0.22) 30%, rgba(255,255,255,0.52) 50%, rgba(255,180,80,0.22) 70%, transparent 88%)",
            opacity: flareOp * 0.35,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Scan bar — horizontal sweep line */}
      {scanBarOp > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: scanBarY - 2,
            height: 2,
            background: "linear-gradient(90deg, transparent 8%, rgba(255,138,0,0.22) 24%, rgba(255,255,255,0.38) 50%, rgba(255,138,0,0.22) 76%, transparent 92%)",
            opacity: scanBarOp * 0.45,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Vignette overlay — animated tight during reveal, opens to normal */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent ${vigInner}%, rgba(0, 0, 0, 0.7) 100%)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

// Re-export for use in DailyCard
export { buildGraphTimeline, resolveGraphCamera, type GraphTimeline, type Seg, OPENING_FRAMES };
