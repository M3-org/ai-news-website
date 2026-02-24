#!/usr/bin/env python3
"""Publish Cron Job episode metadata into m3org.com/tv and deploy via git push."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

# Load .env file if present
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass  # dotenv not required if env vars set directly


DATE_PREFIX_RE = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})_")


def extract_youtube_id(value: str) -> Optional[str]:
    if not value:
        return None
    match = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", value)
    if match:
        return match.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", value):
        return value
    return None


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any, dry_run: bool) -> None:
    if dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def resolve_path(raw_path: str, base_dir: Path) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return (base_dir / path).resolve()


def parse_date_from_name(path: Path) -> Optional[str]:
    match = DATE_PREFIX_RE.match(path.name)
    return match.group("date") if match else None


def parse_date_from_source_session_log(metadata: Dict[str, Any]) -> Optional[str]:
    session_log = str(metadata.get("_source", {}).get("session_log", "")).strip()
    if not session_log:
        return None
    return parse_date_from_name(Path(session_log))


def collect_metadata_files(
    source_dir: Path,
    episode_date: Optional[str],
    override: Optional[Path],
    sync_all: bool,
) -> list[Path]:
    if override:
        if not override.exists():
            raise FileNotFoundError(f"metadata file not found: {override}")
        return [override]

    if not source_dir.exists():
        raise FileNotFoundError(f"source directory not found: {source_dir}")

    if sync_all or not episode_date:
        candidates = sorted(source_dir.glob("*_youtube_metadata*.json"))
        if not candidates:
            raise FileNotFoundError(f"no metadata JSON found in {source_dir}")
        return candidates

    pattern = f"{episode_date}_*_youtube_metadata*.json"
    candidates = sorted(source_dir.glob(pattern))
    if not candidates:
        raise FileNotFoundError(f"no metadata JSON found for date {episode_date} in {source_dir}")

    # Use latest mtime if multiple candidates for the same date.
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return [candidates[0]]


def resolve_video_id(
    metadata: Dict[str, Any],
    episode_date: str,
    source_dir: Path,
    episodes_dir: Path,
) -> Optional[str]:
    video_id = extract_youtube_id(str(metadata.get("video_id", "")))
    if video_id:
        return video_id

    video_id = extract_youtube_id(str(metadata.get("url", "")))
    if video_id:
        return video_id

    # Fallback: pipeline state in source dir, then root episodes dir.
    candidate_states = [
        source_dir / f"{episode_date}_pipeline_state.json",
        episodes_dir / f"{episode_date}_pipeline_state.json",
    ]

    for state_path in candidate_states:
        if not state_path.exists():
            continue
        try:
            state = load_json(state_path)
        except Exception:
            continue

        video_id = extract_youtube_id(str(state.get("youtube_video_id", "")))
        if video_id:
            return video_id

        video_id = extract_youtube_id(str(state.get("youtube_url", "")))
        if video_id:
            return video_id

    return None


def build_payload(
    metadata: Dict[str, Any],
    metadata_file: Path,
    episode_date: str,
    source_dir: Path,
    episodes_dir: Path,
) -> Dict[str, str]:
    raw_title = str(metadata.get("title", "")).strip()
    source_show = str(metadata.get("_source", {}).get("show_name", "")).strip()

    if not raw_title:
        raise RuntimeError(f"metadata missing title: {metadata_file}")
    if "cron" not in raw_title.lower() and "cron" not in source_show.lower():
        raise RuntimeError(f"metadata does not look like Cron Job episode: {metadata_file}")

    video_id = resolve_video_id(metadata, episode_date, source_dir, episodes_dir)
    if not video_id:
        raise RuntimeError(f"unable to extract YouTube video ID from {metadata_file}")

    return {
        "id": video_id,
        "title": raw_title,
        "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        "url": f"https://www.youtube.com/watch?v={video_id}",
    }


def collect_episode_payloads(
    metadata_files: list[Path],
    explicit_date: Optional[str],
    source_dir: Path,
    episodes_dir: Path,
) -> Dict[str, Dict[str, str]]:
    payloads: Dict[str, Dict[str, str]] = {}
    mtimes_by_date: Dict[str, float] = {}

    for metadata_file in metadata_files:
        metadata = load_json(metadata_file)

        episode_date = parse_date_from_name(metadata_file)
        if not episode_date:
            episode_date = parse_date_from_source_session_log(metadata)
        if not episode_date and explicit_date:
            episode_date = explicit_date
        if not episode_date:
            raise RuntimeError(f"unable to determine episode date for {metadata_file}")

        payload = build_payload(metadata, metadata_file, episode_date, source_dir, episodes_dir)

        file_mtime = metadata_file.stat().st_mtime
        if episode_date in payloads and file_mtime <= mtimes_by_date[episode_date]:
            continue
        if episode_date in payloads and file_mtime > mtimes_by_date[episode_date]:
            print(f"Warning: duplicate metadata for {episode_date}; using latest file {metadata_file.name}")

        payloads[episode_date] = payload
        mtimes_by_date[episode_date] = file_mtime

    return payloads


def build_episode_data(payloads: Dict[str, Dict[str, str]]) -> Dict[str, Any]:
    return {date: {"en": payloads[date]} for date in sorted(payloads.keys())}


def upsert_episode_data(
    current: Dict[str, Any],
    payloads: Dict[str, Dict[str, str]],
) -> bool:
    changed = False
    for episode_date in sorted(payloads.keys()):
        payload = payloads[episode_date]
        if episode_date not in current:
            current[episode_date] = {}
            changed = True
        if current[episode_date].get("en") != payload:
            current[episode_date]["en"] = payload
            changed = True
    return changed


def upsert_gallery_item(gallery: Dict[str, Any], payload: Dict[str, str], episode_date: str) -> bool:
    items = gallery["items"]
    target_idx = None

    # Primary: match by date (handles re-recording with new video_id)
    for idx, item in enumerate(items):
        if item.get("show") == "cronjob" and item.get("label") == episode_date:
            target_idx = idx
            break

    # Fallback: match by video_id (backward compat)
    if target_idx is None:
        for idx, item in enumerate(items):
            if item.get("show") == "cronjob" and item.get("youtube") == payload["id"]:
                target_idx = idx
                break

    desired = {
        "show": "cronjob",
        "youtube": payload["id"],
        "title": payload["title"],
        "thumbnail": payload["thumbnail"],
        "label": episode_date,
        "description": "Weekly Cron Job episode",
    }

    if target_idx is not None:
        changed = items[target_idx] != desired
        if changed:
            items[target_idx] = desired
        return changed

    insert_at = next((i for i, item in enumerate(items) if item.get("show") == "cronjob"), 0)
    items.insert(insert_at, desired)
    return True


def upsert_gallery_data(gallery: Dict[str, Any], payloads: Dict[str, Dict[str, str]]) -> bool:
    changed = False
    for episode_date in sorted(payloads.keys()):
        changed = upsert_gallery_item(gallery, payloads[episode_date], episode_date) or changed
    return changed


def sync_gallery_data(gallery: Dict[str, Any], payloads: Dict[str, Dict[str, str]]) -> bool:
    old_items = list(gallery["items"])

    episode_cards = []
    for episode_date in sorted(payloads.keys(), reverse=True):
        payload = payloads[episode_date]
        episode_cards.append(
            {
                "show": "cronjob",
                "youtube": payload["id"],
                "title": payload["title"],
                "thumbnail": payload["thumbnail"],
                "label": episode_date,
                "description": "Weekly Cron Job episode",
            }
        )

    filtered_items = [
        item
        for item in old_items
        if not (item.get("show") == "cronjob" and item.get("youtube"))
    ]

    insert_at = next((i for i, item in enumerate(filtered_items) if item.get("show") == "cronjob"), 0)
    new_items = filtered_items[:insert_at] + episode_cards + filtered_items[insert_at:]

    if new_items != old_items:
        gallery["items"] = new_items
        return True
    return False


def run_git(repo: Path, args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=check)


def unpublish_episode(
    episode_date: str,
    website_repo: Path,
    dry_run: bool,
    push: bool,
) -> int:
    """Remove an episode by date from website JSON files."""
    tv_dir = website_repo / "tv"
    episodes_path = tv_dir / "data" / "cronjob-episodes.json"
    gallery_path = tv_dir / "gallery.json"

    changed_episodes = False
    changed_gallery = False
    removed_video_id = None

    # Remove from cronjob-episodes.json
    if episodes_path.exists():
        episodes_data = load_json(episodes_path)
        if episode_date in episodes_data:
            # Capture video_id before removal for playlist cleanup
            en_data = episodes_data[episode_date].get("en", {})
            removed_video_id = en_data.get("id")
            del episodes_data[episode_date]
            changed_episodes = True
            print(f"Removed {episode_date} from {episodes_path}")
        else:
            print(f"Date {episode_date} not found in {episodes_path}")
    else:
        print(f"Episodes file not found: {episodes_path}")

    # Remove from gallery.json
    if gallery_path.exists():
        gallery_data = load_json(gallery_path)
        items = gallery_data.get("items", [])
        original_len = len(items)
        gallery_data["items"] = [
            item for item in items
            if not (item.get("show") == "cronjob" and item.get("label") == episode_date)
        ]
        if len(gallery_data["items"]) < original_len:
            changed_gallery = True
            print(f"Removed {episode_date} gallery entry from {gallery_path}")
        else:
            print(f"Date {episode_date} not found in gallery items")
    else:
        print(f"Gallery file not found: {gallery_path}")

    if not changed_episodes and not changed_gallery:
        print("Nothing to unpublish.")
        return 0

    if dry_run:
        print("[DRY RUN] Would remove:")
        if changed_episodes:
            print(f"  - {episode_date} from {episodes_path}")
        if changed_gallery:
            print(f"  - {episode_date} gallery entry from {gallery_path}")
        if removed_video_id:
            print(f"  - YouTube video ID for playlist cleanup: {removed_video_id}")
        return 0

    if changed_episodes:
        write_json(episodes_path, episodes_data, dry_run=False)
    if changed_gallery:
        write_json(gallery_path, gallery_data, dry_run=False)

    if push:
        run_git(website_repo, ["add", "tv/data/cronjob-episodes.json", "tv/gallery.json"])
        diff = run_git(website_repo, ["diff", "--cached", "--quiet"], check=False)
        if diff.returncode == 0:
            print("No staged changes after git add; skipping commit.")
            return 0
        run_git(website_repo, ["config", "user.email", "github-actions[bot]@users.noreply.github.com"])
        run_git(website_repo, ["config", "user.name", "github-actions[bot]"])
        run_git(website_repo, ["commit", "-m", f"Unpublish Cron Job episode: {episode_date}"])
        run_git(website_repo, ["push", "origin", "main"])
        print(f"Unpublished and pushed for {episode_date}.")

    if removed_video_id:
        print(f"Note: YouTube video {removed_video_id} may need manual playlist/privacy cleanup.")
        print(f"  uv run python scripts/youtube_upload.py --visibility private --video {removed_video_id}")
        playlist_id = os.environ.get("YOUTUBE_PLAYLIST_ID", "")
        if playlist_id:
            print(f"  uv run python scripts/youtube_upload.py --remove-from-playlist {playlist_id} --video {removed_video_id}")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish Cron Job episode updates to m3org website")
    parser.add_argument("--episode-date", help="Episode date YYYY-MM-DD (optional; used for targeted updates)")
    parser.add_argument(
        "--source-dir",
        default="episodes/published",
        help="Source directory containing canonical *_youtube_metadata.json files",
    )
    parser.add_argument(
        "--website-repo",
        default=os.environ.get("WEBSITE_REPO"),
        help="Path to website repo (or set WEBSITE_REPO env var)",
    )
    parser.add_argument("--metadata-json", help="Override metadata JSON path")
    parser.add_argument("--sync-all", action="store_true", help="Rebuild all Cron Job website entries from source-dir")
    parser.add_argument("--unpublish", action="store_true", help="Remove episode by --episode-date from website")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    parser.add_argument("--push", action="store_true", help="Commit and push website repo changes")
    parser.add_argument("--no-push", action="store_true", help="Do not push even if --push provided")
    args = parser.parse_args()

    if not args.website_repo:
        parser.error("--website-repo is required (or set WEBSITE_REPO env var)")

    if args.unpublish:
        if not args.episode_date:
            parser.error("--unpublish requires --episode-date")
        return unpublish_episode(
            episode_date=args.episode_date,
            website_repo=Path(args.website_repo),
            dry_run=args.dry_run,
            push=args.push and not args.no_push,
        )

    project_dir = Path(__file__).resolve().parents[1]
    episodes_dir = project_dir / "episodes"
    source_dir = resolve_path(args.source_dir, project_dir)
    website_repo = Path(args.website_repo)
    tv_dir = website_repo / "tv"
    episodes_path = tv_dir / "data" / "cronjob-episodes.json"
    gallery_path = tv_dir / "gallery.json"

    metadata_override = resolve_path(args.metadata_json, project_dir) if args.metadata_json else None
    sync_all = args.sync_all or (args.episode_date is None and metadata_override is None)

    metadata_files = collect_metadata_files(
        source_dir=source_dir,
        episode_date=args.episode_date,
        override=metadata_override,
        sync_all=sync_all,
    )

    payloads = collect_episode_payloads(
        metadata_files=metadata_files,
        explicit_date=args.episode_date,
        source_dir=source_dir,
        episodes_dir=episodes_dir,
    )
    if not payloads:
        raise RuntimeError("no valid episode payloads were generated")

    episodes_data: Dict[str, Any] = {}
    if episodes_path.exists():
        episodes_data = load_json(episodes_path)

    gallery_data = load_json(gallery_path)

    if sync_all:
        desired_episodes_data = build_episode_data(payloads)
        changed_episodes = episodes_data != desired_episodes_data
        if changed_episodes:
            episodes_data = desired_episodes_data
        changed_gallery = sync_gallery_data(gallery_data, payloads)
    else:
        changed_episodes = upsert_episode_data(episodes_data, payloads)
        changed_gallery = upsert_gallery_data(gallery_data, payloads)

    if not changed_episodes and not changed_gallery:
        print("No website data changes detected.")
        return 0

    write_json(episodes_path, episodes_data, args.dry_run)
    write_json(gallery_path, gallery_data, args.dry_run)

    if args.dry_run:
        print("[DRY RUN] Would update:")
        if changed_episodes:
            print(f"  - {episodes_path}")
        if changed_gallery:
            print(f"  - {gallery_path}")
        return 0

    print("Updated website files:")
    if changed_episodes:
        print(f"  - {episodes_path}")
    if changed_gallery:
        print(f"  - {gallery_path}")

    if args.push and not args.no_push:
        run_git(website_repo, ["add", "tv/data/cronjob-episodes.json", "tv/gallery.json"])

        diff = run_git(website_repo, ["diff", "--cached", "--quiet"], check=False)
        if diff.returncode == 0:
            print("No staged changes after git add; skipping commit.")
            return 0

        run_git(website_repo, ["config", "user.email", "github-actions[bot]@users.noreply.github.com"])
        run_git(website_repo, ["config", "user.name", "github-actions[bot]"])

        commit_date = args.episode_date or sorted(payloads.keys())[-1]
        run_git(website_repo, ["commit", "-m", f"Cron Job weekly update: {commit_date}"])
        run_git(website_repo, ["push", "origin", "main"])
        print("Committed and pushed website updates.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
