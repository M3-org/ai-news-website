/**
 * layout.ts — Computes node positions for the hub-and-spoke graph.
 *
 * Central "ElizaOS Daily" hub at canvas center.
 * Five topic branches radiate outward at staggered angles.
 * Content items fan out from their parent topic node.
 */

import type { DailyCardProps, Item } from "../timing";

// ── Canvas constants ─────────────────────────────────────────────────────────

export const CANVAS_SIZE = 5000;
export const CENTER = CANVAS_SIZE / 2; // 2500

const TOPIC_RADIUS = 1600;  // center → topic node distance
const ITEM_RADIUS = 800;    // topic → content node distance
const ITEM_SPREAD_DEG = 38; // degrees between sibling items
const ITEM_MAX_SPREAD_DEG = 150; // max total arc for all items

// ── Types ────────────────────────────────────────────────────────────────────

export interface NodePos {
  x: number;
  y: number;
}

export type SectionKey = "key_facts" | "github_prs" | "discord" | "feedback" | "council";

export interface TopicLayout {
  key: SectionKey;
  label: string;
  color: string;
  pos: NodePos;
  angle: number; // radians — direction from center
  items: ContentLayout[];
}

export interface ContentLayout {
  pos: NodePos;
  item: Item;
  /** Index within the parent topic */
  index: number;
}

export interface GraphLayout {
  center: NodePos;
  topics: TopicLayout[];
  /** Flat list of every content node for quick lookup */
  allContent: ContentLayout[];
}

// ── Colors ───────────────────────────────────────────────────────────────────

const ORANGE = "#FF8A00";
const GREEN  = "#4ADE80";
const BLUE   = "#60A5FA";
const PINK   = "#F472B6";
const PURPLE = "#A78BFA";

// ── Section definitions (just key, label, color, angle — no overrides) ──────

interface SectionDef {
  key: SectionKey;
  label: string;
  color: string;
  angleDeg: number; // degrees clockwise from 12 o'clock
}

const SECTIONS: SectionDef[] = [
  { key: "key_facts",  label: "Key Facts",   color: ORANGE, angleDeg: 270 },
  { key: "github_prs", label: "Development", color: GREEN,  angleDeg: 342 },
  { key: "discord",    label: "Community",   color: BLUE,   angleDeg: 54  },
  { key: "feedback",   label: "Feedback",    color: PINK,   angleDeg: 126 },
  { key: "council",    label: "The Council", color: PURPLE, angleDeg: 198 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Deterministic pseudo-random from integer seed (0–1). Mulberry32-based. */
function hash(seed: number): number {
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function pointOnCircle(cx: number, cy: number, radius: number, angleRad: number): NodePos {
  // Angle 0 = up (12 o'clock), clockwise positive
  return {
    x: cx + radius * Math.sin(angleRad),
    y: cy - radius * Math.cos(angleRad),
  };
}

function getItemsForSection(props: DailyCardProps, key: SectionKey): Item[] {
  switch (key) {
    case "key_facts":
      return props.key_facts.map((f) => ({ primary: f }));
    case "github_prs":
      return props.github_prs;
    case "discord":
      return props.discord_updates;
    case "feedback":
      return props.user_feedback;
    case "council": {
      const items: Item[] = [];
      if (props.council_focus) {
        items.push({ primary: props.council_focus, secondary: "Focus" });
      }
      items.push(...props.council_topics);
      items.push(...props.council_questions);
      return items;
    }
  }
}

// ── Main layout function ─────────────────────────────────────────────────────

export function computeGraphLayout(props: DailyCardProps): GraphLayout {
  const center: NodePos = { x: CENTER, y: CENTER };
  const topics: TopicLayout[] = [];
  const allContent: ContentLayout[] = [];

  const spreadRad = degToRad(ITEM_SPREAD_DEG);
  const maxSpreadRad = degToRad(ITEM_MAX_SPREAD_DEG);

  for (const sec of SECTIONS) {
    const items = getItemsForSection(props, sec.key);
    if (items.length === 0 && sec.key !== "council") continue;

    const angleRad = degToRad(sec.angleDeg);
    const topicPos = pointOnCircle(CENTER, CENTER, TOPIC_RADIUS, angleRad);

    const contentLayouts: ContentLayout[] = [];
    const count = items.length;

    // Fan items outward from topic in the same direction as topic→center line
    const totalSpread = Math.min(spreadRad * Math.max(0, count - 1), maxSpreadRad);
    const startAngle = angleRad - totalSpread / 2;
    const step = count > 1 ? totalSpread / (count - 1) : 0;

    const si = SECTIONS.indexOf(sec);
    for (let i = 0; i < count; i++) {
      // Small jitter to break the perfect arc
      const h1 = hash(si * 97 + i * 13 + 1);
      const h2 = hash(si * 97 + i * 13 + 2);
      const angleJitter = (h1 - 0.5) * degToRad(8);   // ±4°
      const radiusJitter = 1 + (h2 - 0.5) * 0.18;     // ±9%

      const itemAngle = startAngle + step * i + angleJitter;
      const itemPos = pointOnCircle(topicPos.x, topicPos.y, ITEM_RADIUS * radiusJitter, itemAngle);

      const cl: ContentLayout = {
        pos: itemPos,
        item: items[i],
        index: i,
      };
      contentLayouts.push(cl);
      allContent.push(cl);
    }

    topics.push({
      key: sec.key,
      label: sec.label,
      color: sec.color,
      pos: topicPos,
      angle: angleRad,
      items: contentLayouts,
    });
  }

  return { center, topics, allContent };
}
