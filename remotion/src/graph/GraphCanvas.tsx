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
import { interpolate, useCurrentFrame } from "remotion";
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
import type { DailyCardProps, DailyCardImages, Item } from "../timing";
import { DATE_FRAMES, CHAPTER_FRAMES, OUTRO_FRAMES, OPENING_FRAMES, wordFrames, computeScaleFactor } from "../timing";

// ── Opening timing ───────────────────────────────────────────────────────────

/** Frames for the scan/reveal phase (nodes appear, no text) */
const SCAN_FRAMES = 50;
/** Frames for nodes to fade out after scan */
const FADE_OUT_FRAMES = 12;

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
  const enter = smoothstep01((frame - seg.from) / riseFrames);
  const exitStart = seg.from + seg.dur - fallFrames;
  const exit = 1 - smoothstep01((frame - exitStart) / fallFrames);
  return Math.max(0, Math.min(1, enter * exit));
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

export function getTopicColorForFrame(props: DailyCardProps, frame: number): string {
  const timeline = buildGraphTimeline(props);
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
    topicZoom += (ZOOM.topic + 0.05) * w;
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

    const anchorX = topic.pos.x * 0.28 + content.pos.x * 0.72;
    const anchorY = topic.pos.y * 0.28 + content.pos.y * 0.72;
    const anchorZoom = (ZOOM.topic + 0.04) * 0.18 + (ZOOM.content + 0.18) * 0.82;

    contentX += anchorX * w;
    contentY += anchorY * w;
    contentZoom += anchorZoom * w;
    contentWeight += w;
  }
  let topicTargetX = topicWeight > 0 ? topicX / topicWeight : activeTopic?.pos.x ?? layout.center.x;
  let topicTargetY = topicWeight > 0 ? topicY / topicWeight : activeTopic?.pos.y ?? layout.center.y;
  let topicTargetZoom = topicWeight > 0 ? topicZoom / topicWeight : activeTopic ? ZOOM.topic + 0.05 : ZOOM.hub + 0.02;

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
  const { translateX, translateY, scale: camScale } = cameraTransform(cam, 1080);
  const camRoll = sampleCameraRoll(frame, timeline, resolvedCamera, 1080);

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
            transform: `translate(${translateX}px, ${translateY}px) scale(${camScale})`,
            willChange: "transform",
          }}
        >
          <DotGrid cam={cam} />
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
              energy={Math.max(
                0,
                ...segs
                  .filter((seg) => seg.topicIdx === ti && seg.type === "chapter")
                  .map((seg) => segmentEmphasisAtFrame(frame, seg, 12, 14)),
              )}
              appearFrame={20 + ti * 5}
              textVisible={textVisible}
              scanOpacity={scanNodeOpacity}
              active={activeTopicIdx === ti && activeContentIdx === -1}
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
                  focus={nodeFocus(content.pos, cam)}
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
