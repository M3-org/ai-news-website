import { Composition } from "remotion";
import { Trailer, TrailerSchema, TrailerProps } from "./Trailer";
import { DailyCard } from "./DailyCard";
import { DailyCardProps, computeTotalFrames } from "./timing";
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
      {/* Daily news briefing card — 1080×1080 square, duration computed from content */}
      <Composition
        id="DailyCard"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={DailyCard as any}
        calculateMetadata={({ props }) => ({
          durationInFrames: computeTotalFrames(props as DailyCardProps),
          fps: 30,
          width: 1080,
          height: 1080,
        })}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          date: "2026-03-09",
          headline: "ElizaOS ecosystem accelerates with new agent deployments and community milestones.",
          key_facts: [
            "Agent framework reaches 10k GitHub stars",
            "New plugin architecture ships in v1.8",
            "Community treasury vote passes with 94% approval",
          ],
          github_prs: [
            { primary: "feat: add multi-agent coordination protocol", secondary: "@shakkernerd", avatar_url: "https://github.com/shakkernerd.png?size=64" },
            { primary: "fix: memory leak in embedding pipeline", secondary: "@wtfsayo", avatar_url: "https://github.com/wtfsayo.png?size=64" },
            { primary: "chore: upgrade to latest model adapters", secondary: "@lalalune", avatar_url: "https://github.com/lalalune.png?size=64" },
          ],
          discord_updates: [
            { primary: "Plugin ecosystem growing with 40+ community extensions", secondary: "#development", initials: "DV" },
            { primary: "New governance proposal hits quorum in 6 hours", secondary: "#governance", initials: "GV" },
            { primary: "Weekly builder call recap now in docs", secondary: "#announcements", initials: "WB" },
          ],
          user_feedback: [
            { primary: "Onboarding flow is smoother with new wizard UI", secondary: "positive" },
            { primary: "Docs need more examples for custom plugins", secondary: "constructive" },
            { primary: "Agent response latency improved significantly", secondary: "positive" },
          ],
          council_focus: "The project is navigating a critical trust deficit as community anxiety over token performance intersects with perceived team attrition and delayed technical milestones.",
          council_topics: [
            { primary: "Core members removing ElizaOS from social bios has triggered FUD requiring immediate leadership transparency.", secondary: "Operational Continuity & Trust Recovery", avatar_url: "characters/eliza/1.png" },
            { primary: "Agent-to-vendor credit lines and pre-trade risk scoring indicate a shift toward financially-autonomous agent operations.", secondary: "Agent Autonomy & Risk Infrastructure", avatar_url: "characters/shaw/9.png" },
          ],
          council_questions: [
            { primary: "How should the Council address the perceived 'exit' of key contributors to stabilize community sentiment?", secondary: "Operational Continuity", avatar_url: "characters/marc/13.png" },
            { primary: "Is the diversification into side-projects diluting focus on ElizaOS core infrastructure?", secondary: "Strategic Focus", avatar_url: "characters/spartan/2.png" },
            { primary: "Should ElizaOS prioritize the Agent-to-Vendor Credit Line primitive as a core reliability feature?", secondary: "Agent Autonomy", avatar_url: "characters/peepo/2.png" },
          ],
          poster_url: "daily-card-overall.png",
          site_url: "elizaos.news/daily/2026-03-09",
          images: {
            overall: "daily-card-overall.png",
            github: "daily-card-github.png",
            discord: "daily-card-discord.png",
            market: "daily-card-market.png",
            strategic: "daily-card-strategic.png",
          },
        } satisfies DailyCardProps}
      />
    </>
  );
};
