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
      text: "Today we have an AI agent that secretly joined our Discord and",
      start_sec: 24.35,
      end_sec: 27.763,
      duration: 3.413,
      actor: "eliza",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
      words: [{"word":"Today","start":24.35,"end":24.687},{"word":"we","start":24.745,"end":24.814},{"word":"have","start":24.861,"end":25.012},{"word":"an","start":25.035,"end":25.093},{"word":"AI","start":25.163,"end":25.523},{"word":"agent","start":25.569,"end":25.917},{"word":"that","start":25.964,"end":26.138},{"word":"secretly","start":26.196,"end":26.637},{"word":"joined","start":26.707,"end":26.939},{"word":"our","start":26.962,"end":27.055},{"word":"Discord","start":27.102,"end":27.566},{"word":"and","start":27.636,"end":27.763}],
    },
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 2,
      dialogue_num: 3,
      start_word: 0,
      end_word: 14,
      transition: "zoom-punch" as const,
      rationale: "Shock: AI pretending to be human",
      text: "Wait- an AI was just HANGING OUT in Discord pretending to be a PERSON?!",
      start_sec: 82.195,
      end_sec: 86.05,
      duration: 3.855,
      actor: "jin",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
      words: [{"word":"Wait-","start":82.195,"end":82.787},{"word":"an","start":82.961,"end":83.077},{"word":"AI","start":83.159,"end":83.484},{"word":"was","start":83.542,"end":83.623},{"word":"just","start":83.681,"end":83.82},{"word":"HANGING","start":83.867,"end":84.145},{"word":"OUT","start":84.18,"end":84.273},{"word":"in","start":84.308,"end":84.354},{"word":"Discord","start":84.413,"end":84.761},{"word":"pretending","start":84.796,"end":85.156},{"word":"to","start":85.19,"end":85.237},{"word":"be","start":85.283,"end":85.365},{"word":"a","start":85.399,"end":85.423},{"word":"PERSON?!","start":85.492,"end":86.05}],
    },
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 2,
      dialogue_num: 12,
      start_word: 0,
      end_word: 12,
      transition: "side-scroll-left" as const,
      rationale: "Robots protecting robots from scam robots",
      text: "A RUGPULL DETECTOR for AI agents! We're living in a world where",
      start_sec: 171.632,
      end_sec: 175.161,
      duration: 3.529,
      actor: "jin",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
      words: [{"word":"A","start":171.632,"end":171.69},{"word":"RUGPULL","start":171.806,"end":172.236},{"word":"DETECTOR","start":172.305,"end":172.7},{"word":"for","start":172.758,"end":172.863},{"word":"AI","start":172.944,"end":173.304},{"word":"agents!","start":173.35,"end":173.896},{"word":"We're","start":174.105,"end":174.302},{"word":"living","start":174.337,"end":174.558},{"word":"in","start":174.604,"end":174.651},{"word":"a","start":174.685,"end":174.709},{"word":"world","start":174.755,"end":174.976},{"word":"where","start":175.011,"end":175.161}],
    },
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 3,
      dialogue_num: 3,
      start_word: 0,
      end_word: 12,
      transition: "glitch" as const,
      rationale: "Million token context window hype",
      text: "And it has a ONE MILLION token context window in beta! A",
      start_sec: 200.497,
      end_sec: 203.759,
      duration: 3.262,
      actor: "jin",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
      words: [{"word":"And","start":200.497,"end":200.625},{"word":"it","start":200.694,"end":200.752},{"word":"has","start":200.787,"end":200.927},{"word":"a","start":200.985,"end":201.008},{"word":"ONE","start":201.101,"end":201.333},{"word":"MILLION","start":201.403,"end":201.762},{"word":"token","start":201.821,"end":202.122},{"word":"context","start":202.204,"end":202.633},{"word":"window","start":202.68,"end":202.923},{"word":"in","start":202.982,"end":203.028},{"word":"beta!","start":203.098,"end":203.55},{"word":"A","start":203.701,"end":203.759}],
    },
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 4,
      dialogue_num: 2,
      start_word: 0,
      end_word: 14,
      transition: "split" as const,
      rationale: "Market reality check",
      text: "Fam, ElizaOS market cap is sitting at 10 million. DOWN from almost 3 BILLION.",
      start_sec: 313.757,
      end_sec: 317.867,
      duration: 4.11,
      actor: "peepo",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
      words: [{"word":"Fam,","start":313.757,"end":314.221},{"word":"ElizaOS","start":314.245,"end":314.767},{"word":"market","start":314.837,"end":315.092},{"word":"cap","start":315.139,"end":315.29},{"word":"is","start":315.348,"end":315.406},{"word":"sitting","start":315.452,"end":315.684},{"word":"at","start":315.719,"end":315.777},{"word":"10","start":315.812,"end":315.951},{"word":"million.","start":315.998,"end":316.369},{"word":"DOWN","start":316.648,"end":316.857},{"word":"from","start":316.892,"end":317.019},{"word":"almost","start":317.054,"end":317.275},{"word":"3","start":317.31,"end":317.495},{"word":"BILLION.","start":317.542,"end":317.867}],
    },
    {
      source: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go_session-log.json",
      scene: 8,
      dialogue_num: 8,
      start_word: 0,
      end_word: 14,
      transition: "zoom-punch" as const,
      rationale: "Hype closing",
      text: "And I'm Jin saying HAPPY ONE MONTH ANNIVERSARY Cron Job! March is coming, Milady",
      start_sec: 850.952,
      end_sec: 856.664,
      duration: 5.712,
      actor: "jin",
      video_file: "episodes/2026-02-23_Cron-Job_One-Month-Down-Agi-To-Go.mp4",
      words: [{"word":"And","start":850.952,"end":851.091},{"word":"I'm","start":851.173,"end":851.3},{"word":"Jin","start":851.37,"end":851.591},{"word":"saying","start":851.683,"end":852.032},{"word":"HAPPY","start":852.276,"end":852.577},{"word":"ONE","start":852.647,"end":852.775},{"word":"MONTH","start":852.821,"end":853.019},{"word":"ANNIVERSARY","start":853.053,"end":853.634},{"word":"Cron","start":854.331,"end":854.621},{"word":"Job!","start":854.69,"end":855.062},{"word":"March","start":855.271,"end":855.538},{"word":"is","start":855.573,"end":855.642},{"word":"coming,","start":855.712,"end":856.13},{"word":"Milady","start":856.304,"end":856.664}],
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
