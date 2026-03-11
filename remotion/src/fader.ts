/**
 * Fader — Per-scene GLB background resolver.
 *
 * Pure functions that map timeline segments to scene boundaries,
 * then resolve which GLB scenes are active at any given frame
 * (with crossfade opacity envelopes).
 */
import type { GraphTimeline, Seg } from "./graph/GraphCanvas";
import type { FaderConfig, FaderSceneKey } from "./timing";
import type { SectionKey } from "./graph/layout";

export interface FaderSceneBounds {
  key: FaderSceneKey;
  from: number;
  to: number;
}

export interface ActiveFaderScene {
  config: FaderConfig;
  computedOpacity: number;
  sceneKey: FaderSceneKey;
  sceneFrom: number;
}

const SECTION_KEY_TO_FADER: Record<SectionKey, FaderSceneKey> = {
  key_facts: "key_facts",
  github_prs: "github_prs",
  discord: "discord",
  feedback: "feedback",
  council: "council",
};

/**
 * Derives 7 scene boundaries from the timeline:
 *   intro: frame 0 -> first chapter
 *   5 topic scenes: each chapter -> next chapter (or outro)
 *   outro: outro seg -> totalFrames
 */
export function buildFaderSceneBounds(timeline: GraphTimeline): FaderSceneBounds[] {
  const { segs, totalFrames, layout } = timeline;
  const bounds: FaderSceneBounds[] = [];

  const chapters = segs.filter((s) => s.type === "chapter");
  const outroSeg = segs.find((s) => s.type === "outro");
  const outroFrom = outroSeg?.from ?? totalFrames;

  // Intro: frame 0 -> first chapter (or outro if no chapters)
  const firstChapterFrom = chapters.length > 0 ? chapters[0].from : outroFrom;
  bounds.push({ key: "intro", from: 0, to: firstChapterFrom });

  // Topic scenes from chapters
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const topic = layout.topics[ch.topicIdx];
    if (!topic) continue;
    const faderKey = SECTION_KEY_TO_FADER[topic.key];
    if (!faderKey) continue;
    const nextFrom = i < chapters.length - 1 ? chapters[i + 1].from : outroFrom;
    bounds.push({ key: faderKey, from: ch.from, to: nextFrom });
  }

  // Outro: outro seg -> end
  bounds.push({ key: "outro", from: outroFrom, to: totalFrames });

  return bounds;
}

/**
 * Returns 0-2 active scenes for the current frame with crossfade opacity.
 *
 * At scene boundary B:
 *   - Outgoing: opacity ramps 1->0 over [B, B + fadeOutFrames]
 *   - Incoming: opacity ramps 0->1 over [B - fadeInFrames, B]
 *   - computedOpacity = config.opacity * fadeEnvelope
 *
 * Filters out scenes with computedOpacity < 0.005
 */
export function resolveActiveFaderScenes(
  frame: number,
  sceneBounds: FaderSceneBounds[],
  configs: Record<FaderSceneKey, FaderConfig>,
): ActiveFaderScene[] {
  const results: ActiveFaderScene[] = [];

  for (const bound of sceneBounds) {
    const config = configs[bound.key];
    if (!config) continue;

    const visibleFrom = bound.from - config.fadeInFrames;
    const visibleTo = bound.to + config.fadeOutFrames;
    if (frame < visibleFrom || frame >= visibleTo) {
      continue;
    }

    let envelope = 0;

    if (frame < bound.from) {
      envelope =
        config.fadeInFrames > 0
          ? (frame - visibleFrom) / config.fadeInFrames
          : 0;
    } else if (frame >= bound.to) {
      envelope =
        config.fadeOutFrames > 0
          ? (visibleTo - frame) / config.fadeOutFrames
          : 0;
    } else {
      envelope = 1;
    }

    envelope = Math.max(0, Math.min(1, envelope));
    const computedOpacity = config.opacity * envelope;

    if (computedOpacity >= 0.005) {
      results.push({
        config,
        computedOpacity,
        sceneKey: bound.key,
        sceneFrom: bound.from,
      });
    }
  }

  return results;
}
