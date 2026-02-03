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
  isMediaCommand?: boolean;  // True for aishaw/roll-commercial/roll-media/clear-media
}

interface Scene {
  number: number;
  location: string;
  description: string;
  startSec: number;        // First dialogue audio start
  endSec: number;          // Last dialogue audio end
  visualStartSec?: number; // Scene transition start (more accurate for clips)
  visualEndSec?: number;   // Scene transition end
  dialogue: Dialogue[];
  in?: string;             // Transition in type (fade, cut, etc.)
  out?: string;            // Transition out type
  cast?: Record<string, string>;  // Slot-to-actor mapping
}

interface TimedEpisodeData {
  id: string;
  name?: string;
  premise?: string;
  scenes: Scene[];
}

interface CliArgs {
  command: "list" | "extract" | "search" | "help";
  videos: string[];  // Video paths (supports multiple from shell glob expansion)
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
  location?: string;  // Extract scenes by location name
  actor?: string;     // Extract dialogue by actor name
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
  const args: CliArgs = { command, videos: [], padding: 2 };

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

  // Process all arguments starting from index 3
  for (let i = 3; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const nextArg = process.argv[i + 1];

    // Collect positional arguments (video paths) - anything not starting with --
    if (!arg.startsWith("--")) {
      args.videos.push(arg);
      continue;
    }

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
    } else if (arg === "--location" || arg.startsWith("--location=")) {
      const val = getValue(arg, nextArg);
      if (val) {
        args.location = val;
        if (!arg.includes("=")) i++;
      }
    } else if (arg === "--actor" || arg.startsWith("--actor=")) {
      const val = getValue(arg, nextArg);
      if (val) {
        args.actor = val;
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

interface VideoData {
  videoPath: string;
  dataPath: string;
  isSessionLog: boolean;
}

/**
 * Resolve a single video path and find its corresponding data file.
 */
function resolveDataForVideo(videoPath: string): VideoData | null {
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

  return null;
}

/**
 * Resolve video path(s) and find corresponding data files.
 * Accepts either:
 * - An array of explicit paths (from shell glob expansion)
 * - A single glob pattern string
 */
async function resolveVideosAndData(
  videoPaths: string[]
): Promise<VideoData[]> {
  let allPaths: string[] = [];

  // If single path that looks like a glob pattern, expand it
  if (videoPaths.length === 1 && (videoPaths[0].includes("*") || videoPaths[0].includes("?"))) {
    const matches = await glob(videoPaths[0], { nodir: true });
    allPaths = matches;
  } else {
    // Use paths as-is (shell already expanded them)
    allPaths = videoPaths;
  }

  if (allPaths.length === 0) {
    throw new Error(`No video files found`);
  }

  const results: VideoData[] = [];
  const errors: string[] = [];

  for (const videoPath of allPaths) {
    const data = resolveDataForVideo(videoPath);
    if (data) {
      results.push(data);
    } else {
      errors.push(path.basename(videoPath));
    }
  }

  if (results.length === 0) {
    throw new Error(`No episode data files found for any matched videos.\nVideos without data: ${errors.join(", ")}`);
  }

  if (errors.length > 0) {
    console.log(`Note: Skipping ${errors.length} video(s) without data files: ${errors.join(", ")}`);
  }

  return results;
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

    // Use visual timing when available, otherwise fall back to dialogue timing
    const sceneStart = scene.visualStartSec ?? scene.startSec;
    const sceneEnd = scene.visualEndSec ?? scene.endSec;
    const duration = Math.round(sceneEnd - sceneStart);

    // Get first speech line for preview (skip media commands)
    // Check both the flag (new recordings) and content (old recordings)
    const isMediaCmd = (d: Dialogue) =>
      d.isMediaCommand ||
      d.actor === 'aishaw' ||
      d.line === 'roll-commercial' ||
      d.line === 'roll-media' ||
      d.line === 'clear-media';
    const firstSpeech = scene.dialogue.find(d =>
      d.line && !isMediaCmd(d) && d.type !== "action" && d.type !== "media"
    );
    const preview = firstSpeech?.line || scene.description || "";
    const maxPreview = 70;
    const truncated = preview.length > maxPreview
      ? preview.substring(0, maxPreview - 1) + "…"
      : preview;

    // Scene row
    console.log(
      `${scene.number.toString().padStart(3)}  ` +
      `${formatTime(sceneStart).padEnd(8)} ` +
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
  if (args.videos.length === 0) {
    console.error("Error: Video path required for list command");
    console.error("Usage: npm run clip -- list <video-path>");
    process.exit(1);
  }

  const videos = await resolveVideosAndData(args.videos);

  for (const { videoPath, dataPath, isSessionLog } of videos) {
    const data = loadTimedData(dataPath, isSessionLog);
    listScenes(data, videoPath);
  }
}

async function handleExtract(args: CliArgs): Promise<void> {
  if (args.videos.length === 0) {
    console.error("Error: Video path required for extract command");
    console.error("Usage: npm run clip -- extract <video-path> --scene=N");
    process.exit(1);
  }

  const videos = await resolveVideosAndData(args.videos);
  const outputDir = args.output || "episodes/clips";
  ensureOutputDir(outputDir);

  for (const { videoPath, dataPath, isSessionLog } of videos) {
    if (videos.length > 1) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`Processing: ${path.basename(videoPath)}`);
      console.log("=".repeat(60));
    }

    await extractFromVideo(videoPath, dataPath, isSessionLog, args, outputDir);
  }
}

async function extractFromVideo(
  videoPath: string,
  dataPath: string,
  isSessionLog: boolean,
  args: CliArgs,
  outputDir: string
): Promise<void> {
  const data = loadTimedData(dataPath, isSessionLog);
  const episodeName = getEpisodeBaseName(videoPath);

  // Direct time-based clipping (--start and --end)
  if (args.start !== undefined && args.end !== undefined) {
    const startFormatted = formatTime(args.start).replace(":", "m") + "s";
    const endFormatted = formatTime(args.end).replace(":", "m") + "s";
    const outputPath = path.join(outputDir, `${episodeName}_${startFormatted}-${endFormatted}.mp4`);
    extractClip(videoPath, args.start, args.end, outputPath, args.dryRun);
    return;
  }

  // Helper: Check if dialogue is a media command (works for old and new recordings)
  const isMediaCmd = (d: Dialogue) =>
    d.isMediaCommand ||
    d.actor === 'aishaw' ||
    d.line === 'roll-commercial' ||
    d.line === 'roll-media' ||
    d.line === 'clear-media';

  // Helper: Find first speech dialogue (skip media commands)
  const getFirstSpeechDialogue = (scene: Scene): Dialogue | undefined => {
    return scene.dialogue.find(d => !isMediaCmd(d) && d.line && d.startSec !== undefined);
  };

  // Helper: Find last speech dialogue (skip media commands)
  const getLastSpeechDialogue = (scene: Scene): Dialogue | undefined => {
    return [...scene.dialogue].reverse().find(d => !isMediaCmd(d) && d.line && d.endSec !== undefined);
  };

  // Helper: Get best start time for a scene (prefer visual timing)
  const getSceneStart = (scene: Scene): number => {
    // Prefer visualStartSec (when scene transition begins)
    if (scene.visualStartSec !== undefined) {
      return scene.visualStartSec;
    }
    // Fall back to first speech dialogue (skip media commands)
    const firstSpeech = getFirstSpeechDialogue(scene);
    if (firstSpeech) {
      return firstSpeech.startSec;
    }
    // Last resort: use scene.startSec
    return scene.startSec;
  };

  // Helper: Get best end time for a scene (prefer visual timing)
  const getSceneEnd = (scene: Scene): number => {
    // Prefer visualEndSec (when next scene starts)
    if (scene.visualEndSec !== undefined) {
      return scene.visualEndSec;
    }
    // Fall back to last speech dialogue (skip media commands)
    const lastSpeech = getLastSpeechDialogue(scene);
    if (lastSpeech) {
      return lastSpeech.endSec;
    }
    // Last resort: use scene.endSec
    return scene.endSec;
  };

  // Location-based extraction (--location)
  if (args.location) {
    const locationLower = args.location.toLowerCase();
    const matchingScenes = data.scenes.filter(s =>
      s.location.toLowerCase().includes(locationLower)
    );

    if (matchingScenes.length === 0) {
      const allLocations = [...new Set(data.scenes.map(s => s.location))];
      console.error(`No scenes found at location "${args.location}"`);
      console.error(`Available locations: ${allLocations.join(", ")}`);
      process.exit(1);
    }

    console.log(`\nFound ${matchingScenes.length} scene(s) at location "${args.location}":\n`);
    for (const scene of matchingScenes) {
      const start = getSceneStart(scene);
      const end = getSceneEnd(scene);
      const hasVisual = scene.visualStartSec !== undefined;
      console.log(`  Scene ${scene.number}: ${scene.location} (${formatTime(start)} - ${formatTime(end)})${hasVisual ? '' : ' [no visual timing]'}`);
    }

    // Extract each scene
    const sanitizedLoc = args.location.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 20);
    if (matchingScenes.length === 1) {
      const scene = matchingScenes[0];
      const outputPath = path.join(outputDir, `${episodeName}_loc_${sanitizedLoc}.mp4`);
      extractClip(videoPath, getSceneStart(scene), getSceneEnd(scene), outputPath, args.dryRun);
    } else {
      for (let i = 0; i < matchingScenes.length; i++) {
        const scene = matchingScenes[i];
        const outputPath = path.join(outputDir, `${episodeName}_loc_${sanitizedLoc}_${i + 1}.mp4`);
        extractClip(videoPath, getSceneStart(scene), getSceneEnd(scene), outputPath, args.dryRun);
      }
    }
    return;
  }

  // Actor-based extraction (--actor)
  if (args.actor) {
    const actorLower = args.actor.toLowerCase();
    const padding = args.padding || 1;

    // Find all dialogue from the actor
    const actorDialogues: { scene: Scene; dialogue: Dialogue }[] = [];
    for (const scene of data.scenes) {
      for (const dialogue of scene.dialogue) {
        if (dialogue.actor?.toLowerCase().includes(actorLower) && dialogue.line) {
          actorDialogues.push({ scene, dialogue });
        }
      }
    }

    if (actorDialogues.length === 0) {
      const allActors = [...new Set(data.scenes.flatMap(s => s.dialogue.map(d => d.actor).filter(Boolean)))];
      console.error(`No dialogue found for actor "${args.actor}"`);
      console.error(`Available actors: ${allActors.join(", ")}`);
      process.exit(1);
    }

    console.log(`\nFound ${actorDialogues.length} line(s) from "${args.actor}":\n`);
    for (let i = 0; i < actorDialogues.length; i++) {
      const { scene, dialogue } = actorDialogues[i];
      const preview = dialogue.line.length > 60 ? dialogue.line.substring(0, 57) + "..." : dialogue.line;
      console.log(`  ${i + 1}. Scene ${scene.number} [${formatTime(dialogue.startSec)}]: "${preview}"`);
    }

    // Extract each dialogue segment with padding
    const sanitizedActor = args.actor.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 20);
    for (let i = 0; i < actorDialogues.length; i++) {
      const { dialogue } = actorDialogues[i];
      const startWithPadding = Math.max(0, dialogue.startSec - padding);
      const endWithPadding = dialogue.endSec + padding;
      const outputPath = path.join(outputDir, `${episodeName}_actor_${sanitizedActor}_${i + 1}.mp4`);
      extractClip(videoPath, startWithPadding, endWithPadding, outputPath, args.dryRun);
    }
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
    console.error("Error: Specify --scene=N, --scenes=1,3,7, --from=N --to=M, --start/--end, --location=NAME, or --actor=NAME");
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

  // Extract each scene or combined range
  if (scenesToExtract.length === 1) {
    // Single scene
    const sceneNum = scenesToExtract[0];
    const scene = data.scenes.find((s) => s.number === sceneNum);
    if (!scene) {
      console.error(`Error: Scene ${sceneNum} not found`);
      process.exit(1);
    }

    const outputPath = path.join(outputDir, `${episodeName}_scene${sceneNum}.mp4`);
    extractClip(videoPath, getSceneStart(scene), getSceneEnd(scene), outputPath, args.dryRun);
  } else if (args.from !== undefined && args.to !== undefined) {
    // Continuous range - extract as single clip
    const fromScene = data.scenes.find((s) => s.number === args.from);
    const toScene = data.scenes.find((s) => s.number === args.to);

    if (!fromScene || !toScene) {
      console.error(`Error: Scene range ${args.from}-${args.to} invalid`);
      process.exit(1);
    }

    const outputPath = path.join(
      outputDir,
      `${episodeName}_scene${args.from}-${args.to}.mp4`
    );
    extractClip(videoPath, getSceneStart(fromScene), getSceneEnd(toScene), outputPath, args.dryRun);
  } else {
    // Multiple specific scenes - extract each separately
    for (const sceneNum of scenesToExtract) {
      const scene = data.scenes.find((s) => s.number === sceneNum);
      if (!scene) {
        console.error(`Warning: Scene ${sceneNum} not found, skipping`);
        continue;
      }

      const outputPath = path.join(outputDir, `${episodeName}_scene${sceneNum}.mp4`);
      extractClip(videoPath, getSceneStart(scene), getSceneEnd(scene), outputPath, args.dryRun);
    }
  }
}

async function handleSearch(args: CliArgs): Promise<void> {
  if (args.videos.length === 0) {
    console.error("Error: Video path required for search command");
    console.error('Usage: npm run clip -- search <video-path> --query="search term"');
    process.exit(1);
  }

  if (!args.query) {
    console.error("Error: --query required for search command");
    process.exit(1);
  }

  const videos = await resolveVideosAndData(args.videos);
  const outputDir = args.output || "episodes/clips";
  const padding = args.padding || 2;
  const sanitizedQuery = args.query.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);

  let totalMatches = 0;
  let clipIndex = 0;

  for (const { videoPath, dataPath, isSessionLog } of videos) {
    const data = loadTimedData(dataPath, isSessionLog);
    const episodeName = getEpisodeBaseName(videoPath);
    const matches = searchTranscript(data, args.query);

    if (matches.length === 0) continue;

    totalMatches += matches.length;

    if (videos.length > 1) {
      console.log(`\n${path.basename(videoPath)}:`);
    } else {
      console.log(`\nFound ${matches.length} match(es) for "${args.query}":\n`);
    }

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      console.log(
        `  ${clipIndex + 1}. Scene ${match.scene.number} [${formatTime(match.dialogue.startSec)}] ${match.dialogue.actor}:`
      );
      console.log(`     "${match.matchedText}"`);

      if (args.doExtract) {
        ensureOutputDir(outputDir);
        const startWithPadding = Math.max(0, match.dialogue.startSec - padding);
        const endWithPadding = match.dialogue.endSec + padding;
        const outputPath = path.join(
          outputDir,
          `${episodeName}_search_${sanitizedQuery}_${clipIndex + 1}.mp4`
        );
        extractClip(videoPath, startWithPadding, endWithPadding, outputPath, args.dryRun);
      }
      clipIndex++;
    }
  }

  if (totalMatches === 0) {
    console.log(`No matches found for query: "${args.query}"`);
    return;
  }

  if (videos.length > 1) {
    console.log(`\nTotal: ${totalMatches} match(es) across ${videos.length} videos`);
  }

  if (!args.doExtract) {
    console.log(`\nAdd --extract to cut these clips.`);
  }
}

function showHelp(): void {
  console.log(`
Episode Clip Extraction CLI

Commands:
  list      Show scenes overview with timestamps and excerpts
  extract   Cut clips by scene number(s), time range, location, or actor
  search    Find dialogue by transcript content
  help      Show this help message

Usage:
  npm run clip -- list <video-path>
  npm run clip -- extract <video-path> --scene=N
  npm run clip -- extract <video-path> --from=N --to=M
  npm run clip -- extract <video-path> --scenes=1,3,7
  npm run clip -- extract <video-path> --start=1:30 --end=2:45
  npm run clip -- extract <video-path> --location=stonks
  npm run clip -- extract <video-path> --actor=jin
  npm run clip -- search <video-path> --query="search term"
  npm run clip -- search <video-path> --query="term" --extract

Options:
  --scene=N         Extract single scene by number
  --from=N --to=M   Extract scene range as single clip
  --scenes=1,3,7    Extract multiple specific scenes (separate clips)
  --start=M:SS      Start time for direct time-based clipping
  --end=M:SS        End time for direct time-based clipping
  --location=NAME   Extract all scenes at a location (partial match)
  --actor=NAME      Extract all dialogue from an actor (partial match)
  --query="text"    Search transcript for matching dialogue
  --extract         Actually cut clips (for search command)
  --padding=N       Seconds of padding (default: 2 for search, 1 for actor)
  --output=DIR      Output directory (default: episodes/clips)
  --dry-run         Show what would be done without executing

Examples:
  npm run clip -- list episodes/*.mp4
  npm run clip -- extract episodes/*.mp4 --scene=1
  npm run clip -- extract episodes/*.mp4 --from=2 --to=5
  npm run clip -- extract episodes/*.mp4 --start=1:30 --end=2:00
  npm run clip -- extract episodes/*.mp4 --location=stonks
  npm run clip -- extract episodes/*.mp4 --actor=eliza --padding=2
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
