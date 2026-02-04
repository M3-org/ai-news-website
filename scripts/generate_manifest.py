#!/usr/bin/env python3
"""
Generate manifest.json with provenance for media files.

Scans a directory for media files and creates a manifest with:
- File metadata (size, timestamps)
- Provenance information extracted from filenames and session logs
- Placeholder for CDN URLs (populated by cdn_upload.py)

Filename Patterns:
    {date}_{show}_{title}_scene{N}.mp4       - Scene clips
    {date}_{show}_{title}_actor_{name}_{N}.mp4 - Actor clips
    {date}_{show}_{title}_loc_{location}.mp4  - Location clips
    {date}_{show}_{title}.png                 - Thumbnails

Examples:
    # Generate manifest for clips folder
    uv run python scripts/generate_manifest.py episodes/clips/ --show cronjob

    # Custom output path
    uv run python scripts/generate_manifest.py episodes/clips/ --show cronjob -o custom_manifest.json

    # Link to session log for enriched provenance
    uv run python scripts/generate_manifest.py episodes/clips/ --show cronjob \\
        --session-log episodes/2026-02-02_Cron-Job_Workflow-Revolution_session-log.json
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


MEDIA_EXTENSIONS = {'.mp4', '.webm', '.mov', '.png', '.jpg', '.jpeg', '.gif', '.webp'}

# Filename pattern: {date}_{show}_{title}_{suffix}
# Examples:
#   2026-02-02_Cron-Job_Workflow-Revolution_scene3.mp4
#   2026-02-02_Cron-Job_Workflow-Revolution_actor_jin_5.mp4
#   2026-02-02_Cron-Job_Workflow-Revolution_loc_stonks.mp4
FILENAME_PATTERN = re.compile(
    r'^(?P<date>\d{4}-\d{2}-\d{2})_'
    r'(?P<show>[^_]+(?:-[^_]+)?)_'
    r'(?P<title>.+?)_'
    r'(?P<suffix>.+)$'
)

# Suffix patterns
SCENE_PATTERN = re.compile(r'^scene(?P<scene>\d+)$')
ACTOR_PATTERN = re.compile(r'^actor_(?P<actor>[^_]+)_(?P<num>\d+)$')
LOCATION_PATTERN = re.compile(r'^loc_(?P<location>.+)$')


def parse_filename(filename: str) -> dict:
    """
    Parse provenance information from filename.

    Returns dict with keys: date, show, title, clip_type, and type-specific fields.
    """
    name = Path(filename).stem
    provenance = {
        'filename': filename,
        'date': None,
        'show': None,
        'title': None,
        'clip_type': 'unknown'
    }

    match = FILENAME_PATTERN.match(name)
    if not match:
        # Try simpler pattern for thumbnails: {date}_{show}_{title}.png
        simple_pattern = re.compile(
            r'^(?P<date>\d{4}-\d{2}-\d{2})_'
            r'(?P<show>[^_]+(?:-[^_]+)?)_'
            r'(?P<title>.+)$'
        )
        simple_match = simple_pattern.match(name)
        if simple_match:
            provenance['date'] = simple_match.group('date')
            provenance['show'] = simple_match.group('show')
            provenance['title'] = simple_match.group('title')
            provenance['clip_type'] = 'thumbnail'
        return provenance

    provenance['date'] = match.group('date')
    provenance['show'] = match.group('show')
    provenance['title'] = match.group('title')
    suffix = match.group('suffix')

    # Determine clip type from suffix
    scene_match = SCENE_PATTERN.match(suffix)
    if scene_match:
        provenance['clip_type'] = 'scene'
        provenance['scene'] = int(scene_match.group('scene'))
        return provenance

    actor_match = ACTOR_PATTERN.match(suffix)
    if actor_match:
        provenance['clip_type'] = 'actor'
        provenance['actor'] = actor_match.group('actor')
        provenance['clip_number'] = int(actor_match.group('num'))
        return provenance

    location_match = LOCATION_PATTERN.match(suffix)
    if location_match:
        provenance['clip_type'] = 'location'
        provenance['location'] = location_match.group('location')
        return provenance

    # Unknown suffix type
    provenance['suffix'] = suffix
    return provenance


def enrich_from_session_log(provenance: dict, session_data: dict) -> dict:
    """
    Enrich provenance with data from session log.

    Adds episode_id, episode_name, scene descriptions, actor info, dialogue, etc.
    """
    episode = session_data.get('episode', {})
    show = session_data.get('show', {})

    # Basic episode info
    provenance['episode_id'] = episode.get('id')
    provenance['episode_name'] = episode.get('name')

    # Scene enrichment
    if provenance.get('clip_type') == 'scene' and provenance.get('scene'):
        scene_num = provenance['scene']
        scenes = episode.get('scenes', [])
        for scene in scenes:
            if scene.get('number') == scene_num:
                provenance['scene_description'] = scene.get('description', '')
                provenance['scene_location'] = scene.get('location', '')
                # Extract actors from cast
                cast = scene.get('cast', {})
                actors = list(set(cast.values())) if cast else []
                if actors:
                    provenance['actors'] = actors
                # Add timing if available
                if 'startSec' in scene:
                    provenance['start_sec'] = scene['startSec']
                if 'endSec' in scene:
                    provenance['end_sec'] = scene['endSec']
                # Add dialogue as compact array: [{actor: line}, ...]
                dialogue_raw = scene.get('dialogue', [])
                dialogue = [
                    {d.get('actor'): d.get('line')}
                    for d in dialogue_raw
                    if d.get('line')  # Skip non-speech entries
                ]
                if dialogue:
                    provenance['dialogue'] = dialogue
                break

    # Actor enrichment
    if provenance.get('clip_type') == 'actor' and provenance.get('actor'):
        actor_id = provenance['actor']
        actors = show.get('actors', {})
        if actor_id in actors:
            actor_info = actors[actor_id]
            provenance['actor_name'] = actor_info.get('name', actor_id)

        # Find the specific dialogue for this actor clip
        # clip_number corresponds to the Nth dialogue by this actor across all scenes
        clip_num = provenance.get('clip_number', 1)
        actor_dialogues = []
        for scene in episode.get('scenes', []):
            for d in scene.get('dialogue', []):
                if d.get('actor') == actor_id and d.get('line'):
                    actor_dialogues.append({
                        'line': d.get('line'),
                        'scene_number': scene.get('number'),
                        'scene_location': scene.get('location'),
                    })
        if clip_num <= len(actor_dialogues):
            d = actor_dialogues[clip_num - 1]
            provenance['line'] = d['line']
            provenance['scene_number'] = d['scene_number']
            provenance['scene_location'] = d['scene_location']

    # Location enrichment
    if provenance.get('clip_type') == 'location' and provenance.get('location'):
        loc_id = provenance['location']
        locations = show.get('locations', {})
        if loc_id in locations:
            loc_info = locations[loc_id]
            provenance['location_name'] = loc_info.get('name', loc_id)

        # Find all actors who appear at this location
        all_actors = set()
        for scene in episode.get('scenes', []):
            if scene.get('location') == loc_id:
                cast = scene.get('cast', {})
                all_actors.update(cast.values())
        if all_actors:
            provenance['actors'] = list(all_actors)

    return provenance


def load_session_log(path: str) -> Optional[dict]:
    """Load a session log file."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Warning: Failed to load session log: {e}", file=sys.stderr)
        return None


def find_session_log(directory: str, provenance: dict) -> Optional[str]:
    """
    Try to find a matching session log for a file based on its provenance.

    Looks for: {date}_{show}_{title}_session-log.json
    """
    if not all([provenance.get('date'), provenance.get('show'), provenance.get('title')]):
        return None

    # Build expected session log filename
    date = provenance['date']
    show = provenance['show']
    title = provenance['title']

    # Check in parent directory (clips -> episodes)
    parent_dir = Path(directory).parent

    # Try exact match first
    session_log_name = f"{date}_{show}_{title}_session-log.json"
    session_log_path = parent_dir / session_log_name
    if session_log_path.exists():
        return str(session_log_path)

    # Try finding any matching session log
    for f in parent_dir.glob(f"{date}_{show}_*_session-log.json"):
        return str(f)

    return None


def generate_manifest(
    directory: str,
    show: str,
    session_log_path: Optional[str] = None,
    output_path: Optional[str] = None
) -> dict:
    """
    Generate a manifest for all media files in a directory.

    Args:
        directory: Directory to scan
        show: Show identifier (e.g., 'cronjob')
        session_log_path: Optional path to session log for enrichment
        output_path: Optional output path (default: directory/manifest.json)

    Returns:
        Generated manifest dict
    """
    dir_path = Path(directory)
    if not dir_path.exists():
        print(f"ERROR: Directory not found: {directory}", file=sys.stderr)
        return {}

    # Load session log if provided
    session_data = None
    if session_log_path:
        session_data = load_session_log(session_log_path)

    # Collect files
    files = []
    session_log_cache = {}  # Cache loaded session logs

    for file_path in sorted(dir_path.iterdir()):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in MEDIA_EXTENSIONS:
            continue
        if file_path.name == 'manifest.json':
            continue

        # Parse filename for provenance
        provenance = parse_filename(file_path.name)

        # Try to enrich from session log
        if session_data:
            provenance = enrich_from_session_log(provenance, session_data)
        elif not session_log_path:
            # Try to auto-find session log
            found_log = find_session_log(directory, provenance)
            if found_log:
                if found_log not in session_log_cache:
                    session_log_cache[found_log] = load_session_log(found_log)
                if session_log_cache[found_log]:
                    provenance = enrich_from_session_log(provenance, session_log_cache[found_log])

        # Build file entry
        file_entry = {
            'filename': file_path.name,
            'size_bytes': file_path.stat().st_size,
            'provenance': {k: v for k, v in provenance.items() if k != 'filename' and v is not None},
            'cdn_url': None,
            'cdn_path': None,
            'uploaded_at': None
        }

        files.append(file_entry)

    # Build manifest
    manifest = {
        'version': '1.0',
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'source': {
            'show': show,
            'directory': str(dir_path)
        },
        'cdn': {
            'provider': None,
            'base_url': None,
            'uploaded_at': None
        },
        'files': files
    }

    # Write manifest
    if output_path is None:
        output_path = dir_path / 'manifest.json'
    else:
        output_path = Path(output_path)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"Generated manifest: {output_path}")
    print(f"  Files: {len(files)}")
    print(f"  Show: {show}")

    # Show clip type breakdown
    clip_types = {}
    for f in files:
        ct = f['provenance'].get('clip_type', 'unknown')
        clip_types[ct] = clip_types.get(ct, 0) + 1

    if clip_types:
        print(f"  Types: {', '.join(f'{k}={v}' for k, v in sorted(clip_types.items()))}")

    return manifest


def main():
    parser = argparse.ArgumentParser(
        description="Generate manifest.json with provenance for media files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate manifest for clips folder
  uv run python scripts/generate_manifest.py episodes/clips/ --show cronjob

  # Custom output path
  uv run python scripts/generate_manifest.py episodes/clips/ --show cronjob -o custom.json

  # With session log for enriched provenance
  uv run python scripts/generate_manifest.py episodes/clips/ --show cronjob \\
    --session-log episodes/2026-02-02_Cron-Job_Workflow-Revolution_session-log.json
"""
    )

    parser.add_argument(
        "directory",
        help="Directory containing media files"
    )

    parser.add_argument(
        "--show", "-s",
        required=True,
        help="Show identifier (e.g., 'cronjob')"
    )

    parser.add_argument(
        "--output", "-o",
        help="Output manifest path (default: <directory>/manifest.json)"
    )

    parser.add_argument(
        "--session-log",
        help="Path to session-log.json for provenance enrichment"
    )

    args = parser.parse_args()

    # Validate directory
    if not os.path.isdir(args.directory):
        print(f"ERROR: Not a directory: {args.directory}", file=sys.stderr)
        sys.exit(1)

    # Generate manifest
    manifest = generate_manifest(
        args.directory,
        args.show,
        args.session_log,
        args.output
    )

    if not manifest:
        sys.exit(1)

    if not manifest.get('files'):
        print("Warning: No media files found in directory.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
