#!/usr/bin/env python3
"""
Fast-Pace Trailer Config Generator

Analyzes episode session logs and generates trailer configurations for Remotion.
Creates "Coming up on Cron Job..." style trailers with aggressive cuts, partial lines,
and dramatic pacing (Mr Beast / Shark Tank preview style).

Usage:
    uv run python scripts/generate_trailer.py episodes/*_session-log.json
    uv run python scripts/generate_trailer.py episodes/*_session-log.json --output=trailers/
    uv run python scripts/generate_trailer.py episodes/*_session-log.json --dry-run
    uv run python scripts/generate_trailer.py episodes/*_session-log.json --manual
"""

import argparse
import json
import os
import sys
from dataclasses import dataclass, field, asdict
from glob import glob
from pathlib import Path
from typing import Any, Optional

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

# Trailer duration targets
MIN_TRAILER_DURATION = 15
MAX_TRAILER_DURATION = 30
TARGET_CLIPS = 6  # 5-7 clips ideal for punchy trailer

# Transition types for dramatic effect
TRANSITIONS = ["hard-cut", "flash-white", "flash-black", "zoom-punch", "glitch"]

SYSTEM_PROMPT = """You are a video editor creating a fast-paced trailer for an AI news show called "Cron Job".

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
- transition: one of "hard-cut", "flash-white", "flash-black", "zoom-punch", "glitch"
- rationale: why this moment hooks viewers (1 sentence)

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
# Data Classes
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


@dataclass
class TrailerConfig:
    """Complete trailer configuration for Remotion."""
    type: str = "trailer"
    duration: float = 0.0
    title: str = "Coming up on Cron Job..."
    music: str = "dramatic-hit.mp3"
    clips: list = field(default_factory=list)
    end_card: dict = field(default_factory=lambda: {
        "text": "Cron Job",
        "subtext": "New episodes weekly",
        "duration": 2
    })
    source_episode: str = ""
    generated_at: str = ""


# ============================================================================
# Token Compression
# ============================================================================

def format_time(seconds: float) -> str:
    """Format seconds as M:SS."""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins}:{secs:02d}"


def compress_for_llm(session_log: dict) -> dict:
    """Convert session-log to token-efficient format for trailer analysis.

    Similar to analyze_clips.py but preserves word indices for partial extraction.
    """
    episode = session_log.get("episode", {})
    show = session_log.get("show", {})

    # Build actor alias map
    actors = {}
    for actor_id in show.get("actors", {}):
        if actor_id == "aishaw":
            actors[actor_id] = "S"
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

            # Include word count for the LLM
            words = d.get("words", [])
            dialogue.append({
                "i": d.get("number", 0),
                "t": format_time(d.get("startSec", 0)),
                "a": actors.get(d.get("actor", ""), d.get("actor", "?")),
                "l": line,
                "w": len(words)  # Word count for partial selection
            })

        if dialogue:
            scenes.append({
                "n": scene.get("number", 0),
                "loc": scene.get("location", ""),
                "dialogue": dialogue
            })

    return {
        "title": episode.get("name", ""),
        "premise": episode.get("premise", ""),
        "actors": actors,
        "scenes": scenes
    }


def estimate_tokens(text: str) -> int:
    """Rough estimate of token count."""
    return len(text) // 4


# ============================================================================
# Partial Line Extraction
# ============================================================================

def extract_partial_line(dialogue: dict, start_word: int, end_word: int) -> dict:
    """Extract timing for partial line using word-level timestamps.

    Args:
        dialogue: Full dialogue object from session-log with words array
        start_word: 0-indexed start word
        end_word: 0-indexed end word (inclusive)

    Returns:
        dict with text, startSec, endSec, duration
    """
    words = dialogue.get("words", [])

    # Clamp indices to valid range
    start_word = max(0, min(start_word, len(words) - 1))
    end_word = max(start_word, min(end_word, len(words) - 1))

    if not words:
        # Fallback to full line timing
        return {
            "text": dialogue.get("line", ""),
            "startSec": dialogue.get("startSec", 0),
            "endSec": dialogue.get("endSec", 0),
            "duration": dialogue.get("endSec", 0) - dialogue.get("startSec", 0)
        }

    # Extract the partial text
    partial_words = words[start_word:end_word + 1]
    text = " ".join(w["word"] for w in partial_words)

    start_sec = partial_words[0]["start"]
    end_sec = partial_words[-1]["end"]

    return {
        "text": text,
        "startSec": start_sec,
        "endSec": end_sec,
        "duration": end_sec - start_sec
    }


def find_dialogue(session_log: dict, scene_num: int, dialogue_num: int) -> Optional[dict]:
    """Find a dialogue entry by scene and dialogue number."""
    episode = session_log.get("episode", {})
    scenes = episode.get("scenes", [])

    # Find scene (1-indexed)
    if scene_num < 1 or scene_num > len(scenes):
        return None

    scene = scenes[scene_num - 1]

    # Find dialogue by number field
    for d in scene.get("dialogue", []):
        if d.get("number") == dialogue_num:
            return d

    return None


# ============================================================================
# LLM Integration
# ============================================================================

def analyze_with_llm(context: dict, model: str = DEFAULT_MODEL, verbose: bool = False) -> list[dict]:
    """Call OpenRouter API for trailer clip suggestions."""
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
            "X-Title": "Cron Job Trailer Generator"
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

    # Parse JSON from response
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
# Manual Mode
# ============================================================================

def interactive_clip_selection(session_log: dict, session_log_path: Path) -> list[dict]:
    """Interactive mode for manually selecting trailer clips."""
    episode = session_log.get("episode", {})
    scenes = episode.get("scenes", [])

    print("\n" + "=" * 60)
    print("MANUAL TRAILER CLIP SELECTION")
    print("=" * 60)
    print(f"\nEpisode: {episode.get('name', 'Unknown')}")
    print(f"Scenes: {len(scenes)}")

    # Show scenes overview
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
                # List dialogue in a scene
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
                # Show words for a specific dialogue
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

            # Parse clip specification
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

            # Validate and preview
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


# ============================================================================
# Trailer Config Generation
# ============================================================================

def resolve_clips(raw_clips: list[dict], session_log: dict, session_log_path: Path) -> list[TrailerClip]:
    """Resolve raw clip suggestions to full TrailerClip objects with timing."""
    resolved = []

    for raw in raw_clips:
        scene_num = raw.get("scene", 1)
        dialogue_num = raw.get("dialogue_num", 1)
        start_word = raw.get("start_word", 0)
        end_word = raw.get("end_word", -1)

        dialogue = find_dialogue(session_log, scene_num, dialogue_num)
        if not dialogue:
            print(f"  Warning: Could not find scene {scene_num} dialogue {dialogue_num}")
            continue

        # If end_word is -1 or not specified, use full line
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
            actor=dialogue.get("actor", "")
        )
        resolved.append(clip)

    return resolved


def generate_trailer_config(
    session_log_path: Path,
    dry_run: bool = False,
    manual: bool = False,
    verbose: bool = False,
    model: str = DEFAULT_MODEL
) -> TrailerConfig:
    """Generate trailer configuration from a session-log file."""
    print(f"\nProcessing: {session_log_path.name}")

    # Load session log
    with open(session_log_path) as f:
        session_log = json.load(f)

    episode = session_log.get("episode", {})
    episode_name = episode.get("name", "Unknown")
    print(f"Episode: {episode_name}")

    # Get clips either from LLM or manual mode
    if manual:
        raw_clips = interactive_clip_selection(session_log, session_log_path)
    elif dry_run:
        # Compress for preview
        compressed = compress_for_llm(session_log)
        print(f"\n[DRY RUN] Would send ~{estimate_tokens(json.dumps(compressed))} tokens to LLM")
        print(f"Scenes: {len(compressed['scenes'])}")
        print(f"Actors: {compressed['actors']}")

        # Show sample dialogue
        for scene in compressed["scenes"][:2]:
            print(f"\nScene {scene['n']} ({scene['loc']}):")
            for d in scene["dialogue"][:3]:
                print(f"  [{d['t']}] {d['a']}: {d['l'][:50]}... ({d['w']} words)")

        return None
    else:
        # Compress and send to LLM
        compressed = compress_for_llm(session_log)

        if verbose:
            print(f"Compressed to ~{estimate_tokens(json.dumps(compressed))} tokens")

        print("\nCalling LLM for trailer clip suggestions...")
        raw_clips = analyze_with_llm(compressed, model=model, verbose=verbose)
        print(f"Received {len(raw_clips)} clip suggestions")

    # Resolve clips with timing
    clips = resolve_clips(raw_clips, session_log, session_log_path)

    if not clips:
        print("Warning: No valid clips resolved")
        return None

    # Calculate total duration
    title_duration = 2.0
    end_card_duration = 2.0
    clips_duration = sum(c.duration for c in clips)
    total_duration = title_duration + clips_duration + end_card_duration

    # Display results
    print(f"\nTrailer clips ({len(clips)} total, {total_duration:.1f}s):")
    for i, clip in enumerate(clips, 1):
        print(f"  {i}. [{clip.actor}] \"{clip.text[:50]}...\"")
        print(f"     Scene {clip.scene}, {clip.duration:.1f}s, {clip.transition}")

    # Build config
    from datetime import datetime
    config = TrailerConfig(
        duration=total_duration,
        clips=[asdict(c) for c in clips],
        source_episode=episode_name,
        generated_at=datetime.now().isoformat()
    )

    return config


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Generate fast-paced trailer configs from session logs"
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
        "--manual",
        action="store_true",
        help="Interactive mode for manual clip selection"
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
    parser.add_argument(
        "--output", "-o",
        default="trailers",
        help="Output directory for trailer configs (default: trailers)"
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
        print("  uv run python scripts/generate_trailer.py episodes/*_session-log.json")
        sys.exit(1)

    print(f"Found {len(session_logs)} session log(s)")

    # Check for API key (unless dry run or manual)
    if not args.dry_run and not args.manual and not os.getenv("OPENROUTER_API_KEY"):
        print("\nError: OPENROUTER_API_KEY environment variable required")
        print("Get your API key from https://openrouter.ai/keys")
        print("Or use --manual for interactive mode")
        sys.exit(1)

    # Create output directory
    output_dir = Path(args.output)
    if not args.dry_run:
        output_dir.mkdir(parents=True, exist_ok=True)

    # Process each file
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
                # Generate output filename
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
    print("  3. Run: npx remotion render Trailer --props=../trailers/<config>.json")
    print("=" * 60)


if __name__ == "__main__":
    main()
