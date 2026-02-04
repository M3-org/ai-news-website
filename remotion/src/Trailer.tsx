import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { z } from "zod";
import { TitleCard } from "./TitleCard";
import { EndCard } from "./EndCard";
import { Clip } from "./Clip";
import { Flash, Glitch, ZoomPunch } from "./transitions";

// Schema for trailer configuration (matches Python output)
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
  ]),
  rationale: z.string(),
  text: z.string(),
  start_sec: z.number(),
  end_sec: z.number(),
  duration: z.number(),
  actor: z.string(),
  video_file: z.string().optional(),
});

const EndCardSchema = z.object({
  text: z.string(),
  subtext: z.string(),
  duration: z.number(),
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
});

export type TrailerProps = z.infer<typeof TrailerSchema>;
export type ClipData = z.infer<typeof ClipSchema>;

// Transition component mapping
const TransitionComponents: Record<
  ClipData["transition"],
  React.FC<{ durationInFrames: number }>
> = {
  "hard-cut": () => null, // No transition effect
  "flash-white": ({ durationInFrames }) => (
    <Flash color="white" durationInFrames={durationInFrames} />
  ),
  "flash-black": ({ durationInFrames }) => (
    <Flash color="black" durationInFrames={durationInFrames} />
  ),
  "zoom-punch": ({ durationInFrames }) => (
    <ZoomPunch durationInFrames={durationInFrames} />
  ),
  glitch: ({ durationInFrames }) => (
    <Glitch durationInFrames={durationInFrames} />
  ),
};

export const Trailer: React.FC<TrailerProps> = ({
  title,
  clips,
  end_card,
  source_episode,
}) => {
  const { fps } = useVideoConfig();

  // Calculate timing
  const titleDuration = 2 * fps; // 2 seconds for title card

  // Build sequence timeline
  let currentFrame = 0;
  const clipSequences: {
    clip: ClipData;
    from: number;
    durationInFrames: number;
  }[] = [];

  // Title card first
  currentFrame = titleDuration;

  // Add each clip with its transition
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const clipDurationFrames = Math.ceil(clip.duration * fps);
    const transitionFrames = Math.min(6, clipDurationFrames); // 6 frames (0.2s) for transition

    clipSequences.push({
      clip,
      from: currentFrame,
      durationInFrames: clipDurationFrames,
    });

    currentFrame += clipDurationFrames;
  }

  // End card
  const endCardStart = currentFrame;
  const endCardDuration = Math.ceil(end_card.duration * fps);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* Title Card */}
      <Sequence from={0} durationInFrames={titleDuration}>
        <TitleCard title={title} subtitle={source_episode} />
      </Sequence>

      {/* Clips with transitions */}
      {clipSequences.map(({ clip, from, durationInFrames }, index) => {
        const TransitionComponent = TransitionComponents[clip.transition];
        const transitionFrames = 6; // Quick flash

        return (
          <React.Fragment key={index}>
            {/* Main clip content */}
            <Sequence from={from} durationInFrames={durationInFrames}>
              <Clip
                text={clip.text}
                actor={clip.actor}
                index={index + 1}
                total={clips.length}
                videoSrc={clip.video_file}
                startSec={clip.start_sec}
              />
            </Sequence>

            {/* Transition overlay at start of clip */}
            {clip.transition !== "hard-cut" && (
              <Sequence from={from} durationInFrames={transitionFrames}>
                <TransitionComponent durationInFrames={transitionFrames} />
              </Sequence>
            )}
          </React.Fragment>
        );
      })}

      {/* End Card */}
      <Sequence from={endCardStart} durationInFrames={endCardDuration}>
        <EndCard text={end_card.text} subtext={end_card.subtext} />
      </Sequence>
    </AbsoluteFill>
  );
};
