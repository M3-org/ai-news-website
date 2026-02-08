#!/usr/bin/env python3
"""
Generate YouTube metadata from session-log.json files.

This script creates rich YouTube metadata including:
- Auto-generated chapters from scene timestamps
- Titles combining episode and show names
- Descriptions with premise and chapters
- Tags extracted from actors and show info
- Thumbnail handling

Output is a JSON file compatible with youtube_upload.py --from-json
"""

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path


def format_timestamp(seconds: float) -> str:
    """Convert seconds to MM:SS or H:MM:SS format for YouTube chapters."""
    total_seconds = int(seconds)
    mins, secs = divmod(total_seconds, 60)
    hours, mins = divmod(mins, 60)
    if hours:
        return f"{hours}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"


def truncate_description(text: str, max_length: int = 50) -> str:
    """Truncate scene description for chapter title."""
    if len(text) <= max_length:
        return text
    return text[:max_length - 3].rsplit(' ', 1)[0] + "..."


def generate_chapters(scenes: list, add_intro: bool = True) -> str:
    """
    Convert scenes to YouTube chapter format.

    YouTube requirements:
    - First chapter must start at 0:00
    - Minimum 3 chapters
    - Minimum 10 seconds each
    """
    if not scenes:
        return ""

    chapters = []

    # Check if first scene starts after 0:00 - add intro chapter
    first_scene_start = scenes[0].get('startSec', 0)
    if add_intro and first_scene_start > 1:
        chapters.append("00:00 Intro")

    for scene in scenes:
        start_sec = scene.get('startSec', 0)
        description = scene.get('description', f"Scene {scene.get('number', '?')}")

        timestamp = format_timestamp(start_sec)
        chapter_title = truncate_description(description)
        chapters.append(f"{timestamp} {chapter_title}")

    # YouTube requires at least 3 chapters
    if len(chapters) < 3:
        return ""  # Don't add chapters if we can't meet the minimum

    return "\n".join(chapters)


def extract_tags(session_data: dict) -> list:
    """Extract relevant tags from session data."""
    tags = []

    # Show name
    show = session_data.get('show', {})
    show_name = show.get('name', '')
    if show_name:
        tags.append(show_name)

    # Actor names
    actors = show.get('actors', {})
    for actor_id, actor_info in actors.items():
        actor_name = actor_info.get('name', '')
        if actor_name and actor_name not in tags:
            tags.append(actor_name)

    # Common tags for the show type
    common_tags = ['AI News', 'ElizaOS', 'AI Agents', 'Web3', 'Crypto News']
    for tag in common_tags:
        if tag not in tags:
            tags.append(tag)

    return tags


def download_thumbnail(url: str, output_path: str) -> bool:
    """Download thumbnail from URL to local file."""
    try:
        print(f"Downloading thumbnail from {url}")
        urllib.request.urlretrieve(url, output_path)
        print(f"Thumbnail saved to {output_path}")
        return True
    except Exception as e:
        print(f"Warning: Failed to download thumbnail: {e}")
        return False


def generate_metadata(session_log_path: str, options: dict) -> dict:
    """
    Generate YouTube metadata from session-log.json.

    Args:
        session_log_path: Path to session-log.json file
        options: Dictionary with optional settings:
            - playlist_id: YouTube playlist ID
            - privacy: Privacy status (public, unlisted, private)
            - download_thumb: Whether to download thumbnail
            - output_dir: Directory for output files

    Returns:
        Dictionary with YouTube metadata
    """
    with open(session_log_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    session_dir = os.path.dirname(os.path.abspath(session_log_path))

    # Extract basic info
    show = data.get('show', {})
    episode = data.get('episode', {})

    show_name = show.get('name', 'AI News')
    episode_name = episode.get('name', 'Episode')
    episode_id = episode.get('id', '')
    premise = episode.get('premise', '')
    scenes = episode.get('scenes', [])
    video_file = data.get('video_file', '')
    episode_image = episode.get('image', '')

    # Build title: "Episode Name - Show Name | Episode ID"
    title_parts = [episode_name, show_name]
    if episode_id:
        title = f"{episode_name} - {show_name} | {episode_id}"
    else:
        title = f"{episode_name} - {show_name}"

    # Build description with premise and chapters
    description_parts = []

    if premise:
        description_parts.append(premise)
        description_parts.append("")  # Empty line

    # Generate chapters
    chapters = generate_chapters(scenes)
    if chapters:
        description_parts.append("Chapters:")
        description_parts.append(chapters)
        description_parts.append("")

    # Add footer
    description_parts.append("---")
    description_parts.append(f"Subscribe for more {show_name} episodes!")

    description = "\n".join(description_parts)

    # Extract tags
    tags = extract_tags(data)
    tags_str = ",".join(tags)

    # Resolve video file path
    if video_file:
        # Check if video_file is relative to session log
        if not os.path.isabs(video_file):
            video_path = os.path.join(session_dir, video_file)
            if not os.path.exists(video_path):
                # Try current directory
                if os.path.exists(video_file):
                    video_path = os.path.abspath(video_file)
                else:
                    video_path = video_file  # Keep as-is, let upload script handle it
        else:
            video_path = video_file
    else:
        video_path = ""

    # Handle thumbnail
    thumbnail_path = None
    if options.get('download_thumb') and episode_image:
        # Generate thumbnail filename based on video file
        thumb_ext = os.path.splitext(episode_image)[1] or '.jpg'
        thumb_filename = os.path.splitext(os.path.basename(session_log_path))[0].replace('_session-log', '') + '_thumbnail' + thumb_ext
        thumb_path = os.path.join(options.get('output_dir', session_dir), thumb_filename)
        if download_thumbnail(episode_image, thumb_path):
            thumbnail_path = thumb_path
    elif episode_image and not episode_image.startswith('http'):
        # Local file path
        thumbnail_path = episode_image

    # Build metadata output
    metadata = {
        "video_file": video_path,
        "title": title,
        "description": description,
        "tags": tags_str,
        "category_id": "22",  # People & Blogs
        "privacy_status": options.get('privacy', 'public'),
    }

    if thumbnail_path:
        metadata["thumbnail_file"] = thumbnail_path
    elif episode_image and episode_image.startswith('http'):
        # Store URL for reference (upload script may need to handle this)
        metadata["thumbnail_url"] = episode_image

    if options.get('playlist_id'):
        metadata["playlist_id"] = options['playlist_id']

    # Store source info for reference
    metadata["_source"] = {
        "session_log": session_log_path,
        "show_name": show_name,
        "episode_id": episode_id,
        "episode_name": episode_name,
        "duration_sec": data.get('duration_sec'),
        "scene_count": len(scenes)
    }

    return metadata


def main():
    parser = argparse.ArgumentParser(
        description="Generate YouTube metadata from session-log.json files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate metadata with default settings
  uv run python scripts/youtube_metadata.py episodes/session-log.json

  # Generate metadata with playlist and custom output
  uv run python scripts/youtube_metadata.py episodes/session-log.json \\
    --playlist-id PLxxxxxxx \\
    --output episodes/youtube_metadata.json

  # Download thumbnail and set privacy
  uv run python scripts/youtube_metadata.py episodes/session-log.json \\
    --download-thumb \\
    --privacy unlisted
"""
    )

    parser.add_argument(
        "session_log",
        help="Path to session-log.json file"
    )

    parser.add_argument(
        "--output", "-o",
        help="Output metadata JSON path (default: <input>_youtube_metadata.json)"
    )

    parser.add_argument(
        "--playlist-id",
        help="YouTube playlist ID to include in metadata"
    )

    parser.add_argument(
        "--privacy",
        choices=["public", "unlisted", "private"],
        default="public",
        help="Privacy status (default: public)"
    )

    parser.add_argument(
        "--download-thumb",
        action="store_true",
        help="Download thumbnail from URL to local file"
    )

    parser.add_argument(
        "--category-id",
        default="22",
        help="YouTube category ID (default: 22 = People & Blogs)"
    )

    args = parser.parse_args()

    # Validate input file
    if not os.path.exists(args.session_log):
        print(f"ERROR: Session log file not found: {args.session_log}")
        sys.exit(1)

    # Determine output path
    if args.output:
        output_path = args.output
    else:
        # Generate default output path
        base_name = os.path.splitext(args.session_log)[0]
        if base_name.endswith('_session-log'):
            base_name = base_name[:-12]  # Remove '_session-log' suffix
        output_path = f"{base_name}_youtube_metadata.json"

    output_dir = os.path.dirname(output_path) or '.'

    # Generate metadata
    options = {
        'playlist_id': args.playlist_id,
        'privacy': args.privacy,
        'download_thumb': args.download_thumb,
        'output_dir': output_dir,
        'category_id': args.category_id,
    }

    try:
        metadata = generate_metadata(args.session_log, options)

        # Update category_id if specified
        if args.category_id:
            metadata['category_id'] = args.category_id

        # Write output
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        print(f"\n✅ YouTube metadata generated: {output_path}")
        print(f"\nMetadata summary:")
        print(f"  Title: {metadata['title']}")
        print(f"  Tags: {metadata['tags'][:60]}...")
        print(f"  Privacy: {metadata['privacy_status']}")
        print(f"  Video: {metadata.get('video_file', 'Not set')}")
        if metadata.get('thumbnail_file'):
            print(f"  Thumbnail: {metadata['thumbnail_file']}")
        if metadata.get('playlist_id'):
            print(f"  Playlist: {metadata['playlist_id']}")

        # Show chapter count
        chapters = metadata['description'].split('Chapters:')
        if len(chapters) > 1:
            chapter_lines = [l for l in chapters[1].split('\n') if l.strip() and not l.startswith('---')]
            print(f"  Chapters: {len(chapter_lines)}")

        print(f"\nTo upload, run:")
        print(f"  uv run python scripts/youtube_upload.py --from-json {output_path}")

    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in session log: {e}")
        sys.exit(1)
    except KeyError as e:
        print(f"ERROR: Missing required field in session log: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
