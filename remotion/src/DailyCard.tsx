import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolveAsset } from "./resolveAsset";
import {
  Item,
  DailyCardProps,
  DailyCardImages,
  DATE_FRAMES,
  CHAPTER_FRAMES,
  OUTRO_FRAMES,
  wordFrames,
  computeTotalFrames,
  computeScaleFactor,
} from "./timing";

export type { Item, DailyCardProps };

const ORANGE = "#FF8A00";
const GREEN  = "#4ADE80";
const BLUE   = "#60A5FA";
const PINK   = "#F472B6";
const PURPLE = "#A78BFA";

const SPRING = { damping: 20, stiffness: 200 };
const CROSSFADE_FRAMES = 20;

const COUNCIL_CHARS = ["eliza", "shaw", "marc", "spartan", "peepo"] as const;
const PROFILE_IMG: Record<string, number> = { eliza: 1, shaw: 9, marc: 13, spartan: 2, peepo: 2 };

/** Adaptive font size for multi-item lists (3 items per slide). */
function primaryFontSize(text: string): number {
  const len = text.length;
  if (len < 55) return 36;
  if (len < 90) return 30;
  return 26;
}

/** Adaptive font size for single-item slides (full canvas). */
function singleItemFontSize(text: string): number {
  const len = text.length;
  if (len < 40) return 72;
  if (len < 70) return 58;
  if (len < 110) return 48;
  if (len < 160) return 42;
  return 36;
}

// ─── Avatar bubble ────────────────────────────────────────────────────────────

interface AvatarProps {
  item: Item;
  color: string;
  size: number;
  forceSize: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ item, color, size, forceSize }) => {
  const circleStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    border: `2px solid ${color}`,
    overflow: "hidden",
  };

  if (item.avatar_url) {
    return (
      <Img
        src={resolveAsset(item.avatar_url)}
        style={{ ...circleStyle, objectFit: "cover", objectPosition: "top center" }}
      />
    );
  }

  const label = item.initials ?? (forceSize ? "?" : null);
  if (label !== null) {
    return (
      <div
        style={{
          ...circleStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${color}22`,
          fontSize: size * 0.38,
          fontWeight: 700,
          color,
          fontFamily: "sans-serif",
          letterSpacing: "-0.5px",
        }}
      >
        {label}
      </div>
    );
  }

  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: color,
        marginTop: 14,
        flexShrink: 0,
      }}
    />
  );
};

// ─── DateSplash ───────────────────────────────────────────────────────────────

const DateSplash: React.FC<{ date: string }> = ({ date }) => {
  const frame = useCurrentFrame();

  // Dark bg leads the text slightly — appears first, disappears last
  const bgOpacity = interpolate(frame, [0, 6, DATE_FRAMES - 8, DATE_FRAMES], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Text fades in 4 frames after bg, so bg is already darkening when text appears
  const textOpacity = interpolate(frame, [4, 16, DATE_FRAMES - 12, DATE_FRAMES - 2], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = spring({ frame, fps: 30, config: SPRING, from: 0.9, to: 1 });

  return (
    <>
      {/* Dark vignette — appears before text */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: bgOpacity,
          background: "radial-gradient(ellipse 800px 500px at center, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.65) 55%, transparent 100%)",
        }}
      />
      {/* Text content — follows bg */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: textOpacity,
          transform: `scale(${scale})`,
        }}
      >
        <div style={{ width: 80, height: 4, backgroundColor: ORANGE, marginBottom: 28 }} />
        <p
          style={{
            fontSize: 72,
            color: "#fff",
            margin: 0,
            fontWeight: 700,
            fontFamily: "sans-serif",
            letterSpacing: "4px",
          }}
        >
          {date}
        </p>
        <p
          style={{
            fontSize: 22,
            color: ORANGE,
            margin: "16px 0 0",
            fontFamily: "sans-serif",
            letterSpacing: "6px",
            textTransform: "uppercase",
          }}
        >
          ElizaOS Daily
        </p>
        <div style={{ width: 80, height: 4, backgroundColor: ORANGE, marginTop: 28 }} />
      </div>
    </>
  );
};

// ─── IntroSlide ───────────────────────────────────────────────────────────────

const IntroSlide: React.FC<{ headline: string }> = ({ headline }) => {
  const frame = useCurrentFrame();

  const headlineY = spring({ frame, fps: 30, config: SPRING, from: 40, to: 0 });
  const headlineOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fontSize = primaryFontSize(headline) + 10;

  return (
    <div style={{ position: "absolute", top: 280, left: 72, right: 72 }}>
      <p
        style={{
          fontSize,
          color: "#fff",
          margin: 0,
          lineHeight: 1.3,
          fontFamily: "Georgia, serif",
          maxWidth: 920,
          opacity: headlineOpacity,
          transform: `translateY(${headlineY}px)`,
        }}
      >
        {headline}
      </p>
      <p
        style={{
          fontSize: 24,
          color: "rgba(255,255,255,0.45)",
          margin: "28px 0 0",
          fontFamily: "sans-serif",
          letterSpacing: "2px",
          opacity: subOpacity,
        }}
      >
        Your AI ecosystem briefing
      </p>
    </div>
  );
};

// ─── ChapterCard ──────────────────────────────────────────────────────────────

const ChapterCard: React.FC<{ label: string; color: string }> = ({ label, color }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, 8, CHAPTER_FRAMES - 8, CHAPTER_FRAMES],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const scale = spring({ frame, fps: 30, config: SPRING, from: 0.93, to: 1 });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ width: 120, height: 4, backgroundColor: color, marginBottom: 28 }} />
      <p
        style={{
          fontSize: 52,
          color,
          margin: 0,
          fontWeight: 700,
          letterSpacing: "8px",
          textTransform: "uppercase",
          fontFamily: "sans-serif",
        }}
      >
        {label}
      </p>
      <div style={{ width: 120, height: 4, backgroundColor: color, marginTop: 28 }} />
    </div>
  );
};

// ─── SegmentSlide ─────────────────────────────────────────────────────────────
// Single item: large centered layout filling the canvas.
// Multiple items: compact list layout (legacy multi-item mode).

interface SegmentSlideProps {
  label: string;
  color: string;
  items: Item[];
}

const SegmentSlide: React.FC<SegmentSlideProps> = ({ label, color, items }) => {
  const frame = useCurrentFrame();

  const labelOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const labelX = spring({ frame, fps: 30, config: SPRING, from: -40, to: 0 });
  const contentOpacity = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const contentY = spring({ frame: Math.max(0, frame - 8), fps: 30, config: SPRING, from: 30, to: 0 });

  // ── Single-item: large centered layout ──────────────────────────────────────
  if (items.length === 1) {
    const item = items[0];
    const hasAvatar = !!(item.avatar_url || item.initials);
    const avatarSize = 88;
    const fontSize = singleItemFontSize(item.primary);

    return (
      <div
        style={{
          position: "absolute",
          // Content zone: below brand bar (top 160px) above progress dots (bottom 80px)
          top: 160,
          bottom: 80,
          left: 72,
          right: 72,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Section label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 48,
            opacity: labelOpacity,
            transform: `translateX(${labelX}px)`,
          }}
        >
          <div style={{ width: 5, height: 40, backgroundColor: color, flexShrink: 0 }} />
          <p
            style={{
              fontSize: 22,
              color,
              margin: 0,
              fontWeight: 700,
              letterSpacing: "4px",
              textTransform: "uppercase",
              fontFamily: "sans-serif",
            }}
          >
            {label}
          </p>
        </div>

        {/* Item content */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: hasAvatar ? 32 : 0,
            opacity: contentOpacity,
            transform: `translateY(${contentY}px)`,
          }}
        >
          {hasAvatar && (
            <div style={{ flexShrink: 0, paddingTop: 6 }}>
              <Avatar item={item} color={color} size={avatarSize} forceSize />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontSize,
                color: "#fff",
                margin: 0,
                lineHeight: 1.35,
                fontFamily: "Georgia, serif",
              }}
            >
              {item.primary}
            </p>
            {item.secondary ? (
              <p
                style={{
                  fontSize: 26,
                  color: `${color}cc`,
                  margin: "18px 0 0",
                  fontFamily: "sans-serif",
                  letterSpacing: "1px",
                }}
              >
                {item.secondary}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // ── Multi-item: compact list layout ─────────────────────────────────────────
  const hasAnyAvatar = items.some((it) => it.avatar_url || it.initials);
  const avatarSize = 56;

  return (
    <div style={{ position: "absolute", top: 240, left: 72, right: 72 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 36,
          opacity: labelOpacity,
          transform: `translateX(${labelX}px)`,
        }}
      >
        <div style={{ width: 5, height: 40, backgroundColor: color, flexShrink: 0 }} />
        <p
          style={{
            fontSize: 22,
            color,
            margin: 0,
            fontWeight: 700,
            letterSpacing: "4px",
            textTransform: "uppercase",
            fontFamily: "sans-serif",
          }}
        >
          {label}
        </p>
      </div>

      {items.slice(0, 3).map((item, i) => {
        const startFrame = 8 + i * 12;
        const itemOpacity = interpolate(frame, [startFrame, startFrame + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const itemX = spring({
          frame: Math.max(0, frame - startFrame),
          fps: 30,
          config: SPRING,
          from: -30,
          to: 0,
        });

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: hasAnyAvatar ? 20 : 18,
              marginBottom: 28,
              opacity: itemOpacity,
              transform: `translateX(${itemX}px)`,
            }}
          >
            <div style={{ paddingTop: hasAnyAvatar ? 2 : 0 }}>
              <Avatar item={item} color={color} size={avatarSize} forceSize={hasAnyAvatar} />
            </div>
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontSize: primaryFontSize(item.primary),
                  color: "#fff",
                  margin: 0,
                  lineHeight: 1.35,
                  fontFamily: "Georgia, serif",
                }}
              >
                {item.primary}
              </p>
              {item.secondary ? (
                <p
                  style={{
                    fontSize: 22,
                    color: "rgba(255,255,255,0.5)",
                    margin: "5px 0 0",
                    fontFamily: "sans-serif",
                  }}
                >
                  {item.secondary}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── CouncilFocusSlide ────────────────────────────────────────────────────────

const CouncilFocusSlide: React.FC<{ focus: string }> = ({ focus }) => {
  const frame = useCurrentFrame();

  const labelOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const labelX = spring({ frame, fps: 30, config: SPRING, from: -40, to: 0 });
  const textOpacity = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textY = spring({ frame: Math.max(0, frame - 8), fps: 30, config: SPRING, from: 20, to: 0 });
  const charsOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 160,
        bottom: 80,
        left: 72,
        right: 72,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 48,
          opacity: labelOpacity,
          transform: `translateX(${labelX}px)`,
        }}
      >
        <div style={{ width: 5, height: 40, backgroundColor: PURPLE, flexShrink: 0 }} />
        <p
          style={{
            fontSize: 22,
            color: PURPLE,
            margin: 0,
            fontWeight: 700,
            letterSpacing: "4px",
            textTransform: "uppercase",
            fontFamily: "sans-serif",
          }}
        >
          The Council · Today's Focus
        </p>
      </div>

      <p
        style={{
          fontSize: singleItemFontSize(focus),
          color: "#fff",
          fontFamily: "Georgia, serif",
          lineHeight: 1.4,
          margin: "0 0 48px",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        {focus}
      </p>

      <div style={{ display: "flex", gap: 20, opacity: charsOpacity }}>
        {COUNCIL_CHARS.map((char) => (
          <Img
            key={char}
            src={resolveAsset(`characters/${char}/${PROFILE_IMG[char]}.png`)}
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              objectFit: "cover",
              objectPosition: "top center",
              border: `2px solid ${PURPLE}`,
              overflow: "hidden",
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ─── OutroSlide ───────────────────────────────────────────────────────────────

const OutroSlide: React.FC<{ site_url: string }> = ({ site_url }) => {
  const frame = useCurrentFrame();

  const fadeOpacity = interpolate(frame, [OUTRO_FRAMES - 30, OUTRO_FRAMES], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const urlOpacity = interpolate(frame, [12, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const urlY = spring({ frame: Math.max(0, frame - 12), fps: 30, config: SPRING, from: 20, to: 0 });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOpacity,
      }}
    >
      <p
        style={{
          fontSize: 26,
          color: "rgba(255,255,255,0.6)",
          margin: "0 0 20px",
          fontFamily: "sans-serif",
          letterSpacing: "3px",
          textTransform: "uppercase",
          opacity: labelOpacity,
        }}
      >
        Read the full briefing
      </p>
      <p
        style={{
          fontSize: 48,
          color: ORANGE,
          margin: 0,
          fontWeight: 700,
          fontFamily: "sans-serif",
          opacity: urlOpacity,
          transform: `translateY(${urlY}px)`,
        }}
      >
        {site_url}
      </p>
    </div>
  );
};

// ─── Segment descriptor ───────────────────────────────────────────────────────

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
  label?: string;
  color?: string;
  item?: Item;
  text?: string;
}

function buildSegments(props: DailyCardProps, scale: number): { segs: Seg[]; sectionStarts: number[] } {
  const wf = (text: string) => Math.round(wordFrames(text) * scale);
  const segs: Seg[] = [];
  const sectionStarts: number[] = [];
  let cursor = 0;

  segs.push({ from: cursor, dur: DATE_FRAMES, type: "date" });
  cursor += DATE_FRAMES;

  const introDur = wf(props.headline);
  sectionStarts.push(cursor);
  segs.push({ from: cursor, dur: introDur, type: "intro" });
  cursor += introDur;

  if (props.key_facts.length > 0) {
    sectionStarts.push(cursor);
    segs.push({ from: cursor, dur: CHAPTER_FRAMES, type: "chapter", label: "Key Facts", color: ORANGE });
    cursor += CHAPTER_FRAMES;
    for (const fact of props.key_facts) {
      const dur = wf(fact);
      segs.push({ from: cursor, dur, type: "key_fact", label: "Key Facts", color: ORANGE, item: { primary: fact } });
      cursor += dur;
    }
  }

  if (props.github_prs.length > 0) {
    sectionStarts.push(cursor);
    segs.push({ from: cursor, dur: CHAPTER_FRAMES, type: "chapter", label: "Development", color: GREEN });
    cursor += CHAPTER_FRAMES;
    for (const pr of props.github_prs) {
      const dur = wf(pr.primary);
      segs.push({ from: cursor, dur, type: "github_pr", label: "Development", color: GREEN, item: pr });
      cursor += dur;
    }
  }

  if (props.discord_updates.length > 0) {
    sectionStarts.push(cursor);
    segs.push({ from: cursor, dur: CHAPTER_FRAMES, type: "chapter", label: "Community", color: BLUE });
    cursor += CHAPTER_FRAMES;
    for (const update of props.discord_updates) {
      const dur = wf(update.primary);
      segs.push({ from: cursor, dur, type: "discord", label: "Community", color: BLUE, item: update });
      cursor += dur;
    }
  }

  if (props.user_feedback.length > 0) {
    sectionStarts.push(cursor);
    segs.push({ from: cursor, dur: CHAPTER_FRAMES, type: "chapter", label: "Feedback", color: PINK });
    cursor += CHAPTER_FRAMES;
    for (const fb of props.user_feedback) {
      const dur = wf(fb.primary);
      segs.push({ from: cursor, dur, type: "feedback", label: "Feedback", color: PINK, item: fb });
      cursor += dur;
    }
  }

  // Council: always included
  sectionStarts.push(cursor);
  segs.push({ from: cursor, dur: CHAPTER_FRAMES, type: "chapter", label: "The Council", color: PURPLE });
  cursor += CHAPTER_FRAMES;

  if (props.council_focus) {
    const dur = wf(props.council_focus);
    segs.push({ from: cursor, dur, type: "council_focus", text: props.council_focus });
    cursor += dur;
  }
  for (const topic of props.council_topics) {
    const dur = wf(topic.primary);
    segs.push({ from: cursor, dur, type: "council_topic", label: "The Council · Topics", color: PURPLE, item: topic });
    cursor += dur;
  }
  for (const q of props.council_questions) {
    const dur = wf(q.primary);
    segs.push({ from: cursor, dur, type: "council_question", label: "The Council · Questions", color: PURPLE, item: q });
    cursor += dur;
  }

  sectionStarts.push(cursor);
  segs.push({ from: cursor, dur: OUTRO_FRAMES, type: "outro" });

  return { segs, sectionStarts };
}

// ─── Background image helpers ─────────────────────────────────────────────────

function imageForSeg(type: SegType, images: DailyCardImages): string {
  if (type === "github_pr") return images.github;
  if (type === "discord" || type === "feedback") return images.discord;
  if (type === "key_fact") return images.market;
  if (type === "council_focus" || type === "council_topic" || type === "council_question") return images.strategic;
  return images.overall; // date, intro, chapter, outro
}

interface BgSpan {
  imgSrc: string;
  from: number;
  dur: number;
}

function groupBgSpans(segs: Seg[], images: DailyCardImages): BgSpan[] {
  const spans: BgSpan[] = [];
  for (const seg of segs) {
    const src = imageForSeg(seg.type, images);
    const last = spans[spans.length - 1];
    if (last && last.imgSrc === src) {
      last.dur += seg.dur;
    } else {
      spans.push({ imgSrc: src, from: seg.from, dur: seg.dur });
    }
  }
  return spans;
}

// ─── BgImage ──────────────────────────────────────────────────────────────────
// Renders a background image within a Sequence context.
// Uses globalFrom + local frame to compute the slow zoom from global time.

interface BgImageProps {
  src: string;
  globalFrom: number;
  totalFrames: number;
  fadeIn: boolean;  // false for the first span (visible from frame 0)
}

const BgImage: React.FC<BgImageProps> = ({ src, globalFrom, totalFrames, fadeIn }) => {
  const localFrame = useCurrentFrame();
  const globalFrame = globalFrom + localFrame;

  const posterScale = interpolate(globalFrame, [0, totalFrames], [1.0, 1.06], {
    extrapolateRight: "clamp",
  });
  const opacity = fadeIn
    ? interpolate(localFrame, [0, CROSSFADE_FRAMES], [0, 1], { extrapolateRight: "clamp" })
    : 1;

  return (
    <AbsoluteFill>
      <Img
        src={resolveAsset(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity,
          transform: `scale(${posterScale})`,
          transformOrigin: "center center",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Root component ───────────────────────────────────────────────────────────

export const DailyCard: React.FC<DailyCardProps> = (props) => {
  const { date, poster_url, site_url } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = computeScaleFactor(props);
  const totalFrames = computeTotalFrames(props);
  const { segs, sectionStarts } = buildSegments(props, scale);

  // Resolve images: use props.images if present, otherwise fall back to poster_url for all slots
  const images: DailyCardImages = props.images ?? {
    overall: poster_url,
    github: poster_url,
    discord: poster_url,
    market: poster_url,
    strategic: poster_url,
  };

  const bgSpans = groupBgSpans(segs, images);

  // Dark overlay: snaps on immediately when content starts (no visible lag behind text)
  const gradientOpacity = interpolate(frame, [DATE_FRAMES, DATE_FRAMES + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // UI chrome (brand bar, corners): appears slightly later for a staged reveal
  const uiOpacity = interpolate(frame, [DATE_FRAMES + 20, DATE_FRAMES + 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const activeSection = sectionStarts.reduce(
    (acc, start, i) => (frame >= start ? i : acc),
    0
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Background images — one Sequence per section group, crossfade on transition.
          First span starts at frame 0 (no fade-in) so thumbnail is not black. */}
      {bgSpans.map((span, i) => {
        const isFirst = i === 0;
        // All spans except last extend by CROSSFADE_FRAMES so the next span fades in on top
        const isLast = i === bgSpans.length - 1;
        const seqDur = isLast ? span.dur : span.dur + CROSSFADE_FRAMES;
        return (
          <Sequence key={`bg-${i}`} from={span.from} durationInFrames={seqDur}>
            <BgImage
              src={span.imgSrc}
              globalFrom={span.from}
              totalFrames={totalFrames}
              fadeIn={!isFirst}
            />
          </Sequence>
        );
      })}

      {/* Dark overlay — fades in fast at content start so it's always under text.
          Uniformly dark across the full canvas (top-to-bottom gradient ensures
          both brand bar area and main content area are readable). */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.68) 20%, rgba(0,0,0,0.65) 55%, rgba(0,0,0,0.80) 80%, rgba(0,0,0,0.92) 100%)",
          opacity: gradientOpacity,
        }}
      />

      {/* Brand bar — appears after date splash */}
      {frame >= DATE_FRAMES ? (
        <div
          style={{
            position: "absolute",
            top: 64,
            left: 72,
            right: 72,
            opacity: uiOpacity,
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div style={{ width: 6, height: 58, backgroundColor: ORANGE, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 28, color: "#fff", margin: 0, fontWeight: 700, letterSpacing: "2px", fontFamily: "sans-serif" }}>
              {date}
            </p>
            <p style={{ fontSize: 20, color: ORANGE, margin: 0, letterSpacing: "3px", textTransform: "uppercase", fontFamily: "sans-serif" }}>
              ElizaOS Daily
            </p>
          </div>
        </div>
      ) : null}

      {/* Corner accents */}
      {frame >= DATE_FRAMES ? (
        <>
          {[
            { top: 40, left: 40, borderTop: `3px solid ${ORANGE}`, borderLeft: `3px solid ${ORANGE}` },
            { top: 40, right: 40, borderTop: `3px solid ${ORANGE}`, borderRight: `3px solid ${ORANGE}` },
            { bottom: 40, left: 40, borderBottom: `3px solid ${ORANGE}`, borderLeft: `3px solid ${ORANGE}` },
            { bottom: 40, right: 40, borderBottom: `3px solid ${ORANGE}`, borderRight: `3px solid ${ORANGE}` },
          ].map((s, i) => (
            <div key={i} style={{ position: "absolute", width: 50, height: 50, opacity: uiOpacity, ...s }} />
          ))}
        </>
      ) : null}

      {/* ── Music — fade in over 1s, fade out over 2s before end ── */}
      <Audio
        src={staticFile("cronjobMusic.mp3")}
        volume={(f) =>
          interpolate(f, [0, 30, totalFrames - 60, totalFrames], [0, 1, 1, 0], {
            extrapolateRight: "clamp",
          })
        }
      />

      {/* ── Segments ── */}
      {segs.map((seg, i) => (
        <Sequence key={i} from={seg.from} durationInFrames={seg.dur} premountFor={fps}>
          {seg.type === "date" && <DateSplash date={date} />}
          {seg.type === "intro" && <IntroSlide headline={props.headline} />}
          {seg.type === "chapter" && (
            <ChapterCard label={seg.label!} color={seg.color!} />
          )}
          {(seg.type === "key_fact" ||
            seg.type === "github_pr" ||
            seg.type === "discord" ||
            seg.type === "feedback" ||
            seg.type === "council_topic" ||
            seg.type === "council_question") && (
            <SegmentSlide label={seg.label!} color={seg.color!} items={[seg.item!]} />
          )}
          {seg.type === "council_focus" && <CouncilFocusSlide focus={seg.text!} />}
          {seg.type === "outro" && <OutroSlide site_url={site_url} />}
        </Sequence>
      ))}

      {/* Progress dots — one per section */}
      <div
        style={{
          position: "absolute",
          bottom: 52,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 10,
        }}
      >
        {sectionStarts.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === activeSection ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === activeSection ? ORANGE : "rgba(255,255,255,0.3)",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
