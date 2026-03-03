#!/usr/bin/env python3
"""
LLM Producer — Clip Analysis & Trailer Config Generator

Merged from analyze_clips.py and generate_trailer.py. Uses OpenRouter LLMs to:
  - clips: Identify clip-worthy moments and optionally extract them via ffmpeg
  - trailer: Generate fast-paced trailer configs for Remotion rendering

Usage:
    python3 scripts/llm_producer.py clips episodes/*_session-log.json [--extract] [--dry-run]
    python3 scripts/llm_producer.py trailer episodes/*_session-log.json [--output=episodes/trailers/] [--manual] [--dry-run]
"""

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass, field, asdict
from glob import glob
from pathlib import Path
from typing import Optional

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional

# ============================================================================
# Configuration
# ============================================================================

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "moonshotai/kimi-k2.5"

# Trailer constants
TRANSITIONS = ["hard-cut", "flash-white", "flash-black", "zoom-punch", "glitch", "side-scroll-left", "split"]

# ============================================================================
# System Prompts
# ============================================================================

CLIPS_SYSTEM_PROMPT = """You are a video editor analyzing an AI news show for clip-worthy moments.

The show features hosts Eliza (professional anchor) and Jin (energetic co-host), with segments from other characters like Sparty (market reporter), Peepo (cool frog), Marc (venture capitalist AI), and Danger Man (security tips).

Identify 5-10 clips that work standalone on social media:
- **hook**: Attention-grabbing opener (strong first 3 seconds)
- **punchline**: Comedic payoff, witty conclusion
- **segment**: Self-contained topic (30-90 seconds ideal)
- **quote**: Memorable one-liner
- **reaction**: Enthusiasm peak, surprise moment

For each clip, provide:
- type: hook|punchline|segment|quote|reaction
- scene: scene number (1-indexed)
- start_dialogue: dialogue index where clip starts (1-indexed, the "i" field)
- end_dialogue: dialogue index where clip ends (1-indexed, the "i" field)
- title: short title for the clip (lowercase, hyphenated, suitable for filename)
- rationale: why this works as a clip (1-2 sentences)

IMPORTANT:
- Use the dialogue "i" field (index) values for start_dialogue and end_dialogue
- Clips should be 5-90 seconds typically
- Prioritize moments with strong hooks, humor, or self-contained information
- Skip media commands (lines like "roll-commercial", "roll-media", "clear-media")

Output ONLY valid JSON array of suggestions, no other text."""

TRAILER_SYSTEM_PROMPT = """You are a video editor creating a fast-paced trailer for an AI news show called "Cron Job".

Your goal is to create a "Coming up on Cron Job..." style preview - think Mr Beast / Shark Tank - ADHD-friendly, punchy, tense moments that hook viewers.

The show features hosts Eliza (professional anchor) and Jin (energetic co-host), with segments from other characters like Sparty (market reporter), HK-47 (sarcastic assassin droid), Marc (venture capitalist AI), and Danger Man (security tips).

Identify 5-7 SHORT, PUNCHY moments (1-3 seconds each) that:
- **Hook**: Grab attention immediately - dramatic statements, questions, exclamations
- **Tease**: Make viewers want to watch - cliffhangers, surprising claims, bold predictions
- **Partial lines**: Use ONLY the juicy part, not full sentences. Cut mid-thought for tension.

For each clip, provide:
- scene: scene number (1-indexed)
- dialogue_num: dialogue index (the "i" field)
- start_word: word index where the partial line STARTS (0-indexed into words array)
- end_word: word index where the partial line ENDS (0-indexed, inclusive)
- transition: one of "hard-cut", "flash-white", "flash-black", "zoom-punch", "glitch", "side-scroll-left"
- rationale: why this moment hooks viewers (1 sentence)

TRANSITION GUIDE:
- hard-cut: instant switch, no effect. Use sparingly for shock cuts.
- flash-white: bright flash between clips. Good for hype/energy moments.
- flash-black: dark flash. Good for dramatic or ominous moments.
- zoom-punch: aggressive zoom + shake. Best for exclamations, reactions, bold claims.
- glitch: RGB split + flicker. Good for tech topics, AI, bugs, chaos.
- side-scroll-left: anime-style horizontal whip scroll. Great for topic changes, new speakers, "meanwhile" moments.
- split: screen splits showing both clips side-by-side, old desaturates, new expands. Good for contrasts, before/after, perspective shifts between speakers.

IMPORTANT GUIDELINES:
- Extract PARTIAL lines - just 4-12 words, the most dramatic part
- Prefer questions, exclamations, bold claims, or mid-sentence cuts
- Vary transitions - don't use the same one twice in a row
- Build tension - start punchy, escalate, end with a bang
- Skip boring transitions, introductions, and filler

Example good partials:
- "shall I initiate termination protocols?" (dramatic question)
- "This could change EVERYTHING!" (bold claim)
- "Wait, did you just say..." (interrupted curiosity)
- "And that's when the market--" (cliffhanger cut)

Output ONLY valid JSON array of suggestions, no other text."""


# ============================================================================
# Shared Utilities
# ============================================================================

def format_time(seconds: float) -> str:
    """Format seconds as M:SS."""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins}:{secs:02d}"


def estimate_tokens(text: str) -> int:
    """Rough estimate of token count (1 token ~ 4 chars for English)."""
    return len(text) // 4


def compress_for_llm(session_log: dict, mode: str = "clips") -> dict:
    """Convert session-log to token-efficient format.

    Reduces ~52K tokens to ~6K tokens by:
    - Using short keys (i, t, a, l instead of number, time, actor, line)
    - Using actor initials (E for eliza, J for jin, etc.)
    - Removing word-level timing data
    - Skipping media commands

    Args:
        session_log: Raw session-log data
        mode: "clips" or "trailer" — trailer mode includes word counts per line
    """
    episode = session_log.get("episode", {})
    show = session_log.get("show", {})

    # Build actor alias map: "eliza" -> "E", "jin" -> "J", etc.
    actors = {}
    for actor_id in show.get("actors", {}):
        if actor_id == "aishaw":
            actors[actor_id] = "S"  # Shaw
        elif actor_id == "danger_man":
            actors[actor_id] = "D"
        elif actor_id == "hk47":
            actors[actor_id] = "HK"
        else:
            actors[actor_id] = actor_id[0].upper()

    scenes = []
    for scene in episode.get("scenes", []):
        dialogue = []
        for d in scene.get("dialogue", []):
            # Skip media commands
            if d.get("isMediaCommand"):
                continue
            line = d.get("line", "")
            if line in ("roll-commercial", "roll-media", "clear-media"):
                continue
            if d.get("actor") == "aishaw":
                continue
            if not line:
                continue

            entry = {
                "i": d.get("number", 0),
                "t": format_time(d.get("startSec", 0)),
                "a": actors.get(d.get("actor", ""), d.get("actor", "?")),
                "l": line
            }

            # Trailer mode includes word count for partial selection
            if mode == "trailer":
                words = d.get("words", [])
                entry["w"] = len(words)

            dialogue.append(entry)

        # Only include scenes with dialogue
        if dialogue:
            scene_entry = {
                "n": scene.get("number", 0),
                "loc": scene.get("location", ""),
                "dialogue": dialogue
            }
            # Clips mode includes time range
            if mode == "clips":
                scene_entry["time"] = f"{format_time(scene.get('startSec', 0))}-{format_time(scene.get('endSec', 0))}"

            scenes.append(scene_entry)

    return {
        "title": episode.get("name", ""),
        "premise": episode.get("premise", ""),
        "actors": actors,
        "scenes": scenes
    }


def analyze_with_llm(
    context: dict,
    system_prompt: str,
    model: str = DEFAULT_MODEL,
    verbose: bool = False,
    x_title: str = "Cron Job LLM Producer"
) -> list[dict]:
    """Call OpenRouter API with reasoning enabled."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY environment variable required")

    context_json = json.dumps(context, indent=2)

    if verbose:
        print(f"Sending ~{estimate_tokens(context_json)} tokens to {model}...")

    response = requests.post(
        OPENROUTER_API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://elizaos.news",
            "X-Title": x_title
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": context_json}
            ],
            "reasoning": {"enabled": True}
        },
        timeout=120
    )

    if response.status_code != 200:
        raise RuntimeError(f"OpenRouter API error {response.status_code}: {response.text}")

    result = response.json()

    if verbose and "usage" in result:
        usage = result["usage"]
        print(f"Tokens used: {usage.get('prompt_tokens', '?')} prompt, {usage.get('completion_tokens', '?')} completion")

    content = result["choices"][0]["message"]["content"]

    # Parse JSON from response (handle potential markdown code blocks)
    content = content.strip()
    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    try:
        suggestions = json.loads(content)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to parse LLM response as JSON: {e}\nResponse: {content[:500]}")

    if not isinstance(suggestions, list):
        raise RuntimeError(f"Expected JSON array, got: {type(suggestions)}")

    return suggestions


def find_video_file(session_log_path: Path) -> Path | None:
    """Find the video file corresponding to a session-log."""
    base = session_log_path.stem.replace("_session-log", "")
    directory = session_log_path.parent

    patterns = [
        f"{base}.mp4",
        f"{base}_fps30.mp4",
        f"{base}_fps60.mp4",
    ]

    for pattern in patterns:
        video_path = directory / pattern
        if video_path.exists():
            return video_path

    # Try glob pattern
    matches = list(directory.glob(f"{base}*.mp4"))
    if matches:
        return matches[0]

    return None


def expand_session_logs(file_args: list[str]) -> list[Path]:
    """Expand file patterns and filter to session-log files."""
    files = []
    for pattern in file_args:
        if "*" in pattern or "?" in pattern:
            matches = glob(pattern)
            files.extend(matches)
        else:
            files.append(pattern)

    return [
        Path(f) for f in files
        if f.endswith("_session-log.json") and Path(f).exists()
    ]


def check_api_key():
    """Check for OpenRouter API key, exit with helpful message if missing."""
    if not os.getenv("OPENROUTER_API_KEY"):
        print("\nError: OPENROUTER_API_KEY environment variable required")
        print("Get your API key from https://openrouter.ai/keys")
        print("Add to .env file: OPENROUTER_API_KEY=sk-or-...")
        sys.exit(1)


# ============================================================================
# Clips Subcommand
# ============================================================================

@dataclass
class ClipSuggestion:
    """A suggested clip from the LLM analysis."""
    type: str           # hook|punchline|segment|quote|reaction
    scene: int          # Scene number (1-indexed)
    start_dialogue: int # Dialogue index (1-indexed)
    end_dialogue: int   # Dialogue index (1-indexed)
    title: str          # Clip title
    rationale: str      # Why this is clip-worthy

    # Computed fields (filled in after LLM response)
    start_sec: float = 0.0
    end_sec: float = 0.0
    duration_sec: float = 0.0
    transcript: str = ""


def resolve_timing(suggestion: dict, session_log: dict) -> ClipSuggestion:
    """Fill in start_sec, end_sec, transcript from session-log."""
    episode = session_log.get("episode", {})
    scenes = episode.get("scenes", [])

    scene_num = suggestion.get("scene", 1)
    start_dialogue_num = suggestion.get("start_dialogue", 1)
    end_dialogue_num = suggestion.get("end_dialogue", 1)

    if scene_num < 1 or scene_num > len(scenes):
        raise ValueError(f"Invalid scene number: {scene_num}")

    scene = scenes[scene_num - 1]
    dialogue_list = scene.get("dialogue", [])
    dialogue_by_num = {d["number"]: d for d in dialogue_list}

    start_d = dialogue_by_num.get(start_dialogue_num)
    end_d = dialogue_by_num.get(end_dialogue_num)

    if not start_d:
        available = sorted(dialogue_by_num.keys())
        if available:
            start_d = dialogue_by_num[available[0]]
            print(f"  Warning: dialogue {start_dialogue_num} not found, using {available[0]}")

    if not end_d:
        available = sorted(dialogue_by_num.keys())
        if available:
            end_d = dialogue_by_num[available[-1]]
            print(f"  Warning: dialogue {end_dialogue_num} not found, using {available[-1]}")

    if not start_d or not end_d:
        raise ValueError(f"Could not resolve dialogues for scene {scene_num}")

    start_sec = start_d.get("startSec", 0)
    end_sec = end_d.get("endSec", start_d.get("startSec", 0) + 5)

    # Build transcript
    lines = []
    in_range = False
    for d in dialogue_list:
        if d["number"] == start_dialogue_num:
            in_range = True
        if in_range:
            actor = d.get("actor", "")
            line = d.get("line", "")
            if line and actor != "aishaw" and line not in ("roll-commercial", "roll-media", "clear-media"):
                lines.append(f"{actor}: {line}")
        if d["number"] == end_dialogue_num:
            break

    return ClipSuggestion(
        type=suggestion.get("type", "segment"),
        scene=scene_num,
        start_dialogue=start_dialogue_num,
        end_dialogue=end_dialogue_num,
        title=suggestion.get("title", "untitled"),
        rationale=suggestion.get("rationale", ""),
        start_sec=start_sec,
        end_sec=end_sec,
        duration_sec=round(end_sec - start_sec, 2),
        transcript="\n".join(lines)
    )


def extract_clip(suggestion: ClipSuggestion, video_path: Path, output_dir: Path, dry_run: bool = False) -> bool:
    """Extract a clip using ffmpeg."""
    output_dir.mkdir(parents=True, exist_ok=True)

    episode_base = video_path.stem.replace("_fps30", "").replace("_fps60", "")
    safe_title = suggestion.title.replace(" ", "-").lower()
    safe_title = "".join(c for c in safe_title if c.isalnum() or c == "-")[:40]
    output_path = output_dir / f"{episode_base}_{suggestion.type}_{safe_title}.mp4"

    print(f"\n  Extracting: {format_time(suggestion.start_sec)} - {format_time(suggestion.end_sec)} ({suggestion.duration_sec:.1f}s)")
    print(f"  Output: {output_path.name}")

    if dry_run:
        print("  [DRY RUN] Would extract clip")
        return True

    duration = suggestion.end_sec - suggestion.start_sec
    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-ss", str(suggestion.start_sec),
        "-t", str(duration),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "192k",
        str(output_path)
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True)
        print("  Extracted successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  Extraction failed: {e.stderr.decode()[:200] if e.stderr else str(e)}")
        return False
    except FileNotFoundError:
        print("  ffmpeg not found. Please install ffmpeg.")
        return False


def process_clips(
    session_log_path: Path,
    dry_run: bool = False,
    extract: bool = False,
    verbose: bool = False,
    model: str = DEFAULT_MODEL
) -> list[ClipSuggestion]:
    """Process a single session-log file for clip suggestions."""
    print(f"\nAnalyzing: {session_log_path.name}")

    with open(session_log_path) as f:
        session_log = json.load(f)

    episode_name = session_log.get("episode", {}).get("name", "Unknown")
    print(f"Episode: {episode_name}")

    compressed = compress_for_llm(session_log, mode="clips")
    compressed_json = json.dumps(compressed)

    if verbose:
        print(f"Original size estimate: ~{estimate_tokens(json.dumps(session_log))} tokens")
        print(f"Compressed size: ~{estimate_tokens(compressed_json)} tokens")
        print(f"Scenes: {len(compressed['scenes'])}")

    if dry_run:
        print("\n[DRY RUN] Would send to LLM for analysis")
        print(f"Actors: {compressed['actors']}")
        for scene in compressed["scenes"][:2]:
            print(f"\nScene {scene['n']} ({scene['loc']}) {scene['time']}:")
            for d in scene["dialogue"][:3]:
                print(f"  [{d['t']}] {d['a']}: {d['l'][:60]}...")
        if len(compressed["scenes"]) > 2:
            print(f"\n... and {len(compressed['scenes']) - 2} more scenes")
        return []

    print("\nCalling LLM for analysis...")
    raw_suggestions = analyze_with_llm(
        compressed,
        system_prompt=CLIPS_SYSTEM_PROMPT,
        model=model,
        verbose=verbose,
        x_title="Cron Job Clip Analyzer"
    )

    print(f"\nReceived {len(raw_suggestions)} clip suggestions")

    suggestions = []
    for i, raw in enumerate(raw_suggestions, 1):
        try:
            clip = resolve_timing(raw, session_log)
            suggestions.append(clip)
            print(f"\n{i}. [{clip.type}] {clip.title}")
            print(f"   Scene {clip.scene}, dialogue {clip.start_dialogue}-{clip.end_dialogue}")
            print(f"   Time: {format_time(clip.start_sec)} - {format_time(clip.end_sec)} ({clip.duration_sec:.1f}s)")
            print(f"   Rationale: {clip.rationale[:80]}...")
        except Exception as e:
            print(f"\n{i}. [ERROR] Could not resolve suggestion: {e}")
            if verbose:
                print(f"   Raw: {raw}")

    # Save suggestions
    output_path = session_log_path.with_name(
        session_log_path.stem.replace("_session-log", "_suggestions") + ".json"
    )
    with open(output_path, "w") as f:
        json.dump([asdict(s) for s in suggestions], f, indent=2)
    print(f"\nSaved suggestions to: {output_path.name}")

    # Extract clips if requested
    if extract and suggestions:
        video_path = find_video_file(session_log_path)
        if video_path:
            print(f"\nVideo found: {video_path.name}")
            output_dir = session_log_path.parent / "clips"

            extracted = 0
            for clip in suggestions:
                if extract_clip(clip, video_path, output_dir, dry_run=False):
                    extracted += 1

            print(f"\nExtracted {extracted}/{len(suggestions)} clips to {output_dir}")
        else:
            print("\nWarning: No video file found for extraction")

    return suggestions


def cmd_clips(args):
    """Handle the 'clips' subcommand."""
    session_logs = expand_session_logs(args.files)

    if not session_logs:
        print("No session-log files found. Usage:")
        print("  python3 scripts/llm_producer.py clips episodes/*_session-log.json")
        sys.exit(1)

    print(f"Found {len(session_logs)} session log(s) to analyze")

    if not args.dry_run:
        check_api_key()

    all_suggestions = []
    for session_log_path in session_logs:
        try:
            suggestions = process_clips(
                session_log_path,
                dry_run=args.dry_run,
                extract=args.extract,
                verbose=args.verbose,
                model=args.model
            )
            all_suggestions.extend(suggestions)
        except Exception as e:
            print(f"\nError processing {session_log_path.name}: {e}")
            if args.verbose:
                import traceback
                traceback.print_exc()

    if all_suggestions:
        print(f"\n{'='*60}")
        print(f"Total: {len(all_suggestions)} clip suggestions across {len(session_logs)} episode(s)")

        by_type = {}
        for s in all_suggestions:
            by_type.setdefault(s.type, []).append(s)

        for clip_type, clips in sorted(by_type.items()):
            print(f"  {clip_type}: {len(clips)}")


# ============================================================================
# Trailer Subcommand
# ============================================================================

@dataclass
class TrailerClip:
    """A clip segment for the trailer."""
    source: str                    # Path to session-log
    scene: int                     # Scene number
    dialogue_num: int              # Dialogue number
    start_word: int                # Word index start (0-indexed)
    end_word: int                  # Word index end (inclusive)
    transition: str                # Transition type
    rationale: str                 # Why this works

    # Computed fields (filled after LLM response)
    text: str = ""                 # Extracted partial text
    start_sec: float = 0.0         # Start time in video
    end_sec: float = 0.0           # End time in video
    duration: float = 0.0          # Clip duration
    actor: str = ""                # Speaker
    video_file: str = ""           # Path to source video file
    words: list = field(default_factory=list)  # Per-word timing [{word, start, end}]


@dataclass
class TrailerConfig:
    """Complete trailer configuration for Remotion."""
    type: str = "trailer"
    duration: float = 0.0
    title: str = "Coming up on Cron Job..."
    music: str = "dramatic-hit.mp3"
    soundtrack: str = "soundtrack.mp3"
    introBoot: str = "introBoot.mp3"
    outro: str = "outro.mp3"
    clips: list = field(default_factory=list)
    end_card: dict = field(default_factory=lambda: {
        "text": "Cron Job",
        "subtext": "New episodes weekly",
        "duration": 2
    })
    modulation: dict = field(default_factory=lambda: {
        "glbFile": "Modulation_GLBs/cron_red.glb"
    })
    source_episode: str = ""
    generated_at: str = ""


def extract_partial_line(dialogue: dict, start_word: int, end_word: int) -> dict:
    """Extract timing for partial line using word-level timestamps."""
    words = dialogue.get("words", [])

    start_word = max(0, min(start_word, len(words) - 1))
    end_word = max(start_word, min(end_word, len(words) - 1))

    if not words:
        return {
            "text": dialogue.get("line", ""),
            "startSec": dialogue.get("startSec", 0),
            "endSec": dialogue.get("endSec", 0),
            "duration": dialogue.get("endSec", 0) - dialogue.get("startSec", 0)
        }

    partial_words = words[start_word:end_word + 1]
    text = " ".join(w["word"] for w in partial_words)

    start_sec = partial_words[0]["start"]
    end_sec = partial_words[-1]["end"]

    return {
        "text": text,
        "startSec": start_sec,
        "endSec": end_sec,
        "duration": end_sec - start_sec,
        "words": [{"word": w["word"], "start": w["start"], "end": w["end"]} for w in partial_words]
    }


def find_dialogue(session_log: dict, scene_num: int, dialogue_num: int) -> Optional[dict]:
    """Find a dialogue entry by scene and dialogue number."""
    episode = session_log.get("episode", {})
    scenes = episode.get("scenes", [])

    if scene_num < 1 or scene_num > len(scenes):
        return None

    scene = scenes[scene_num - 1]

    for d in scene.get("dialogue", []):
        if d.get("number") == dialogue_num:
            return d

    return None


def find_trailer_video_file(session_log: dict, session_log_path: Path) -> str:
    """Find video file, preferring no-music version for cleaner trailers."""
    base = session_log_path.stem.replace("_session-log", "")

    # Prefer no-music version (cleaner for trailer cutting)
    no_music_dir = session_log_path.parent.parent / "no-music"
    if no_music_dir.exists():
        for pattern in [f"{base}.mp4", f"{base}_fps30.mp4"]:
            candidate = no_music_dir / pattern
            if candidate.exists():
                return str(candidate)

    # Fall back to session-log's video_file field, then same-dir search
    video_file = session_log.get("video_file", "")
    if video_file:
        video_path = session_log_path.parent / video_file
        if video_path.exists():
            return str(video_path)

    result = find_video_file(session_log_path)
    return str(result) if result else ""


def resolve_clips(raw_clips: list[dict], session_log: dict, session_log_path: Path) -> list[TrailerClip]:
    """Resolve raw clip suggestions to full TrailerClip objects with timing."""
    resolved = []

    video_file = find_trailer_video_file(session_log, session_log_path)
    if video_file:
        print(f"Video file: {Path(video_file).name}")
    else:
        print("Warning: No video file found - trailer will be text-only")

    for raw in raw_clips:
        scene_num = raw.get("scene", 1)
        dialogue_num = raw.get("dialogue_num", 1)
        start_word = raw.get("start_word", 0)
        end_word = raw.get("end_word", -1)

        dialogue = find_dialogue(session_log, scene_num, dialogue_num)
        if not dialogue:
            print(f"  Warning: Could not find scene {scene_num} dialogue {dialogue_num}")
            continue

        words = dialogue.get("words", [])
        if end_word < 0 or end_word >= len(words):
            end_word = len(words) - 1

        partial = extract_partial_line(dialogue, start_word, end_word)

        clip = TrailerClip(
            source=str(session_log_path),
            scene=scene_num,
            dialogue_num=dialogue_num,
            start_word=start_word,
            end_word=end_word,
            transition=raw.get("transition", "hard-cut"),
            rationale=raw.get("rationale", ""),
            text=partial["text"],
            start_sec=partial["startSec"],
            end_sec=partial["endSec"],
            duration=partial["duration"],
            actor=dialogue.get("actor", ""),
            video_file=video_file,
            words=partial.get("words", [])
        )
        resolved.append(clip)

    return resolved


def interactive_clip_selection(session_log: dict, session_log_path: Path) -> list[dict]:
    """Interactive mode for manually selecting trailer clips."""
    episode = session_log.get("episode", {})
    scenes = episode.get("scenes", [])

    print("\n" + "=" * 60)
    print("MANUAL TRAILER CLIP SELECTION")
    print("=" * 60)
    print(f"\nEpisode: {episode.get('name', 'Unknown')}")
    print(f"Scenes: {len(scenes)}")

    print("\nScenes Overview:")
    for scene in scenes:
        dialogue_count = len([d for d in scene.get("dialogue", [])
                            if not d.get("isMediaCommand") and d.get("line")])
        print(f"  Scene {scene['number']}: {scene.get('location', 'unknown')} ({dialogue_count} lines)")

    clips = []
    print("\n" + "-" * 60)
    print("Enter clips one at a time. Type 'done' when finished.")
    print("Format: scene_num dialogue_num start_word end_word transition")
    print("Example: 3 5 2 8 flash-white")
    print(f"Transitions: {', '.join(TRANSITIONS)}")
    print("-" * 60)

    while True:
        try:
            user_input = input("\nClip> ").strip()

            if user_input.lower() == 'done':
                break

            if user_input.lower() == 'list':
                scene_num = int(input("Scene number> "))
                if scene_num < 1 or scene_num > len(scenes):
                    print(f"Invalid scene number. Range: 1-{len(scenes)}")
                    continue

                scene = scenes[scene_num - 1]
                print(f"\nScene {scene_num} dialogue:")
                for d in scene.get("dialogue", []):
                    if d.get("isMediaCommand") or not d.get("line"):
                        continue
                    words = d.get("words", [])
                    print(f"  #{d['number']} [{format_time(d.get('startSec', 0))}] {d.get('actor', '?')}: "
                          f"{d['line'][:60]}... ({len(words)} words)")
                continue

            if user_input.lower() == 'words':
                scene_num = int(input("Scene number> "))
                dialogue_num = int(input("Dialogue number> "))

                d = find_dialogue(session_log, scene_num, dialogue_num)
                if not d:
                    print("Dialogue not found")
                    continue

                words = d.get("words", [])
                print(f"\nWords in dialogue {dialogue_num}:")
                for i, w in enumerate(words):
                    print(f"  [{i}] {w['word']}")
                continue

            parts = user_input.split()
            if len(parts) < 5:
                print("Format: scene_num dialogue_num start_word end_word transition")
                continue

            scene_num = int(parts[0])
            dialogue_num = int(parts[1])
            start_word = int(parts[2])
            end_word = int(parts[3])
            transition = parts[4]

            if transition not in TRANSITIONS:
                print(f"Invalid transition. Options: {', '.join(TRANSITIONS)}")
                continue

            d = find_dialogue(session_log, scene_num, dialogue_num)
            if not d:
                print("Dialogue not found")
                continue

            partial = extract_partial_line(d, start_word, end_word)
            print(f"\nPreview: \"{partial['text']}\" ({partial['duration']:.1f}s)")

            confirm = input("Add this clip? (y/n)> ").strip().lower()
            if confirm == 'y':
                clips.append({
                    "scene": scene_num,
                    "dialogue_num": dialogue_num,
                    "start_word": start_word,
                    "end_word": end_word,
                    "transition": transition,
                    "rationale": "manually selected"
                })
                print(f"Added clip #{len(clips)}")

        except ValueError as e:
            print(f"Invalid input: {e}")
        except KeyboardInterrupt:
            print("\nAborted")
            break

    return clips


def generate_trailer_config(
    session_log_path: Path,
    dry_run: bool = False,
    manual: bool = False,
    verbose: bool = False,
    model: str = DEFAULT_MODEL
) -> TrailerConfig | None:
    """Generate trailer configuration from a session-log file."""
    print(f"\nProcessing: {session_log_path.name}")

    with open(session_log_path) as f:
        session_log = json.load(f)

    episode = session_log.get("episode", {})
    episode_name = episode.get("name", "Unknown")
    print(f"Episode: {episode_name}")

    if manual:
        raw_clips = interactive_clip_selection(session_log, session_log_path)
    elif dry_run:
        compressed = compress_for_llm(session_log, mode="trailer")
        print(f"\n[DRY RUN] Would send ~{estimate_tokens(json.dumps(compressed))} tokens to LLM")
        print(f"Scenes: {len(compressed['scenes'])}")
        print(f"Actors: {compressed['actors']}")

        for scene in compressed["scenes"][:2]:
            print(f"\nScene {scene['n']} ({scene['loc']}):")
            for d in scene["dialogue"][:3]:
                print(f"  [{d['t']}] {d['a']}: {d['l'][:50]}... ({d['w']} words)")

        return None
    else:
        compressed = compress_for_llm(session_log, mode="trailer")

        if verbose:
            print(f"Compressed to ~{estimate_tokens(json.dumps(compressed))} tokens")

        print("\nCalling LLM for trailer clip suggestions...")
        raw_clips = analyze_with_llm(
            compressed,
            system_prompt=TRAILER_SYSTEM_PROMPT,
            model=model,
            verbose=verbose,
            x_title="Cron Job Trailer Generator"
        )
        print(f"Received {len(raw_clips)} clip suggestions")

    clips = resolve_clips(raw_clips, session_log, session_log_path)

    if not clips:
        print("Warning: No valid clips resolved")
        return None

    title_duration = 2.0
    end_card_duration = 2.0
    clips_duration = sum(c.duration for c in clips)
    total_duration = title_duration + clips_duration + end_card_duration

    print(f"\nTrailer clips ({len(clips)} total, {total_duration:.1f}s):")
    for i, clip in enumerate(clips, 1):
        print(f"  {i}. [{clip.actor}] \"{clip.text[:50]}...\"")
        print(f"     Scene {clip.scene}, {clip.duration:.1f}s, {clip.transition}")

    from datetime import datetime
    config = TrailerConfig(
        duration=total_duration,
        clips=[asdict(c) for c in clips],
        source_episode=episode_name,
        generated_at=datetime.now().isoformat()
    )

    return config


def cmd_trailer(args):
    """Handle the 'trailer' subcommand."""
    session_logs = expand_session_logs(args.files)

    if not session_logs:
        print("No session-log files found. Usage:")
        print("  python3 scripts/llm_producer.py trailer episodes/*_session-log.json")
        sys.exit(1)

    print(f"Found {len(session_logs)} session log(s)")

    if not args.dry_run and not args.manual:
        check_api_key()

    output_dir = Path(args.output)
    if not args.dry_run:
        output_dir.mkdir(parents=True, exist_ok=True)

    for session_log_path in session_logs:
        try:
            config = generate_trailer_config(
                session_log_path,
                dry_run=args.dry_run,
                manual=args.manual,
                verbose=args.verbose,
                model=args.model
            )

            if config:
                base = session_log_path.stem.replace("_session-log", "")
                output_path = output_dir / f"{base}_trailer-config.json"

                with open(output_path, "w") as f:
                    json.dump(asdict(config), f, indent=2)

                print(f"\nSaved trailer config: {output_path}")

        except Exception as e:
            print(f"\nError processing {session_log_path.name}: {e}")
            if args.verbose:
                import traceback
                traceback.print_exc()

    print("\n" + "=" * 60)
    print("Next steps:")
    print("  1. Review/edit the trailer_config.json file")
    print("  2. Run: cd remotion && npm run build")
    print("  3. Run: npx remotion render Trailer --props=../episodes/trailers/<config>.json")
    print("=" * 60)


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="LLM-powered clip analysis and trailer generation for Cron Job episodes"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # --- clips subcommand ---
    clips_parser = subparsers.add_parser(
        "clips",
        help="Analyze session logs for clip-worthy moments"
    )
    clips_parser.add_argument(
        "files", nargs="+",
        help="Session log file(s) to analyze (supports glob patterns)"
    )
    clips_parser.add_argument("--dry-run", action="store_true",
        help="Show what would be analyzed without calling LLM")
    clips_parser.add_argument("--extract", action="store_true",
        help="Extract clips after analysis (requires ffmpeg)")
    clips_parser.add_argument("--verbose", "-v", action="store_true",
        help="Show detailed output")
    clips_parser.add_argument("--model", default=DEFAULT_MODEL,
        help=f"OpenRouter model to use (default: {DEFAULT_MODEL})")

    # --- trailer subcommand ---
    trailer_parser = subparsers.add_parser(
        "trailer",
        help="Generate trailer configs for Remotion rendering"
    )
    trailer_parser.add_argument(
        "files", nargs="+",
        help="Session log file(s) to analyze (supports glob patterns)"
    )
    trailer_parser.add_argument("--dry-run", action="store_true",
        help="Show what would be analyzed without calling LLM")
    trailer_parser.add_argument("--manual", action="store_true",
        help="Interactive mode for manual clip selection")
    trailer_parser.add_argument("--verbose", "-v", action="store_true",
        help="Show detailed output")
    trailer_parser.add_argument("--model", default=DEFAULT_MODEL,
        help=f"OpenRouter model to use (default: {DEFAULT_MODEL})")
    trailer_parser.add_argument("--output", "-o", default="episodes/trailers",
        help="Output directory for trailer configs (default: episodes/trailers)")

    args = parser.parse_args()

    if args.command == "clips":
        cmd_clips(args)
    elif args.command == "trailer":
        cmd_trailer(args)


if __name__ == "__main__":
    main()
