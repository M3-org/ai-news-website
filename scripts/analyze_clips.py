#!/usr/bin/env python3
"""
LLM-Based Clip Analyzer

Analyzes episode session logs and suggests clip-worthy moments using OpenRouter + Kimi K2.5.

Usage:
    uv run python scripts/analyze_clips.py episodes/2026-02-02_*_session-log.json
    uv run python scripts/analyze_clips.py episodes/*_session-log.json --extract
    uv run python scripts/analyze_clips.py episodes/*_session-log.json --dry-run
"""

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass, field, asdict
from glob import glob
from pathlib import Path
from typing import Any

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

SYSTEM_PROMPT = """You are a video editor analyzing an AI news show for clip-worthy moments.

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

# ============================================================================
# Data Classes
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


# ============================================================================
# Token Compression
# ============================================================================

def format_time(seconds: float) -> str:
    """Format seconds as M:SS."""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins}:{secs:02d}"


def compress_for_llm(session_log: dict) -> dict:
    """Convert session-log to token-efficient format.

    Reduces ~52K tokens to ~6K tokens by:
    - Using short keys (i, t, a, l instead of number, time, actor, line)
    - Using actor initials (E for eliza, J for jin, etc.)
    - Removing word-level timing data
    - Skipping media commands
    """
    episode = session_log.get("episode", {})
    show = session_log.get("show", {})

    # Build actor alias map: "eliza" -> "E", "jin" -> "J", etc.
    actors = {}
    for actor_id in show.get("actors", {}):
        # Use first letter uppercase, handle special cases
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

            # Only include if there's actual content
            if not line:
                continue

            dialogue.append({
                "i": d.get("number", 0),
                "t": format_time(d.get("startSec", 0)),
                "a": actors.get(d.get("actor", ""), d.get("actor", "?")),
                "l": line
            })

        # Only include scenes with dialogue
        if dialogue:
            scenes.append({
                "n": scene.get("number", 0),
                "loc": scene.get("location", ""),
                "time": f"{format_time(scene.get('startSec', 0))}-{format_time(scene.get('endSec', 0))}",
                "dialogue": dialogue
            })

    return {
        "title": episode.get("name", ""),
        "premise": episode.get("premise", ""),
        "actors": actors,
        "scenes": scenes
    }


def estimate_tokens(text: str) -> int:
    """Rough estimate of token count (1 token ≈ 4 chars for English)."""
    return len(text) // 4


# ============================================================================
# LLM Integration
# ============================================================================

def analyze_with_llm(context: dict, model: str = DEFAULT_MODEL, verbose: bool = False) -> list[dict]:
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
            "X-Title": "Cron Job Clip Analyzer"
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
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


# ============================================================================
# Timing Resolution
# ============================================================================

def resolve_timing(suggestion: dict, session_log: dict) -> ClipSuggestion:
    """Fill in start_sec, end_sec, transcript from session-log."""
    episode = session_log.get("episode", {})
    scenes = episode.get("scenes", [])

    scene_num = suggestion.get("scene", 1)
    start_dialogue_num = suggestion.get("start_dialogue", 1)
    end_dialogue_num = suggestion.get("end_dialogue", 1)

    # Find the scene (1-indexed)
    if scene_num < 1 or scene_num > len(scenes):
        raise ValueError(f"Invalid scene number: {scene_num}")

    scene = scenes[scene_num - 1]
    dialogue_list = scene.get("dialogue", [])

    # Build dialogue lookup by number
    dialogue_by_num = {d["number"]: d for d in dialogue_list}

    # Find start and end dialogues
    start_d = dialogue_by_num.get(start_dialogue_num)
    end_d = dialogue_by_num.get(end_dialogue_num)

    if not start_d:
        # Fallback: try to find closest dialogue
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


# ============================================================================
# Clip Extraction
# ============================================================================

def find_video_file(session_log_path: Path) -> Path | None:
    """Find the video file corresponding to a session-log."""
    # Session log: episodes/2026-02-02_Cron-Job_Workflow-Revolution_session-log.json
    # Video file: episodes/2026-02-02_Cron-Job_Workflow-Revolution.mp4 or _fps30.mp4

    base = session_log_path.stem.replace("_session-log", "")
    directory = session_log_path.parent

    # Try various video patterns
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


def extract_clip(suggestion: ClipSuggestion, video_path: Path, output_dir: Path, dry_run: bool = False) -> bool:
    """Extract a clip using the existing clip.ts script or ffmpeg directly."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate output filename
    episode_base = video_path.stem.replace("_fps30", "").replace("_fps60", "")
    safe_title = suggestion.title.replace(" ", "-").lower()
    safe_title = "".join(c for c in safe_title if c.isalnum() or c == "-")[:40]
    output_path = output_dir / f"{episode_base}_{suggestion.type}_{safe_title}.mp4"

    print(f"\n  Extracting: {format_time(suggestion.start_sec)} - {format_time(suggestion.end_sec)} ({suggestion.duration_sec:.1f}s)")
    print(f"  Output: {output_path.name}")

    if dry_run:
        print("  [DRY RUN] Would extract clip")
        return True

    # Use ffmpeg directly for extraction
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
        print("  ✓ Extracted successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ✗ Extraction failed: {e.stderr.decode()[:200] if e.stderr else str(e)}")
        return False
    except FileNotFoundError:
        print("  ✗ ffmpeg not found. Please install ffmpeg.")
        return False


# ============================================================================
# Main
# ============================================================================

def process_session_log(
    session_log_path: Path,
    dry_run: bool = False,
    extract: bool = False,
    verbose: bool = False,
    model: str = DEFAULT_MODEL
) -> list[ClipSuggestion]:
    """Process a single session-log file."""
    print(f"\nAnalyzing: {session_log_path.name}")

    # Load session log
    with open(session_log_path) as f:
        session_log = json.load(f)

    episode_name = session_log.get("episode", {}).get("name", "Unknown")
    print(f"Episode: {episode_name}")

    # Compress for LLM
    compressed = compress_for_llm(session_log)
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

    # Call LLM
    print("\nCalling LLM for analysis...")
    raw_suggestions = analyze_with_llm(compressed, model=model, verbose=verbose)

    print(f"\nReceived {len(raw_suggestions)} clip suggestions")

    # Resolve timing for each suggestion
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


def main():
    parser = argparse.ArgumentParser(
        description="Analyze episode session logs for clip-worthy moments using LLM"
    )
    parser.add_argument(
        "files",
        nargs="+",
        help="Session log file(s) to analyze (supports glob patterns)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be analyzed without calling LLM"
    )
    parser.add_argument(
        "--extract",
        action="store_true",
        help="Extract clips after analysis (requires ffmpeg)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed output"
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"OpenRouter model to use (default: {DEFAULT_MODEL})"
    )

    args = parser.parse_args()

    # Expand file patterns
    files = []
    for pattern in args.files:
        if "*" in pattern or "?" in pattern:
            matches = glob(pattern)
            files.extend(matches)
        else:
            files.append(pattern)

    # Filter to session-log files
    session_logs = [
        Path(f) for f in files
        if f.endswith("_session-log.json") and Path(f).exists()
    ]

    if not session_logs:
        print("No session-log files found. Usage:")
        print("  uv run python scripts/analyze_clips.py episodes/*_session-log.json")
        sys.exit(1)

    print(f"Found {len(session_logs)} session log(s) to analyze")

    # Check for API key (unless dry run)
    if not args.dry_run and not os.getenv("OPENROUTER_API_KEY"):
        print("\nError: OPENROUTER_API_KEY environment variable required")
        print("Get your API key from https://openrouter.ai/keys")
        print("Add to .env file: OPENROUTER_API_KEY=sk-or-...")
        sys.exit(1)

    # Process each file
    all_suggestions = []
    for session_log_path in session_logs:
        try:
            suggestions = process_session_log(
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

    # Summary
    if all_suggestions:
        print(f"\n{'='*60}")
        print(f"Total: {len(all_suggestions)} clip suggestions across {len(session_logs)} episode(s)")

        # Group by type
        by_type = {}
        for s in all_suggestions:
            by_type.setdefault(s.type, []).append(s)

        for clip_type, clips in sorted(by_type.items()):
            print(f"  {clip_type}: {len(clips)}")


if __name__ == "__main__":
    main()
