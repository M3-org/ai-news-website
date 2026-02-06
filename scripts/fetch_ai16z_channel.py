#!/usr/bin/env python3
"""One-time importer for @Ai16Z channel uploads into ai16z.json (no API key).

Requires:
  - yt-dlp installed and available in PATH

Usage:
  uv run python scripts/fetch_ai16z_channel.py
  uv run python scripts/fetch_ai16z_channel.py --channel-url https://www.youtube.com/@Ai16Z/videos --max-results 500
"""

import argparse
import datetime as dt
import json
import subprocess
import sys
from typing import Any, Dict, List


def to_published_at(entry: Dict[str, Any]) -> str:
    upload_date = entry.get("upload_date", "")
    if len(upload_date) == 8 and upload_date.isdigit():
        return f"{upload_date[0:4]}-{upload_date[4:6]}-{upload_date[6:8]}T00:00:00Z"
    return entry.get("release_timestamp") or ""


def extract_thumbnail(entry: Dict[str, Any]) -> str:
    thumbs = entry.get("thumbnails") or []
    if isinstance(thumbs, list) and thumbs:
        # yt-dlp generally returns ascending widths; take the largest
        best = sorted(thumbs, key=lambda t: (t.get("width") or 0, t.get("height") or 0))[-1]
        return best.get("url", "")
    thumb = entry.get("thumbnail")
    return thumb or ""


def run_ytdlp(channel_url: str, max_results: int) -> Dict[str, Any]:
    cmd = [
        "yt-dlp",
        "--dump-single-json",
        "--playlist-end", str(max_results),
        "--ignore-errors",
        "--no-warnings",
        channel_url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {proc.stderr.strip() or proc.stdout.strip()}")
    if not proc.stdout.strip():
        raise RuntimeError("yt-dlp returned empty output")
    return json.loads(proc.stdout)


def build_json(
    channel_handle: str,
    source: Dict[str, Any],
    min_duration_seconds: int,
) -> Dict[str, Any]:
    entries = source.get("entries") or []
    rows: List[Dict[str, Any]] = []
    seen = set()
    for entry in entries:
        if not entry:
            continue
        video_id = entry.get("id", "")
        if not video_id or video_id in seen:
            continue
        seen.add(video_id)

        # Skip live/upcoming streams for archive cleanliness
        live_status = entry.get("live_status")
        if live_status in ("is_live", "is_upcoming"):
            continue

        duration = entry.get("duration")
        duration_seconds = int(duration) if isinstance(duration, (int, float)) else 0
        if duration_seconds < min_duration_seconds:
            continue

        rows.append({
            "id": video_id,
            "title": entry.get("title", ""),
            "description": entry.get("description", "") or "",
            "publishedAt": to_published_at(entry),
            "durationSeconds": duration_seconds,
            "thumbnail": extract_thumbnail(entry),
            "url": entry.get("webpage_url") or f"https://www.youtube.com/watch?v={video_id}",
        })

    rows.sort(key=lambda x: x.get("publishedAt", ""), reverse=True)
    channel_id = source.get("channel_id", "")
    channel_title = source.get("channel") or source.get("uploader") or "Ai16Z"
    return {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "channel": {
            "handle": channel_handle,
            "id": channel_id,
            "title": channel_title,
        },
        "items": rows,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch long-form @Ai16Z uploads into ai16z.json using yt-dlp")
    parser.add_argument("--channel-handle", default="@Ai16Z", help="Channel handle used for metadata only")
    parser.add_argument("--channel-url", default="https://www.youtube.com/@Ai16Z/videos", help="YouTube channel videos URL")
    parser.add_argument("--max-results", type=int, default=400, help="Maximum videos to inspect from channel list")
    parser.add_argument("--min-duration-seconds", type=int, default=120, help="Minimum duration to keep")
    parser.add_argument("--out", default="ai16z.json", help="Output JSON path")
    args = parser.parse_args()

    try:
        raw = run_ytdlp(args.channel_url, args.max_results)
        payload = build_json(
            channel_handle=args.channel_handle,
            source=raw,
            min_duration_seconds=args.min_duration_seconds,
        )
    except Exception as error:  # noqa: BLE001
        print(f"Failed to build archive: {error}", file=sys.stderr)
        return 1

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(payload['items'])} long-form videos to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
