#!/usr/bin/env python3
"""Change a YouTube video's privacy status (e.g. unlisted -> public).

Usage:
    python3 scripts/publish_youtube.py VIDEO_ID
    python3 scripts/publish_youtube.py VIDEO_ID --privacy unlisted
    python3 scripts/publish_youtube.py --from-state episodes/2026-02-08_pipeline_state.json
"""

import argparse
import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace

# Reuse existing auth from upload_to_youtube.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from upload_to_youtube import get_authenticated_service


def _make_auth_args():
    """Build a minimal args namespace for get_authenticated_service()."""
    return SimpleNamespace(
        client_secrets=os.environ.get(
            "YOUTUBE_CLIENT_SECRETS_PATH", "client_secrets.json"
        ),
        credentials_storage=os.environ.get(
            "YOUTUBE_CREDENTIALS_LOCAL_PATH", "youtube_credentials.json"
        ),
    )


def publish(video_id: str, privacy: str = "public") -> dict:
    """Update a video's privacy status. Returns the updated status."""
    youtube = get_authenticated_service(_make_auth_args())
    response = (
        youtube.videos()
        .update(
            part="status",
            body={
                "id": video_id,
                "status": {"privacyStatus": privacy},
            },
        )
        .execute()
    )
    return response


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("video_id", nargs="?", help="YouTube video ID")
    parser.add_argument(
        "--from-state", help="Read video_id from pipeline state JSON"
    )
    parser.add_argument(
        "--privacy",
        default="public",
        choices=["public", "private", "unlisted"],
    )
    args = parser.parse_args()

    video_id = args.video_id
    if args.from_state:
        with open(args.from_state) as f:
            state = json.load(f)
        video_id = state.get("youtube_video_id", video_id)

    if not video_id:
        parser.error("Provide a video_id or --from-state")

    result = publish(video_id, args.privacy)
    status = result.get("status", {}).get("privacyStatus", "unknown")
    print(f"{video_id} -> {status}")


if __name__ == "__main__":
    main()
