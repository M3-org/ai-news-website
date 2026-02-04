import { Composition, staticFile } from "remotion";
import { Trailer, TrailerSchema } from "./Trailer";

// Default props for Remotion Studio preview
// When no video_file is provided, clips show text-only mode
const defaultProps = {
  type: "trailer" as const,
  duration: 20,
  title: "Coming up on Cron Job...",
  music: "dramatic-hit.mp3",
  clips: [
    {
      source: "sample",
      scene: 1,
      dialogue_num: 1,
      start_word: 0,
      end_word: 5,
      transition: "flash-white" as const,
      rationale: "Sample clip",
      text: "This is a sample trailer clip",
      start_sec: 0,
      end_sec: 2,
      duration: 2,
      actor: "eliza",
      video_file: "", // Empty = text-only mode
    },
    {
      source: "sample",
      scene: 2,
      dialogue_num: 2,
      start_word: 0,
      end_word: 4,
      transition: "hard-cut" as const,
      rationale: "Second sample",
      text: "Another exciting moment here",
      start_sec: 10,
      end_sec: 12,
      duration: 2,
      actor: "jin",
      video_file: "",
    },
    {
      source: "sample",
      scene: 3,
      dialogue_num: 3,
      start_word: 0,
      end_word: 3,
      transition: "zoom-punch" as const,
      rationale: "Dramatic moment",
      text: "Wait, what just happened?!",
      start_sec: 20,
      end_sec: 22,
      duration: 2,
      actor: "hk47",
      video_file: "",
    },
  ],
  end_card: {
    text: "Cron Job",
    subtext: "New episodes weekly",
    duration: 2,
  },
  source_episode: "Preview Episode",
  generated_at: new Date().toISOString(),
};

export const RemotionRoot: React.FC = () => {
  const fps = 30;
  const totalDuration =
    2 + // Title card
    defaultProps.clips.reduce((sum, c) => sum + c.duration, 0) +
    defaultProps.end_card.duration;

  return (
    <>
      <Composition
        id="Trailer"
        component={Trailer}
        durationInFrames={Math.ceil(totalDuration * fps)}
        fps={fps}
        width={1920}
        height={1080}
        schema={TrailerSchema}
        defaultProps={defaultProps}
      />
      {/* Preview composition with shorter duration */}
      <Composition
        id="TrailerPreview"
        component={Trailer}
        durationInFrames={Math.ceil(15 * fps)}
        fps={fps}
        width={1920}
        height={1080}
        schema={TrailerSchema}
        defaultProps={defaultProps}
      />
    </>
  );
};
