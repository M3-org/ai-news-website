import { Composition } from "remotion";
import { Trailer, TrailerSchema, TrailerProps } from "./Trailer";

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
    },
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 2,
      dialogue_num: 12,
      start_word: 0,
      end_word: 12,
      transition: "glitch" as const,
      rationale: "Robots protecting robots from scam robots",
      text: "A RUGPULL DETECTOR for AI agents! We're living in a world where robots",
      start_sec: 169.38,
      end_sec: 173.351,
      duration: 3.971,
      actor: "jin",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
    },
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 3,
      dialogue_num: 3,
      start_word: 0,
      end_word: 12,
      transition: "flash-black" as const,
      rationale: "Million token context window hype",
      text: "And it has a ONE MILLION token context window in beta! A MILLION",
      start_sec: 197.546,
      end_sec: 201.331,
      duration: 3.785,
      actor: "jin",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
    },
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 4,
      dialogue_num: 2,
      start_word: 0,
      end_word: 14,
      transition: "flash-white" as const,
      rationale: "Market reality check",
      text: "Fam, ElizaOS market cap is sitting at 10 million. DOWN from almost 3 BILLION. That's",
      start_sec: 309.557,
      end_sec: 313.853,
      duration: 4.296,
      actor: "peepo",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
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
    },
  ],
  end_card: {
    text: "Cron Job",
    subtext: "Season 1 Episode 4 — One Month Down, AGI To Go",
    duration: 2,
  },
  source_episode: "2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go",
  generated_at: "2026-02-26T00:00:00Z",
};

const FPS = 30;

// Calculate total duration from props
const calculateDurationInFrames = (props: TrailerProps): number => {
  const titleDuration = 2; // 2 seconds for title card
  const clipsDuration = props.clips.reduce((sum, c) => sum + c.duration, 0);
  const endCardDuration = props.end_card.duration;
  const totalSeconds = titleDuration + clipsDuration + endCardDuration;
  return Math.ceil(totalSeconds * FPS);
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
