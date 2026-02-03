/**
 * Episode Clip Extraction CLI
 *
 * Extract clips from episode videos using scene data from session-log.json
 * (or episode-data-timed.json for backwards compatibility)
 *
 * Commands:
 *   list     - Show scenes overview with timestamps and excerpts
 *   extract  - Cut clips by scene number(s)
 *   search   - Find and clip by transcript content
 *   help     - Show this help message
 *
 * Usage:
 *   npm run clip -- list episodes/2026-01-31_*_fps30.mp4
 *   npm run clip -- extract episodes/*_fps30.mp4 --scene=3
 *   npm run clip -- extract episodes/*_fps30.mp4 --from=2 --to=5
 *   npm run clip -- extract episodes/*_fps30.mp4 --scenes=1,3,7
 *   npm run clip -- search episodes/*_fps30.mp4 --query="ElizaOS" --padding=2
 */

import * as fs from "fs";
import * as path from "path";
import { execSync, spawn } from "child_process";
import { glob } from "glob";

// ============================================================================
// Types
// ============================================================================

interface Word {
  word: string;
  start: number;
  end: number;
}

interface Dialogue {
  type: string;
  number: number;
  line: string;
  actor: string;
  action?: string;
  startSec: number;
  endSec: number;
  words?: Word[];
}

interface Scene {
  number: number;
  location: string;
  description: string;
  startSec: number;
  endSec: number;
  dialogue: Dialogue[];
  transitionIn?: string;
  transitionOut?: string;
}

interface TimedEpisodeData {
  id: string;
  name?: string;
  premise?: string;
  scenes: Scene[];
}

interface CliArgs {
  command: "list" | "extract" | "search" | "help";
  video?: string;
  scene?: number;
  from?: number;
  to?: number;
  scenes?: number[];
  start?: number;  // Time in seconds for direct time-based clipping
  end?: number;    // Time in seconds for direct time-based clipping
  query?: string;
  padding?: number;
  output?: string;
  dryRun?: boolean;
  doExtract?: boolean;  // For search: actually extract clips (default: just show matches)
}

interface SearchMatch {
  scene: Scene;
  dialogue: Dialogue;
  matchedText: string;
}

// ============================================================================
// CLI Parsing
// ============================================================================

function parseArgs(): CliArgs {
  const command = (process.argv[2] || "help") as CliArgs["command"];
  const args: CliArgs = { command, padding: 2 };

  // Check for video path as positional argument
  let argStartIndex = 3;
  if (command !== "help" && process.argv[3] && !process.argv[3].startsWith("--")) {
    args.video = process.argv[3];
    argStartIndex = 4;
  }

  // Helper to get value: supports --arg=value and --arg value
  const getValue = (arg: string, nextArg: string | undefined): string | null => {
    if (arg.includes("=")) {
      return arg.split("=")[1];
    }
    if (nextArg && !nextArg.startsWith("-")) {
      return nextArg;
    }
    return null;
  };

  for (let i = argStartIndex; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const nextArg = process.argv[i + 1];

    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--extract") {
      args.doExtract = true;
    } else if (arg === "--scene" || arg.startsWith("--scene=")) {
      const val = getValue(arg, nextArg);
      if (val) {
        args.scene = parseInt(val, 10);
        if (!arg.includes("=")) i++;
      }
    } else if (arg === "--from" || arg.startsWith("--from=")) {
      const val = getValue(arg, nextArg);
      if (val) {
        args.from = parseInt(val, 10);
        if (!arg.includes("=")) i++;
      }
    } else if (arg === "--to" || arg.startsWith("--to=")) {
      const val = getValue(arg, nextArg);
      if (val) {
        args.to = parseInt(val, 10);
        if (!arg.includes("=")) i++;
      }
    } else if (arg === "--scenes" || arg.startsWith("--scenes=")) {
      const val = getValue(arg, nextArg);
      if (val) {
        args.scenes = val.split(",").map((n) => parseInt(n, 10));
        if (!arg.includes("=")) i++;
      }
    } else if (arg === "--query" || arg.startsWith("--query=")) {
      const val = getValue(arg, nextArg);
      if (val) {
        args.query = val;
        if (!arg.includes("=")) i++;
      }
    } else if (arg === "--padding" || arg.startsWith("--padding=")) {
      const val = getValue(arg, nextArg);
      if (val) {
        args.padding = parseFloat(val);
        if (!arg.includes("=")) i++;
      }
    } else if (arg === "--output" || arg.startsWith("--output=")) {
      const val = getValue(arg, nextArg);
      if (val) {
        args.output = val;
        if (!arg.includes("=")) i++;
      }
    } else if (arg === "--start" || arg.startsWith("--start=")) {
      const val = getValue(arg, nextArg);
      if (val) {
        args.start = parseTimeArg(val);
        if (!arg.includes("=")) i++;
      }
    } else if (arg === "--end" || arg.startsWith("--end=")) {
      const val = getValue(arg, nextArg);
      if (val) {
        args.end = parseTimeArg(val);
        if (!arg.includes("=")) i++;
      }
    }
  }

  return args;
}

/**
 * Parse time argument: supports "M:SS", "M:SS.ms", or plain seconds
 */
function parseTimeArg(value: string): number {
  if (value.includes(":")) {
    const parts = value.split(":");
    const mins = parseInt(parts[0], 10);
    const secs = parseFloat(parts[1]);
    return mins * 60 + secs;
  }
  return parseFloat(value);
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTimePrecise(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${mins}:${secs.padStart(5, "0")}`;
}

/**
 * Resolve video path (handles glob patterns) and find corresponding data file.
 * Looks for session-log.json first (v6 format), falls back to episode-data-timed.json.
 */
async function resolveVideoAndData(
  videoPattern: string
): Promise<{ videoPath: string; dataPath: string; isSessionLog: boolean }> {
  // Resolve glob pattern
  const matches = await glob(videoPattern, { nodir: true });

  if (matches.length === 0) {
    throw new Error(`No video file found matching: ${videoPattern}`);
  }

  const videoPath = matches[0];

  // Derive data file paths from video path
  // video: episodes/2026-01-31_Cron-Job_Welcome-To-The-Machine_fps30.mp4
  // v6:    episodes/2026-01-31_Cron-Job_Welcome-To-The-Machine_fps30_session-log.json
  // v5:    episodes/2026-01-31_Cron-Job_Welcome-To-The-Machine_fps30_episode-data-timed.json
  const ext = path.extname(videoPath);
  const baseName = path.basename(videoPath, ext);
  const dirName = path.dirname(videoPath);

  // Try session-log first (v6 format - recorder6 output)
  const sessionLogPath = path.join(dirName, `${baseName}_session-log.json`);
  if (fs.existsSync(sessionLogPath)) {
    return { videoPath, dataPath: sessionLogPath, isSessionLog: true };
  }

  // Fall back to episode-data-timed (transcribe.ts output)
  const timedDataPath = path.join(dirName, `${baseName}_episode-data-timed.json`);
  if (fs.existsSync(timedDataPath)) {
    return { videoPath, dataPath: timedDataPath, isSessionLog: false };
  }

  throw new Error(`Episode data file not found. Looked for:\n  - ${sessionLogPath}\n  - ${timedDataPath}`);
}

/**
 * Load timed episode data from either session-log.json or episode-data-timed.json.
 * Handles both formats:
 * - session-log.json: data at .episode.scenes
 * - episode-data-timed.json: data at .scenes
 */
function loadTimedData(dataPath: string, isSessionLog: boolean): TimedEpisodeData {
  const raw = fs.readFileSync(dataPath, "utf-8");
  const parsed = JSON.parse(raw);

  if (isSessionLog) {
    // v6 format: session-log.json has .episode.scenes
    const episode = parsed.episode || parsed.episode_data;
    if (!episode?.scenes) {
      throw new Error(`Invalid session-log format: missing episode.scenes in ${dataPath}`);
    }
    return {
      id: episode.id || "",
      name: episode.name,
      premise: episode.premise,
      scenes: episode.scenes,
    };
  }

  // Legacy format: episode-data-timed.json has .scenes at root
  return parsed as TimedEpisodeData;
}

function getEpisodeBaseName(videoPath: string): string {
  const baseName = path.basename(videoPath, path.extname(videoPath));
  // Remove fps suffix for cleaner output names
  return baseName.replace(/_fps\d+$/, "");
}

function ensureOutputDir(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

// ============================================================================
// Core Functions
// ============================================================================

function listScenes(data: TimedEpisodeData, videoPath?: string): void {
  // Extract title from filename
  let title = data.name || "";
  if (!title && videoPath) {
    const base = path.basename(videoPath, path.extname(videoPath));
    const parts = base.split("_");
    if (parts.length >= 3) {
      title = parts.slice(1, -1).join(" ").replace(/-/g, " ");
    }
  }

  const header = [data.id, title].filter(Boolean).join(" - ");
  console.log(`\n${header} (${data.scenes.length} scenes)`);

  // Column headers
  console.log(`\n  #  START    DUR   LOCATION          PREVIEW`);
  console.log(`${"─".repeat(110)}`);

  for (let i = 0; i < data.scenes.length; i++) {
    const scene = data.scenes[i];
    const prevScene = data.scenes[i - 1];

    // Visual start = when previous scene ends (actual visual transition)
    const visualStart = prevScene ? prevScene.endSec : scene.startSec;
    const duration = Math.round(scene.endSec - visualStart);

    // Get first speech line for preview
    const firstSpeech = scene.dialogue.find(d => d.type === "speech" && d.line);
    const preview = firstSpeech?.line || scene.description || "";
    const maxPreview = 70;
    const truncated = preview.length > maxPreview
      ? preview.substring(0, maxPreview - 1) + "…"
      : preview;

    // Scene row
    console.log(
      `${scene.number.toString().padStart(3)}  ` +
      `${formatTime(visualStart).padEnd(8)} ` +
      `${(duration + "s").padStart(4)}  ` +
      `${scene.location.padEnd(16).substring(0, 16)}  ` +
      `${truncated}`
    );
  }
  console.log();
}

function extractClip(
  videoPath: string,
  startSec: number,
  endSec: number,
  outputPath: string,
  dryRun: boolean = false
): boolean {
  const duration = endSec - startSec;

  // Output seeking (-ss after -i) for frame-accurate cuts
  // Slower but guarantees exact start frame
  const ffmpegArgs = [
    "-y",
    "-i", videoPath,
    "-ss", startSec.toString(),  // Output seeking (frame-accurate)
    "-t", duration.toString(),
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-c:a", "aac",
    "-b:a", "192k",
    outputPath,
  ];

  console.log(`\nExtracting: ${formatTimePrecise(startSec)} - ${formatTimePrecise(endSec)} (${Math.round(duration)}s)`);
  console.log(`Output: ${outputPath}`);

  if (dryRun) {
    console.log(`[DRY RUN] Would run: ffmpeg ${ffmpegArgs.join(" ")}`);
    return true;
  }

  try {
    execSync(`ffmpeg ${ffmpegArgs.join(" ")}`, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log("✓ Extracted successfully");
    return true;
  } catch (error) {
    console.error("✗ Extraction failed:", (error as Error).message);
    return false;
  }
}

function searchTranscript(data: TimedEpisodeData, query: string): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const queryLower = query.toLowerCase();

  for (const scene of data.scenes) {
    for (const dialogue of scene.dialogue) {
      // Skip non-speech entries (media, etc.) that don't have text
      if (!dialogue.line) continue;

      if (dialogue.line.toLowerCase().includes(queryLower)) {
        matches.push({
          scene,
          dialogue,
          matchedText: dialogue.line,
        });
      }
    }
  }

  return matches;
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleList(args: CliArgs): Promise<void> {
  if (!args.video) {
    console.error("Error: Video path required for list command");
    console.error("Usage: npm run clip -- list <video-path>");
    process.exit(1);
  }

  const { videoPath, dataPath, isSessionLog } = await resolveVideoAndData(args.video);
  const data = loadTimedData(dataPath, isSessionLog);
  listScenes(data, videoPath);
}

async function handleExtract(args: CliArgs): Promise<void> {
  if (!args.video) {
    console.error("Error: Video path required for extract command");
    console.error("Usage: npm run clip -- extract <video-path> --scene=N");
    process.exit(1);
  }

  const { videoPath, dataPath, isSessionLog } = await resolveVideoAndData(args.video);
  const data = loadTimedData(dataPath, isSessionLog);
  const episodeName = getEpisodeBaseName(videoPath);
  const outputDir = args.output || "episodes/clips";
  ensureOutputDir(outputDir);

  // Direct time-based clipping (--start and --end)
  if (args.start !== undefined && args.end !== undefined) {
    const startFormatted = formatTime(args.start).replace(":", "m") + "s";
    const endFormatted = formatTime(args.end).replace(":", "m") + "s";
    const outputPath = path.join(outputDir, `${episodeName}_${startFormatted}-${endFormatted}.mp4`);
    extractClip(videoPath, args.start, args.end, outputPath, args.dryRun);
    return;
  }

  // Determine which scenes to extract
  let scenesToExtract: number[] = [];

  if (args.scene !== undefined) {
    scenesToExtract = [args.scene];
  } else if (args.scenes !== undefined) {
    scenesToExtract = args.scenes;
  } else if (args.from !== undefined && args.to !== undefined) {
    for (let i = args.from; i <= args.to; i++) {
      scenesToExtract.push(i);
    }
  } else {
    console.error("Error: Specify --start=M:SS --end=M:SS, --scene=N, --scenes=1,3,7, or --from=N --to=M");
    process.exit(1);
  }

  // Validate scene numbers
  const maxScene = Math.max(...data.scenes.map((s) => s.number));
  for (const num of scenesToExtract) {
    if (num < 1 || num > maxScene) {
      console.error(`Error: Scene ${num} out of range (1-${maxScene})`);
      process.exit(1);
    }
  }

  // Helper to get clip start (after transition completes)
  const getClipStart = (sceneNum: number): number => {
    const sceneIdx = data.scenes.findIndex((s) => s.number === sceneNum);
    const scene = data.scenes[sceneIdx];
    if (!scene) return 0;

    // For first scene, use scene's startSec
    if (sceneIdx <= 0) {
      return scene.startSec;
    }

    // Visual start = when previous scene ends
    const visualStart = data.scenes[sceneIdx - 1].endSec;

    // Find first dialogue with audio that starts at or after visual transition
    // Use first word's start time (actual audio) instead of dialogue startSec
    const firstDialogueAfterTransition = scene.dialogue
      .filter(d => {
        const audioStart = d.words?.[0]?.start ?? d.startSec;
        return audioStart >= visualStart;
      })
      .sort((a, b) => {
        const aStart = a.words?.[0]?.start ?? a.startSec;
        const bStart = b.words?.[0]?.start ?? b.startSec;
        return aStart - bStart;
      })[0];

    // Use actual audio start (first word) for precise timing
    const audioStart = firstDialogueAfterTransition?.words?.[0]?.start
      ?? firstDialogueAfterTransition?.startSec
      ?? visualStart;

    // Add small buffer for video encoding latency (~5 frames at 30fps)
    return audioStart + 0.17;
  };

  // Extract each scene or combined range
  if (scenesToExtract.length === 1) {
    // Single scene
    const sceneNum = scenesToExtract[0];
    const scene = data.scenes.find((s) => s.number === sceneNum);
    if (!scene) {
      console.error(`Error: Scene ${sceneNum} not found`);
      process.exit(1);
    }

    // Start after transition (first dialogue after visual change)
    const startSec = getClipStart(sceneNum);
    const outputPath = path.join(outputDir, `${episodeName}_scene${sceneNum}.mp4`);
    extractClip(videoPath, startSec, scene.endSec, outputPath, args.dryRun);
  } else if (args.from !== undefined && args.to !== undefined) {
    // Continuous range - extract as single clip
    const fromScene = data.scenes.find((s) => s.number === args.from);
    const toScene = data.scenes.find((s) => s.number === args.to);

    if (!fromScene || !toScene) {
      console.error(`Error: Scene range ${args.from}-${args.to} invalid`);
      process.exit(1);
    }

    const startSec = getClipStart(args.from);
    const outputPath = path.join(
      outputDir,
      `${episodeName}_scene${args.from}-${args.to}.mp4`
    );
    extractClip(videoPath, startSec, toScene.endSec, outputPath, args.dryRun);
  } else {
    // Multiple specific scenes - extract each separately
    for (const sceneNum of scenesToExtract) {
      const scene = data.scenes.find((s) => s.number === sceneNum);
      if (!scene) {
        console.error(`Warning: Scene ${sceneNum} not found, skipping`);
        continue;
      }

      const outputPath = path.join(outputDir, `${episodeName}_scene${sceneNum}.mp4`);
      extractClip(videoPath, scene.startSec, scene.endSec, outputPath, args.dryRun);
    }
  }
}

async function handleSearch(args: CliArgs): Promise<void> {
  if (!args.video) {
    console.error("Error: Video path required for search command");
    console.error('Usage: npm run clip -- search <video-path> --query="search term"');
    process.exit(1);
  }

  if (!args.query) {
    console.error("Error: --query required for search command");
    process.exit(1);
  }

  const { videoPath, dataPath, isSessionLog } = await resolveVideoAndData(args.video);
  const data = loadTimedData(dataPath, isSessionLog);
  const episodeName = getEpisodeBaseName(videoPath);
  const outputDir = args.output || "episodes/clips";
  const padding = args.padding || 2;

  const matches = searchTranscript(data, args.query);

  if (matches.length === 0) {
    console.log(`No matches found for query: "${args.query}"`);
    return;
  }

  console.log(`\nFound ${matches.length} match(es) for "${args.query}":\n`);

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    console.log(
      `${i + 1}. Scene ${match.scene.number} [${formatTime(match.dialogue.startSec)}] ${match.dialogue.actor}:`
    );
    console.log(`   "${match.matchedText}"`);
    console.log();
  }

  // Only extract if --extract flag is passed
  if (!args.doExtract) {
    console.log(`Add --extract to cut these clips.`);
    return;
  }

  // Extract clips
  ensureOutputDir(outputDir);
  const sanitizedQuery = args.query.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const startWithPadding = Math.max(0, match.dialogue.startSec - padding);
    const endWithPadding = match.dialogue.endSec + padding;

    const outputPath = path.join(
      outputDir,
      `${episodeName}_search_${sanitizedQuery}_${i + 1}.mp4`
    );
    extractClip(videoPath, startWithPadding, endWithPadding, outputPath, args.dryRun);
  }
}

function showHelp(): void {
  console.log(`
Episode Clip Extraction CLI

Commands:
  list      Show scenes overview with timestamps and excerpts
  extract   Cut clips by scene number(s) or time range
  search    Find dialogue by transcript content
  help      Show this help message

Usage:
  npm run clip -- list <video-path>
  npm run clip -- extract <video-path> --scene=N
  npm run clip -- extract <video-path> --from=N --to=M
  npm run clip -- extract <video-path> --scenes=1,3,7
  npm run clip -- extract <video-path> --start=1:30 --end=2:45
  npm run clip -- search <video-path> --query="search term"
  npm run clip -- search <video-path> --query="term" --extract

Options:
  --scene=N         Extract single scene by number
  --from=N --to=M   Extract scene range as single clip
  --scenes=1,3,7    Extract multiple specific scenes (separate clips)
  --start=M:SS      Start time for direct time-based clipping
  --end=M:SS        End time for direct time-based clipping
  --query="text"    Search transcript for matching dialogue
  --extract         Actually cut clips (for search command)
  --padding=N       Seconds of padding before/after search matches (default: 2)
  --output=DIR      Output directory (default: episodes/clips)
  --dry-run         Show what would be done without executing

Examples:
  npm run clip -- list episodes/*.mp4
  npm run clip -- extract episodes/*.mp4 --scene=1
  npm run clip -- extract episodes/*.mp4 --from=2 --to=5
  npm run clip -- extract episodes/*.mp4 --start=1:30 --end=2:00
  npm run clip -- search episodes/*.mp4 --query="ElizaOS"
  npm run clip -- search episodes/*.mp4 --query="ElizaOS" --extract --padding=3
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  switch (args.command) {
    case "list":
      await handleList(args);
      break;
    case "extract":
      await handleExtract(args);
      break;
    case "search":
      await handleSearch(args);
      break;
    case "help":
    default:
      showHelp();
      break;
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
