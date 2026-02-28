import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
  Audio,
  staticFile,
} from "remotion";
import { z } from "zod";
import { TitleCard } from "./TitleCard";
import { EndCard } from "./EndCard";
import { Clip } from "./Clip";
import { ClipTransition, OVERLAP_FRAMES } from "./transitions";

// Schema for trailer configuration (matches Python output)
const WordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});

const ClipSchema = z.object({
  source: z.string(),
  scene: z.number(),
  dialogue_num: z.number(),
  start_word: z.number(),
  end_word: z.number(),
  transition: z.enum([
    "hard-cut",
    "flash-white",
    "flash-black",
    "zoom-punch",
    "glitch",
    "side-scroll-left",
    "split",
  ]),
  rationale: z.string(),
  text: z.string(),
  start_sec: z.number(),
  end_sec: z.number(),
  duration: z.number(),
  actor: z.string(),
  video_file: z.string().optional(),
  words: z.array(WordSchema).optional(),
});

const EndCardSchema = z.object({
  text: z.string(),
  subtext: z.string(),
  duration: z.number(),
});

const ModulationSchema = z.object({
  /** GLB file in public/ for 3D background. */
  glbFile: z.string().default("Modulation_GLBs/cron_red.glb"),
  /** Effect assignments — object names → effect lists or override objects. */
  effectMap: z.record(z.string(), z.union([
    z.array(z.string()),
    z.record(z.string(), z.any()),
  ])).default({}),
  effectorInnerRadius: z.number().step(0.1).default(5),
  effectorOuterRadius: z.number().step(0.1).default(25),
  effectorStrength: z.number().step(0.01).default(1),
  rotationAxis: z.enum(["x", "y", "z"]).default("z"),
  fisheyeStrength: z.number().step(0.01).default(-0.15),
  fisheyeAudioMod: z.number().step(0.01).default(0),
  fisheyeZoom: z.number().step(0.01).default(1),
  /** Audio file in public/ for sound-reactive shake. Empty = disabled. */
  audioFile: z.string().default(""),
  audioShakeIntensity: z.number().step(0.01).default(0.05),
  audioShakeBass: z.number().step(0.01).default(0.2),
  /** Opacity of the 3D layer (0-1). */
  opacity: z.number().min(0).max(1).step(0.01).default(1),
});

export const TrailerSchema = z.object({
  type: z.literal("trailer"),
  duration: z.number(),
  title: z.string(),
  music: z.string(),
  clips: z.array(ClipSchema),
  end_card: EndCardSchema,
  source_episode: z.string(),
  generated_at: z.string(),
  /** 3D background modulation params — overridable from Studio. */
  modulation: ModulationSchema.default({}),
});

export type TrailerProps = z.infer<typeof TrailerSchema>;
export type ClipData = z.infer<typeof ClipSchema>;

export type ModulationProps = z.infer<typeof ModulationSchema>;

export const Trailer: React.FC<TrailerProps> = ({
  title,
  clips,
  end_card,
  source_episode,
  modulation,
}) => {
  const { fps } = useVideoConfig();

  const titleDuration = 2 * fps; // 2 seconds for title card

  // ---------------------------------------------------------------------------
  // Build overlapping timeline
  // Each clip's transition field defines how it ENTERS (overlapping the previous).
  // The exit of clip[i] is driven by clip[i+1]'s transition type.
  // During overlap, both clips render — ClipTransition drives the blend.
  // ---------------------------------------------------------------------------

  // Compute start positions (accounting for overlap pull-back)
  const positions: number[] = [];
  positions[0] = titleDuration;
  for (let i = 1; i < clips.length; i++) {
    const prevFrames = Math.ceil(clips[i - 1].duration * fps);
    const overlap = OVERLAP_FRAMES[clips[i].transition] || 0;
    positions[i] = positions[i - 1] + prevFrames - overlap;
  }

  // End card position — after last clip's natural duration (no overlap)
  const lastIdx = clips.length - 1;
  const endCardStart =
    clips.length > 0
      ? positions[lastIdx] + Math.ceil(clips[lastIdx].duration * fps)
      : titleDuration;
  const endCardDuration = Math.ceil(end_card.duration * fps);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* Main Soundtrack - Loops under title and clips */}
      <Sequence from={0} durationInFrames={endCardStart}>
        <Audio 
          src={staticFile("soundtrack.mp3")} 
          volume={0.30} 
          loop 
        />
      </Sequence>

      {/* Outro Music - Hits exactly on the end card */}
      <Sequence from={endCardStart} durationInFrames={endCardDuration}>
        <Audio 
          src={staticFile("outro.mp3")} 
          volume={1.0} 
        />
      </Sequence>

      {/* Title Card */}
      <Sequence from={0} durationInFrames={titleDuration}>
        <TitleCard title={title} subtitle={source_episode} modulation={modulation} />
      </Sequence>

      {/* Clips — overlapping sequences with enter/exit transitions */}
      {clips.map((clip, i) => {
        const clipFrames = Math.ceil(clip.duration * fps);

        // Enter: how this clip blends in over the previous
        const enterType = i > 0 ? clip.transition : "hard-cut";
        const enterFrames = i > 0 ? (OVERLAP_FRAMES[clip.transition] || 0) : 0;

        // Exit: how this clip blends out for the next
        const exitType =
          i < clips.length - 1 ? clips[i + 1].transition : "hard-cut";
        const exitOverlap =
          i < clips.length - 1
            ? (OVERLAP_FRAMES[clips[i + 1].transition] || 0)
            : 0;

        // Extend duration to cover the exit overlap (uses the "wasted" tail)
        const totalFrames = clipFrames + exitOverlap;

        return (
          <Sequence
            key={i}
            from={positions[i]}
            durationInFrames={totalFrames}
          >
            <ClipTransition
              enterType={enterType}
              exitType={exitType}
              enterFrames={enterFrames}
              exitFrames={exitOverlap}
            >
              <Clip
                text={clip.text}
                actor={clip.actor}
                index={i + 1}
                total={clips.length}
                videoSrc={clip.video_file}
                startSec={clip.start_sec}
                enterFrames={enterFrames}
                exitFrames={exitOverlap}
                words={clip.words}
              />
            </ClipTransition>
          </Sequence>
        );
      })}

      {/* End Card */}
      <Sequence from={endCardStart} durationInFrames={endCardDuration}>
        <EndCard text={end_card.text} subtext={end_card.subtext} modulation={modulation} />
      </Sequence>
    </AbsoluteFill>
  );
};
