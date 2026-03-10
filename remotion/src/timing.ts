/**
 * Shared timing utilities for DailyCard composition.
 * Importable from DailyCard.tsx (rendering) and Root.tsx (calculateMetadata).
 */

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
}

export const DATE_FRAMES = 60;
export const CHAPTER_FRAMES = 45;
export const OUTRO_FRAMES = 120;
export const MAX_FRAMES = 2700; // 90s at 30fps

/** Compute per-item frame duration from word count.
 *  Formula: min(210, max(90, wordCount × 6 + 45)) — max 7s, min 3s per item at 30fps. */
export function wordFrames(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(210, Math.max(90, words * 6 + 45));
}

export function wordFramesScaled(text: string, scale: number): number {
  return Math.round(wordFrames(text) * scale);
}

/** Internal: sum all segment durations applying the given scale to content items. */
function computeTotalFramesScaled(props: DailyCardProps, scale: number): number {
  const wf = (text: string) => Math.round(wordFrames(text) * scale);
  let total = DATE_FRAMES;
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
  // Council: always include chapter card
  total += CHAPTER_FRAMES;
  if (props.council_focus) total += wf(props.council_focus);
  for (const t of props.council_topics) total += wf(t.primary);
  for (const q of props.council_questions) total += wf(q.primary);

  total += OUTRO_FRAMES;
  return total;
}

/** Scale factor to cap total duration at MAX_FRAMES (90s). Returns 1.0 if already within cap. */
export function computeScaleFactor(props: DailyCardProps): number {
  const raw = computeTotalFramesScaled(props, 1.0);
  return raw > MAX_FRAMES ? MAX_FRAMES / raw : 1.0;
}

/** Sum all segment durations, capped at MAX_FRAMES (90s). */
export function computeTotalFrames(props: DailyCardProps): number {
  return computeTotalFramesScaled(props, computeScaleFactor(props));
}
