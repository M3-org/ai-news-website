#!/usr/bin/env python3
"""
Generate Remotion DailyCard props JSON from a facts JSON file.

Accepts a local path or a GitHub raw URL — no local knowledge clone required:

    uv run python scripts/generate_daily_card.py https://raw.githubusercontent.com/elizaOS/knowledge/main/the-council/facts/2026-03-09.json --out /tmp/daily-card-props.json

Or a local path if you have the knowledge repo:

    uv run python scripts/generate_daily_card.py knowledge/the-council/facts/2026-03-09.json --out /tmp/daily-card-props.json
"""

import argparse
import json
import shutil
import sys
import urllib.request
import urllib.error
from pathlib import Path

SITE_BASE = "https://elizaos.news"
KNOWLEDGE_GITHUB = "https://raw.githubusercontent.com/elizaOS/knowledge/main"
MAX_HEADLINE = 160
MAX_ITEMS = 3
FPS = 30
DATE_FRAMES = 60
CHAPTER_FRAMES = 45
OUTRO_FRAMES = 120


def load_json(source: str) -> dict:
    """Load JSON from a local file path or an http(s) URL."""
    if source.startswith("http://") or source.startswith("https://"):
        with urllib.request.urlopen(source) as resp:
            return json.loads(resp.read())
    path = Path(source)
    if not path.exists():
        print(f"ERROR: facts file not found: {path}", file=sys.stderr)
        sys.exit(1)
    with open(path) as f:
        return json.load(f)


def council_source(facts_source: str, date: str) -> str | None:
    """Derive the council_briefing source (URL or path) from the facts source."""
    if facts_source.startswith("http://") or facts_source.startswith("https://"):
        return f"{KNOWLEDGE_GITHUB}/the-council/council_briefing/{date}.json"
    path = Path(facts_source).parent.parent / "council_briefing" / f"{date}.json"
    return str(path) if path.exists() else None


def word_frames(text: str) -> int:
    """Compute per-item frame duration from word count.
    Formula: min(210, max(90, wordCount × 6 + 45)) — max 7s, min 3s at 30fps."""
    words = len(text.strip().split())
    return min(210, max(90, words * 6 + 45))

# Character avatar profile image numbers (matches website's PROFILE_IMG mapping)
COUNCIL_CHARACTERS = ["eliza", "shaw", "marc", "spartan", "peepo"]
PROFILE_IMG = {"eliza": 1, "shaw": 9, "marc": 13, "spartan": 2, "peepo": 2}

def council_avatar(index: int) -> str:
    char = COUNCIL_CHARACTERS[index % len(COUNCIL_CHARACTERS)]
    return f"characters/{char}/{PROFILE_IMG[char]}.png"


IMAGE_MAP = {
    "overall":   ("overall.png",           "daily-card-overall.png"),
    "github":    ("github-updates.png",    "daily-card-github.png"),
    "discord":   ("discord-updates.png",   "daily-card-discord.png"),
    "market":    ("market-analysis.png",   "daily-card-market.png"),
    "strategic": ("strategic-insights.png","daily-card-strategic.png"),
}


def briefing_date_focus_fallback(facts: dict) -> str:
    """Use overall_summary as council focus when no council_briefing file exists."""
    return facts.get("overall_summary", "")[:300]


def initials(name: str) -> str:
    """Return up to 2 uppercase initials from a display name."""
    parts = name.strip().split()
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][0].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("facts", help="Path to facts JSON file")
    parser.add_argument("--out", default="/tmp/daily-card-props.json",
                        help="Output path for props JSON (default: /tmp/daily-card-props.json)")
    parser.add_argument("--out-timing", default=None,
                        help="Output path for timing JSON (optional)")
    args = parser.parse_args()

    facts = load_json(args.facts)
    date = facts.get("briefing_date", Path(args.facts).stem)
    headline = facts.get("overall_summary", "ElizaOS Daily Briefing")[:MAX_HEADLINE]

    cats = facts.get("categories", {})

    # Key facts — full text, no truncation
    key_facts = [str(kf) for kf in facts.get("key_facts", [])[:MAX_ITEMS]]

    # GitHub PRs — avatar from github.com/{author}.png
    prs = cats.get("github_updates", {}).get("new_issues_prs", [])
    github_prs = []
    for pr in prs[:MAX_ITEMS]:
        author = pr.get("author", "") or ""
        item = {
            "primary": pr.get("title", ""),
            "secondary": f"@{author}" if author and author != "unknown" else "",
        }
        if author and author != "unknown":
            item["avatar_url"] = f"https://github.com/{author}.png?size=64"
        github_prs.append(item)

    # Discord updates — initials avatar from first key participant
    discord_raw = cats.get("discord_updates", [])
    discord_updates = []
    for u in discord_raw[:MAX_ITEMS]:
        participants = u.get("key_participants", [])
        channel = u.get("channel", "")
        item = {
            "primary": u.get("summary", ""),
            "secondary": channel if channel.startswith("#") else f"#{channel}",
        }
        if participants:
            item["initials"] = initials(participants[0])
        discord_updates.append(item)

    # User feedback — no avatar
    feedback_raw = cats.get("user_feedback", [])
    user_feedback = [
        {
            "primary": f.get("feedback_summary", ""),
            "secondary": f.get("sentiment", ""),
        }
        for f in feedback_raw[:MAX_ITEMS]
    ]

    # Council sections — from council_briefing/{date}.json (local or GitHub)
    council_focus = ""
    council_topics = []
    council_questions = []

    council_src = council_source(args.facts, date)
    if council_src:
        try:
            briefing = load_json(council_src)
        except (urllib.error.HTTPError, urllib.error.URLError, FileNotFoundError):
            council_src = None

    if council_src:

        council_focus = briefing.get("daily_focus", "")

        for i, kp in enumerate(briefing.get("key_points", [])[:MAX_ITEMS]):
            council_topics.append({
                "primary": kp.get("summary", ""),
                "secondary": kp.get("topic", ""),
                "avatar_url": council_avatar(i),
            })
            # Grab first deliberation question from each key_point
            items = kp.get("deliberation_items", [])
            if items:
                council_questions.append({
                    "primary": items[0].get("text", ""),
                    "secondary": kp.get("topic", ""),
                    "avatar_url": council_avatar(i + 2),  # offset so different chars appear
                })

        council_questions = council_questions[:MAX_ITEMS]
        print(f"  council_focus: loaded ({len(council_focus)} chars)")
        print(f"  council_topics: {len(council_topics)} items")
        print(f"  council_questions: {len(council_questions)} items")
    else:
        # Fallback: use strategic_insights from facts as council_topics
        print(f"  council_briefing not found, using strategic_insights fallback")
        insights_raw = cats.get("strategic_insights", [])
        for i, s in enumerate(insights_raw[:MAX_ITEMS]):
            council_topics.append({
                "primary": s.get("insight", ""),
                "secondary": s.get("theme", ""),
                "avatar_url": council_avatar(i),
            })
        council_focus = briefing_date_focus_fallback(facts)

    # Resolve poster images for Remotion rendering.
    # Each category has a specific image; all fall back to overall if missing.
    # Strategy per image:
    #   1. Local file → copy to remotion/public/ with a predictable staged name
    #   2. CDN URL (constructed from date) — no validation, used as-is
    #   3. Fall back to overall image (local staged or CDN)

    remotion_public = Path("remotion/public")
    remotion_public.mkdir(parents=True, exist_ok=True)

    staged_images: dict = {}

    # First pass: stage whatever local files exist
    for key, (src_file, dest_name) in IMAGE_MAP.items():
        local_candidates = [
            Path(f"media/daily/{date}/{src_file}"),
            # overall fallback name
            Path(f"media/daily/{date}/poster.png") if key == "overall" else None,
        ]
        staged = False
        for candidate in local_candidates:
            if candidate and candidate.exists():
                dest = remotion_public / dest_name
                shutil.copy(candidate, dest)
                staged_images[key] = dest_name  # relative → staticFile() in Remotion
                print(f"  Staged {key}: {candidate} → {dest}")
                staged = True
                break
        if not staged:
            staged_images[key] = None  # will be resolved below

    # Second pass: fill in CDN URLs for missing images, falling back to overall
    overall_val = staged_images.get("overall") or f"{SITE_BASE}/media/daily/{date}/overall.png"
    for key, (src_file, _) in IMAGE_MAP.items():
        if staged_images[key] is None:
            cdn_url = f"{SITE_BASE}/media/daily/{date}/{src_file}"
            # Use CDN if it's not overall (overall already handled above)
            # For category images: use CDN URL; if unsure, fall back to overall
            staged_images[key] = cdn_url if key != "overall" else overall_val
            print(f"  {key}: local not found, using CDN URL {staged_images[key]}")

    poster_url = staged_images["overall"]
    site_url = SITE_BASE.removeprefix("https://")

    props = {
        "date": date,
        "headline": headline,
        "key_facts": key_facts,
        "github_prs": github_prs,
        "discord_updates": discord_updates,
        "user_feedback": user_feedback,
        "council_focus": council_focus,
        "council_topics": council_topics,
        "council_questions": council_questions,
        "poster_url": poster_url,
        "site_url": site_url,
        "images": staged_images,
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(props, f, indent=2)

    print(f"Props written to {out_path}")
    print(f"  date:       {date}")
    print(f"  headline:   {headline[:80]}{'…' if len(headline) > 80 else ''}")
    print(f"  key_facts:  {len(key_facts)} items")
    print(f"  github_prs: {len(github_prs)} items")
    print(f"  discord:    {len(discord_updates)} items")
    print(f"  feedback:   {len(user_feedback)} items")
    print(f"  poster_url: {poster_url}")
    print(f"  images:     overall={staged_images['overall']}")
    print(f"              github={staged_images['github']}")
    print(f"              discord={staged_images['discord']}")
    print(f"              market={staged_images['market']}")
    print(f"              strategic={staged_images['strategic']}")

    # ── Timing JSON ──────────────────────────────────────────────────────────
    if args.out_timing:
        segments = []
        cursor = 0

        def add_seg(seg_id, label, dur, **extra):
            nonlocal cursor
            segments.append({
                "id": seg_id,
                "label": label,
                "start_frame": cursor,
                "duration_frames": dur,
                "duration_seconds": round(dur / FPS, 2),
                **extra,
            })
            cursor += dur

        add_seg("date", "Date Splash", DATE_FRAMES)
        intro_dur = word_frames(headline)
        add_seg("intro", "Intro", intro_dur, word_count=len(headline.split()), text=headline)

        if key_facts:
            add_seg("chapter_key_facts", "Chapter: Key Facts", CHAPTER_FRAMES)
            for i, fact in enumerate(key_facts):
                add_seg(f"key_fact_{i}", f"Key Fact {i+1}", word_frames(fact),
                        word_count=len(fact.split()), text=fact)

        if github_prs:
            add_seg("chapter_development", "Chapter: Development", CHAPTER_FRAMES)
            for i, pr in enumerate(github_prs):
                text = pr["primary"]
                add_seg(f"github_pr_{i}", f"Dev PR {i+1}", word_frames(text),
                        word_count=len(text.split()), text=text)

        if discord_updates:
            add_seg("chapter_community", "Chapter: Community", CHAPTER_FRAMES)
            for i, u in enumerate(discord_updates):
                text = u["primary"]
                add_seg(f"discord_{i}", f"Discord {i+1}", word_frames(text),
                        word_count=len(text.split()), text=text)

        if user_feedback:
            add_seg("chapter_feedback", "Chapter: Feedback", CHAPTER_FRAMES)
            for i, fb in enumerate(user_feedback):
                text = fb["primary"]
                add_seg(f"feedback_{i}", f"Feedback {i+1}", word_frames(text),
                        word_count=len(text.split()), text=text)

        add_seg("chapter_council", "Chapter: The Council", CHAPTER_FRAMES)
        if council_focus:
            add_seg("council_focus", "Council Focus", word_frames(council_focus),
                    word_count=len(council_focus.split()), text=council_focus[:80])
        for i, t in enumerate(council_topics):
            text = t["primary"]
            add_seg(f"council_topic_{i}", f"Council Topic {i+1}", word_frames(text),
                    word_count=len(text.split()), text=text[:80])
        for i, q in enumerate(council_questions):
            text = q["primary"]
            add_seg(f"council_question_{i}", f"Council Question {i+1}", word_frames(text),
                    word_count=len(text.split()), text=text[:80])

        add_seg("outro", "Outro", OUTRO_FRAMES)

        timing = {
            "total_frames": cursor,
            "duration_seconds": round(cursor / FPS, 1),
            "fps": FPS,
            "segments": segments,
        }
        timing_path = Path(args.out_timing)
        timing_path.parent.mkdir(parents=True, exist_ok=True)
        with open(timing_path, "w") as f:
            json.dump(timing, f, indent=2)
        print(f"Timing written to {timing_path}")
        print(f"  total duration: {timing['duration_seconds']}s ({cursor} frames)")


if __name__ == "__main__":
    main()
