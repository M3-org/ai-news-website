import { Composition } from "remotion";
import { Trailer, TrailerSchema, TrailerProps } from "./Trailer";
import { OVERLAP_FRAMES } from "./transitions";

// Generate evenly-spaced word timing from text and clip boundaries (for preview only)
const syntheticWords = (text: string, startSec: number, endSec: number) => {
  const parts = text.split(" ");
  const dur = endSec - startSec;
  const gap = dur / parts.length;
  return parts.map((word, i) => ({
    word,
    start: +(startSec + i * gap).toFixed(3),
    end: +(startSec + (i + 1) * gap - 0.02).toFixed(3),
  }));
};

// Default props for Remotion Studio preview
// When no video_file is provided, clips show text-only mode
const defaultProps: TrailerProps = {
  type: "trailer" as const,
  duration: 30.5,
  title: "Coming up on Cron Job...",
  music: "dramatic-hit.mp3",
  clips: [
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 1,
      dialogue_num: 3,
      start_word: 0,
      end_word: 12,
      transition: "flash-white" as const,
      rationale: "Hook: tease the wild stories",
      text: "Today we have an AI agent that secretly joined our Discord and then",
      start_sec: 24.886,
      end_sec: 28.462,
      duration: 3.576,
      actor: "eliza",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
      words: syntheticWords("Today we have an AI agent that secretly joined our Discord and then", 24.886, 28.462),
    },
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 2,
      dialogue_num: 3,
      start_word: 0,
      end_word: 14,
      transition: "zoom-punch" as const,
      rationale: "Shock: AI pretending to be human",
      text: "Wait- an AI was just HANGING OUT in Discord pretending to be a PERSON?! That's",
      start_sec: 82.083,
      end_sec: 86.611,
      duration: 4.528,
      actor: "jin",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
      words: syntheticWords("Wait- an AI was just HANGING OUT in Discord pretending to be a PERSON?! That's", 82.083, 86.611),
    },
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 2,
      dialogue_num: 12,
      start_word: 0,
      end_word: 12,
      transition: "side-scroll-left" as const,
      rationale: "Robots protecting robots from scam robots",
      text: "A RUGPULL DETECTOR for AI agents! We're living in a world where robots",
      start_sec: 169.38,
      end_sec: 173.351,
      duration: 3.971,
      actor: "jin",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
      words: syntheticWords("A RUGPULL DETECTOR for AI agents! We're living in a world where robots", 169.38, 173.351),
    },
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 3,
      dialogue_num: 3,
      start_word: 0,
      end_word: 12,
      transition: "glitch" as const,
      rationale: "Million token context window hype",
      text: "And it has a ONE MILLION token context window in beta! A MILLION",
      start_sec: 197.546,
      end_sec: 201.331,
      duration: 3.785,
      actor: "jin",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
      words: syntheticWords("And it has a ONE MILLION token context window in beta! A MILLION", 197.546, 201.331),
    },
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 4,
      dialogue_num: 2,
      start_word: 0,
      end_word: 14,
      transition: "split" as const,
      rationale: "Market reality check",
      text: "Fam, ElizaOS market cap is sitting at 10 million. DOWN from almost 3 BILLION. That's",
      start_sec: 309.557,
      end_sec: 313.853,
      duration: 4.296,
      actor: "peepo",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
      words: syntheticWords("Fam, ElizaOS market cap is sitting at 10 million. DOWN from almost 3 BILLION. That's", 309.557, 313.853),
    },
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 8,
      dialogue_num: 8,
      start_word: 0,
      end_word: 14,
      transition: "zoom-punch" as const,
      rationale: "Hype closing",
      text: "And I'm Jin saying HAPPY ONE MONTH ANNIVERSARY Cron Job! March is coming, Milady NFTs",
      start_sec: 844.04,
      end_sec: 850.356,
      duration: 6.316,
      actor: "jin",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
      words: syntheticWords("And I'm Jin saying HAPPY ONE MONTH ANNIVERSARY Cron Job! March is coming, Milady NFTs", 844.04, 850.356),
    },
  ],
  end_card: {
    text: "Cron Job",
    subtext: "Season 1 Episode 4 — One Month Down, AGI To Go",
    duration: 2,
  },
  source_episode: "2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go",
  generated_at: "2026-02-26T00:00:00Z",
  modulation: {
    glbFile: "Modulation_GLBs/cron_red.glb",
    effectMap: {},
    effectorInnerRadius: 1,
    effectorOuterRadius: 8.6,
    effectorStrength: 1,
    rotationAxis: "z",
    fisheyeStrength: -0.15,
    fisheyeAudioMod: 0,
    fisheyeZoom: 1,
    audioFile: "",
    audioShakeIntensity: 0.05,
    audioShakeBass: 0.2,
    opacity: 1,
  },
};

const FPS = 30;

// Calculate total duration accounting for transition overlaps
const calculateDurationInFrames = (props: TrailerProps): number => {
  const titleFrames = 2 * FPS;
  const endCardFrames = Math.ceil(props.end_card.duration * FPS);

  // Sum clip durations minus overlaps between them
  let clipsFrames = 0;
  for (let i = 0; i < props.clips.length; i++) {
    clipsFrames += Math.ceil(props.clips[i].duration * FPS);
    // Subtract overlap for all clips after the first
    if (i > 0) {
      clipsFrames -= OVERLAP_FRAMES[props.clips[i].transition] || 0;
    }
  }

  return titleFrames + clipsFrames + endCardFrames;
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Trailer"
        component={Trailer}
        // Use calculateMetadata to dynamically set duration based on props
        calculateMetadata={({ props }) => {
          return {
            durationInFrames: calculateDurationInFrames(props),
            fps: FPS,
            width: 1920,
            height: 1080,
          };
        }}
        schema={TrailerSchema}
        defaultProps={defaultProps}
      />
      {/* Preview composition with fixed shorter duration for quick previews */}
      <Composition
        id="TrailerPreview"
        component={Trailer}
        durationInFrames={Math.ceil(15 * FPS)}
        fps={FPS}
        width={1920}
        height={1080}
        schema={TrailerSchema}
        defaultProps={defaultProps}
      />
    </>
  );
};
