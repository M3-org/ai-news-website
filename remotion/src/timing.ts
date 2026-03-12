/**
 * Shared timing utilities for DailyCard composition.
 * Importable from DailyCard.tsx (rendering) and Root.tsx (calculateMetadata).
 */
import { z } from "zod";

const ItemSchema = z.object({
  primary: z.string(),
  secondary: z.string().optional(),
  avatar_url: z.string().optional(),
  initials: z.string().optional(),
});

const DailyCardImagesSchema = z.object({
  overall: z.string(),
  github: z.string(),
  discord: z.string(),
  market: z.string(),
  strategic: z.string(),
});

export const FaderConfigSchema = z.object({
  glbFile: z.string().default(""),
  opacity: z.number().min(0).max(1).step(0.01).default(0.4),
  sceneScale: z.number().step(0.1).default(1),
  sceneOffsetX: z.number().step(0.1).default(0),
  sceneOffsetY: z.number().step(0.1).default(0),
  sceneOffsetZ: z.number().step(0.1).default(0),
  sceneRotationX: z.number().step(1).default(0),
  sceneRotationY: z.number().step(1).default(0),
  sceneRotationZ: z.number().step(1).default(0),
  cameraYOffset: z.number().step(0.5).default(15),
  fov: z.number().min(1).max(180).step(1).default(50),

  mode: z.enum(["custom", "standard", "modulation"]).default("custom"),
  loopMode: z.enum(["none", "loop", "pingpong"]).default("loop"),
  startFrame: z.number().step(1).default(0),

  rimGlow: z.boolean().default(false),
  rimColor: z.string().default("#ffffff"),
  rimIntensity: z.number().step(0.1).default(2),
  rimPower: z.number().step(0.1).default(2),

  effectorInnerRadius: z.number().step(0.1).default(5),
  effectorOuterRadius: z.number().step(0.1).default(25),
  effectorStrength: z.number().step(0.01).default(1),
  rotationAxis: z.enum(["x", "y", "z"]).default("z"),
  effectorReveal: z.boolean().default(false),
  effectorRevealFrames: z.number().step(1).default(60),
  effectorRevealPower: z.number().min(0.1).max(5).step(0.1).default(1),

  fadeInFrames: z.number().step(1).default(30),
  fadeOutFrames: z.number().step(1).default(30),
});

export type FaderConfig = z.infer<typeof FaderConfigSchema>;
const DEFAULT_INTRO_FADER_CONFIG: FaderConfig = FaderConfigSchema.parse({
  glbFile: "Modulation_GLBs/eliza_reveal.glb",
  sceneScale: 1.7,
  sceneOffsetX: 0.3,
  sceneOffsetY: 5.3,
  sceneOffsetZ: 2.3,
  cameraYOffset: 15,
  rimGlow: true,
  rimColor: "#FF8A00",
  loopMode: "none",
  opacity: 0.4,
  mode: "custom",
  fadeInFrames: 0,
  fadeOutFrames: 60,
});
const DEFAULT_KEY_FACTS_FADER_CONFIG: FaderConfig = FaderConfigSchema.parse({
  glbFile: "Modulation_GLBs/cron_bg.glb",
  opacity: 0.04,
  sceneScale: 4,
  sceneOffsetX: -0.8,
  sceneOffsetY: 8.9,
  sceneOffsetZ: 3.5,
  sceneRotationY: 32,
});
const DEFAULT_COUNCIL_FADER_CONFIG: FaderConfig = FaderConfigSchema.parse({
  glbFile: "Modulation_GLBs/clanktank_bg.glb",
  opacity: 0.85,
  sceneOffsetX: 0.2,
  sceneOffsetY: 8.5,
  sceneOffsetZ: 4.9,
  sceneRotationY: 41,
  mode: "modulation",
  loopMode: "pingpong",
  effectorOuterRadius: 35,
  effectorReveal: true,
});
/** Pre-parsed default — all fields filled in. Use in defaultProps to avoid Studio crashes. */
export const DEFAULT_FADER_CONFIG: FaderConfig = FaderConfigSchema.parse({});
export type FaderSceneKey = "intro" | "key_facts" | "github_prs" | "discord" | "feedback" | "council" | "outro";

export const DailyCardSchema = z.object({
  date: z.string(),
  headline: z.string(),
  poster_url: z.string(),
  site_url: z.string(),
  key_facts: z.array(z.string()),
  github_prs: z.array(ItemSchema),
  discord_updates: z.array(ItemSchema),
  user_feedback: z.array(ItemSchema),
  council_focus: z.string(),
  council_topics: z.array(ItemSchema),
  council_questions: z.array(ItemSchema),
  images: DailyCardImagesSchema.optional(),
  fader_intro: FaderConfigSchema.default(DEFAULT_INTRO_FADER_CONFIG),
  fader_key_facts: FaderConfigSchema.default(DEFAULT_KEY_FACTS_FADER_CONFIG),
  fader_github_prs: FaderConfigSchema.default({}),
  fader_discord: FaderConfigSchema.default({}),
  fader_feedback: FaderConfigSchema.default({}),
  fader_council: FaderConfigSchema.default(DEFAULT_COUNCIL_FADER_CONFIG),
  fader_outro: FaderConfigSchema.default({}),
});

export interface Item {
  primary: string;
  secondary?: string;
  avatar_url?: string;
  initials?: string;
}

export interface DailyCardImages {
  overall: string;    // intro, date splash, outro
  github: string;     // Development slides
  discord: string;    // Community + Feedback slides
  market: string;     // Key Facts slides
  strategic: string;  // Council slides
}

export interface DailyCardProps {
  date: string;
  headline: string;
  poster_url: string;
  site_url: string;
  key_facts: string[];
  github_prs: Item[];
  discord_updates: Item[];
  user_feedback: Item[];
  council_focus: string;
  council_topics: Item[];
  council_questions: Item[];
  images?: DailyCardImages;
  /** Per-scene 3D background config — exposed for interactive Remotion Studio tuning */
  fader_intro: FaderConfig;
  fader_key_facts: FaderConfig;
  fader_github_prs: FaderConfig;
  fader_discord: FaderConfig;
  fader_feedback: FaderConfig;
  fader_council: FaderConfig;
  fader_outro: FaderConfig;
}

export const DATE_FRAMES = 40;
export const CHAPTER_FRAMES = 62;
export const OUTRO_FRAMES = 120;
/** Opening sequence: scan reveal + fade + aggressive zoom-in */
export const OPENING_FRAMES = 55; // 35 scan + 8 fade + 12 zoom
export const MAX_FRAMES = 2700; // 90s at 30fps

/** Compute per-item frame duration from word count.
 *  Formula: min(210, max(90, wordCount × 6 + 45)) — max 7s, min 3s per item at 30fps. */
export function wordFrames(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(210, Math.max(90, words * 6 + 45));
}

/** Internal: sum all segment durations applying the given scale to content items. */
function computeTotalFramesScaled(props: DailyCardProps, scale: number): number {
  const wf = (text: string) => Math.round(wordFrames(text) * scale);
  let total = OPENING_FRAMES + DATE_FRAMES;
  total += wf(props.headline); // intro

  if (props.key_facts.length > 0) {
    total += CHAPTER_FRAMES;
    for (const f of props.key_facts) total += wf(f);
  }
  if (props.github_prs.length > 0) {
    total += CHAPTER_FRAMES;
    for (const pr of props.github_prs) total += wf(pr.primary);
  }
  if (props.discord_updates.length > 0) {
    total += CHAPTER_FRAMES;
    for (const u of props.discord_updates) total += wf(u.primary);
  }
  if (props.user_feedback.length > 0) {
    total += CHAPTER_FRAMES;
    for (const fb of props.user_feedback) total += wf(fb.primary);
  }
  // Council
  total += CHAPTER_FRAMES;
  if (props.council_focus) total += wf(props.council_focus);
  for (const t of props.council_topics) total += wf(t.primary);
  for (const q of props.council_questions) total += wf(q.primary);

  total += OUTRO_FRAMES;
  return total;
}

/** Scale factor to cap total duration at MAX_FRAMES (90s). Returns 1.0 if already within cap. */
export function computeScaleFactor(props: DailyCardProps): number {
  const fixedFrames = computeTotalFramesScaled(props, 0);
  const raw = computeTotalFramesScaled(props, 1.0);
  const scalableFrames = raw - fixedFrames;

  if (raw <= MAX_FRAMES || scalableFrames <= 0) {
    return 1.0;
  }

  return Math.max(0, (MAX_FRAMES - fixedFrames) / scalableFrames);
}

/** Sum all segment durations, capped at MAX_FRAMES (90s). */
export function computeTotalFrames(props: DailyCardProps): number {
  return computeTotalFramesScaled(props, computeScaleFactor(props));
}
