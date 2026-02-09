#!/usr/bin/env python3
"""Publish latest Cron Job episode metadata into m3org.com/tv and deploy via git push."""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional


def extract_youtube_id(value: str) -> Optional[str]:
    if not value:
        return None
    m = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", value)
    if m:
        return m.group(1)
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


def find_metadata_file(episodes_dir: Path, episode_date: str, override: Optional[Path]) -> Path:
    if override:
        if not override.exists():
            raise FileNotFoundError(f"metadata file not found: {override}")
        return override

    pattern = str(episodes_dir / f"{episode_date}_*_youtube_metadata*.json")
    candidates = sorted(glob.glob(pattern))
    if not candidates:
        raise FileNotFoundError(f"no metadata JSON found for date {episode_date}: {pattern}")

    # Use latest mtime if multiple candidates.
    candidates.sort(key=lambda p: Path(p).stat().st_mtime, reverse=True)
    return Path(candidates[0])


def normalize_title(raw_title: str) -> str:
    title = raw_title.strip()
    title = re.sub(r"\s+\|\s*.*$", "", title)
    title = re.sub(r"\s*-\s*Cron\s*Job\s*$", "", title, flags=re.IGNORECASE)
    if not title.lower().startswith("cron job"):
        title = f"Cron Job: {title}"
    return title


def upsert_episode_data(data: Dict[str, Any], episode_date: str, payload: Dict[str, str]) -> bool:
    changed = False
    if episode_date not in data:
        data[episode_date] = {}
        changed = True
    if data[episode_date].get("en") != payload:
        data[episode_date]["en"] = payload
        changed = True
    return changed


def upsert_gallery_item(gallery: Dict[str, Any], payload: Dict[str, str], episode_date: str) -> bool:
    items = gallery["items"]
    target_idx = None
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

    insert_at = next((i for i, it in enumerate(items) if it.get("show") == "cronjob"), 0)
    items.insert(insert_at, desired)
    return True


def run_git(repo: Path, args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=check)


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish Cron Job episode updates to m3org website")
    parser.add_argument("--episode-date", required=True, help="Episode date YYYY-MM-DD")
    parser.add_argument("--website-repo", default=os.environ.get("WEBSITE_REPO"),
                        help="Path to website repo (or set WEBSITE_REPO env var)")
    parser.add_argument("--metadata-json", help="Override metadata JSON path")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    parser.add_argument("--push", action="store_true", help="Commit and push website repo changes")
    parser.add_argument("--no-push", action="store_true", help="Do not push even if --push provided")
    args = parser.parse_args()

    if not args.website_repo:
        parser.error("--website-repo is required (or set WEBSITE_REPO env var)")

    project_dir = Path(__file__).resolve().parents[1]
    episodes_dir = project_dir / "episodes"
    website_repo = Path(args.website_repo)
    tv_dir = website_repo / "tv"
    episodes_path = tv_dir / "data" / "cronjob-episodes.json"
    gallery_path = tv_dir / "gallery.json"

    metadata_file = find_metadata_file(
        episodes_dir,
        args.episode_date,
        Path(args.metadata_json) if args.metadata_json else None,
    )
    metadata = load_json(metadata_file)

    raw_title = metadata.get("title", "").strip()
    source_show = str(metadata.get("_source", {}).get("show_name", "")).strip()
    if not raw_title:
        raise RuntimeError(f"metadata missing title: {metadata_file}")
    if "cron" not in raw_title.lower() and "cron" not in source_show.lower():
        raise RuntimeError(f"metadata does not look like Cron Job episode: {metadata_file}")

    video_id = extract_youtube_id(str(metadata.get("video_id", "")))
    if not video_id:
        video_id = extract_youtube_id(str(metadata.get("url", "")))
    if not video_id:
        raise RuntimeError(f"unable to extract YouTube video ID from {metadata_file}")

    title = normalize_title(raw_title)
    payload = {
        "id": video_id,
        "title": title,
        "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        "url": f"https://www.youtube.com/watch?v={video_id}",
    }

    episodes_data: Dict[str, Any] = {}
    if episodes_path.exists():
        episodes_data = load_json(episodes_path)

    gallery_data = load_json(gallery_path)

    changed_episodes = upsert_episode_data(episodes_data, args.episode_date, payload)
    changed_gallery = upsert_gallery_item(gallery_data, payload, args.episode_date)

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
        run_git(website_repo, ["commit", "-m", f"Cron Job weekly update: {args.episode_date}"])
        run_git(website_repo, ["push", "origin", "main"])
        print("Committed and pushed website updates.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
