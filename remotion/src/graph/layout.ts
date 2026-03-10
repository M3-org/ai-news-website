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

const TOPIC_RADIUS = 1600; // center -> topic node distance
const ITEM_RADIUS = 800; // topic -> content node distance
const ITEM_SPREAD_DEG = 50; // base degrees between sibling items

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

// ── Colors (duplicated from DailyCard to keep layout independent) ────────────

const ORANGE = "#FF8A00";
const GREEN  = "#4ADE80";
const BLUE   = "#60A5FA";
const PINK   = "#F472B6";
const PURPLE = "#A78BFA";

// ── Section definitions ──────────────────────────────────────────────────────

interface SectionDef {
  key: SectionKey;
  label: string;
  color: string;
  angleDeg: number; // degrees clockwise from 12 o'clock
  itemAngleDeg?: number;
  itemRadius?: number;
  itemSpreadDeg?: number;
  itemMaxSpreadDeg?: number;
}

const SECTIONS: SectionDef[] = [
  { key: "key_facts",  label: "Key Facts",    color: ORANGE, angleDeg: 270 },
  { key: "github_prs", label: "Development",  color: GREEN,  angleDeg: 342 },
  {
    key: "discord",
    label: "Community",
    color: BLUE,
    angleDeg: 54,
    // Community sits on the right edge, so fan its cards back inward
    // instead of sending the whole branch further off-screen to the right.
    itemAngleDeg: 336,
    itemRadius: 900,
    itemSpreadDeg: 36,
    itemMaxSpreadDeg: 132,
  },
  { key: "feedback",   label: "Feedback",      color: PINK,   angleDeg: 126 },
  {
    key: "council",
    label: "The Council",
    color: PURPLE,
    angleDeg: 198,
    // Aim the council branch back toward the graph center.
    itemAngleDeg: 18,
    itemRadius: 980,
    itemSpreadDeg: 20,
    itemMaxSpreadDeg: 96,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
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

  for (const sec of SECTIONS) {
    const items = getItemsForSection(props, sec.key);
    if (items.length === 0 && sec.key !== "council") continue;

    const angleRad = degToRad(sec.angleDeg);
    const topicPos = pointOnCircle(CENTER, CENTER, TOPIC_RADIUS, angleRad);

    const contentLayouts: ContentLayout[] = [];
    const count = items.length;
    const fanAngle = degToRad(sec.itemAngleDeg ?? sec.angleDeg);
    const baseRadius = sec.itemRadius ?? ITEM_RADIUS;
    const spreadRad = degToRad(sec.itemSpreadDeg ?? ITEM_SPREAD_DEG);
    const maxSpreadRad = degToRad(sec.itemMaxSpreadDeg ?? 120);
    const totalSpread = Math.min(spreadRad * Math.max(0, count - 1), maxSpreadRad);
    const startAngle = fanAngle - totalSpread / 2;
    const step = count > 1 ? totalSpread / (count - 1) : 0;

    for (let i = 0; i < count; i++) {
      const itemAngle = startAngle + step * i;
      const itemPos = pointOnCircle(topicPos.x, topicPos.y, baseRadius, itemAngle);

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
