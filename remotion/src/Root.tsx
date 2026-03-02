import { Composition } from "remotion";
import { Trailer, TrailerSchema, TrailerProps } from "./Trailer";
import { OVERLAP_FRAMES } from "./transitions";

// Default props for Remotion Studio preview
// When no video_file is provided, clips show text-only mode
const defaultProps: TrailerProps = {
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
      text: "This is a sample trailer clip with EXCITING words",
      start_sec: 0,
      end_sec: 2,
      duration: 2,
      actor: "eliza",
      video_file: "",
    },
    {
      source: "sample",
      scene: 2,
      dialogue_num: 2,
      start_word: 0,
      end_word: 4,
      transition: "zoom-punch" as const,
      rationale: "Second sample",
      text: "Another EXCITING moment here",
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
      transition: "glitch" as const,
      rationale: "Dramatic moment",
      text: "Wait, what just HAPPENED?!",
      start_sec: 20,
      end_sec: 22,
      duration: 2,
      actor: "peepo",
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
  modulation: {
    glbFile: "Modulation_GLBs/cron_red.glb",
    effectMap: {},
    effectorInnerRadius: 1,
    effectorOuterRadius: 8.6,
    effectorStrength: 1,
    rotationAxis: "z" as const,
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
