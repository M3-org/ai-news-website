#!/usr/bin/env python3
"""
Discord outreach script for elizaos.news daily briefing and weekly visual post.

Usage:
    # Daily briefing — bot auth, compact embed + expandable buttons:
    python scripts/discord_webhook.py facts.json
    python scripts/discord_webhook.py facts.json --channel 1377401701081944144

    # Weekly visual post — plain webhook, no bot, image + link:
    python scripts/discord_webhook.py --simple --image poster.png --url https://elizaos.news/daily/2026-03-09
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

import discord
from discord import Embed
import requests

# ── Config ──────────────────────────────────────────────────────────
CHANNEL_ID         = int(os.getenv("DISCORD_CHANNEL_ID", "1377401701081944144"))
BOT_TOKEN          = os.getenv("DISCORD_BOT_TOKEN", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
SITE_BASE          = "https://elizaos.news"
EMBED_COLOR        = 0xFF8A00   # orange
VIEW_TIMEOUT       = 300        # seconds bot waits for button clicks (5 min)
# ────────────────────────────────────────────────────────────────────


def _truncate(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    for sep in [". ", ".\n", "\n", " "]:
        idx = text[:max_len].rfind(sep)
        if idx > max_len - 200:
            return text[:idx + 1].rstrip() + "…"
    return text[:max_len - 1] + "…"


def _summarize_via_llm(text: str, max_chars: int) -> str:
    """Trim text via LLM if OPENROUTER_API_KEY is available, else plain truncate."""
    if not OPENROUTER_API_KEY or len(text) <= max_chars:
        return _truncate(text, max_chars)
    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "google/gemini-2.5-flash-preview",
                "messages": [{"role": "user", "content":
                    f"Summarize in ≤{max_chars} characters for a Discord embed. "
                    f"Be concise and factual. Output ONLY the summary:\n\n{text}"}],
                "max_tokens": max_chars // 3,
            },
            timeout=30,
        )
        result = resp.json()["choices"][0]["message"]["content"].strip()
        return _truncate(result, max_chars)
    except Exception as e:
        print(f"LLM summarize failed: {e}")
        return _truncate(text, max_chars)


# ── Expandable section view ───────────────────────────────────────────

class BriefingView(discord.ui.View):
    def __init__(self, facts: dict):
        super().__init__(timeout=VIEW_TIMEOUT)
        self.facts = facts

    def _github_embed(self) -> Embed:
        cats = self.facts.get("categories", {})
        prs = cats.get("github_updates", {}).get("new_issues_prs", [])
        focus = cats.get("github_updates", {}).get("overall_focus", [])
        lines = []
        for item in prs[:8]:
            title = item.get("title", "Untitled")
            url = item.get("url", "")
            sig = item.get("significance", "")
            author = item.get("author", "unknown")
            line = f"• [{title}]({url}) by @{author}" if url else f"• {title} by @{author}"
            if sig:
                line += f"\n  _{sig}_"
            lines.append(line)
        for f in focus[:2]:
            claim = f.get("claim", "")
            if claim:
                lines.append(f"\n📌 {claim}")
        desc = "\n".join(lines) if lines else "No GitHub updates."
        return Embed(title="⚙️ GitHub Updates", description=_truncate(desc, 1800),
                     color=0x95a5a6)

    def _discord_embed(self) -> Embed:
        updates = self.facts.get("categories", {}).get("discord_updates", [])
        lines = []
        for u in updates[:6]:
            ch = u.get("channel", "unknown")
            summary = u.get("summary", "")
            participants = ", ".join(u.get("key_participants", [])[:3])
            lines.append(f"**{ch}** — {summary}")
            if participants:
                lines.append(f"  _{participants}_")
        desc = "\n".join(lines) if lines else "No Discord updates."
        return Embed(title="💬 Discord Highlights", description=_truncate(desc, 1800),
                     color=0x5865F2)

    def _strategy_embed(self) -> Embed:
        cats = self.facts.get("categories", {})
        insights = cats.get("strategic_insights", [])
        market = cats.get("market_analysis", [])
        lines = []
        for s in insights[:5]:
            theme = s.get("theme", "")
            insight = s.get("insight", "")
            if theme:
                lines.append(f"**{theme}**")
            if insight:
                lines.append(insight)
            for q in s.get("implications_or_questions", [])[:1]:
                lines.append(f"  > {q}")
            lines.append("")
        for m in market[:2]:
            obs = m.get("observation", "")
            if obs:
                lines.append(f"📊 {obs}")
        desc = "\n".join(lines).strip() if lines else "No strategic insights."
        return Embed(title="🧠 Strategic Insights", description=_truncate(desc, 1800),
                     color=0x9b59b6)

    @discord.ui.button(label="GitHub Updates", style=discord.ButtonStyle.secondary, emoji="⚙️")
    async def github_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(embed=self._github_embed(), ephemeral=True)

    @discord.ui.button(label="Discord Highlights", style=discord.ButtonStyle.secondary, emoji="💬")
    async def discord_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(embed=self._discord_embed(), ephemeral=True)

    @discord.ui.button(label="Strategic Insights", style=discord.ButtonStyle.secondary, emoji="🧠")
    async def strategy_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(embed=self._strategy_embed(), ephemeral=True)


# ── Main embed builder ────────────────────────────────────────────────

def build_main_embed(facts: dict) -> Embed:
    date = facts.get("briefing_date", "")
    summary = facts.get("overall_summary", "")
    summary = _summarize_via_llm(summary, 400)

    cats = facts.get("categories", {})
    prs = cats.get("github_updates", {}).get("new_issues_prs", [])
    discord_updates = cats.get("discord_updates", [])

    # One-liner GitHub summary
    if prs:
        top = prs[0]
        github_line = f"[{top.get('title', 'Update')}]({top.get('url', '#')})"
        if len(prs) > 1:
            github_line += f" +{len(prs) - 1} more"
    else:
        focus = cats.get("github_updates", {}).get("overall_focus", [])
        github_line = focus[0].get("claim", "No updates") if focus else "No updates"
    github_line = _truncate(github_line, 200)

    # One-liner Discord summary
    if discord_updates:
        top = discord_updates[0]
        discord_line = f"{top.get('channel', '#general')}: {top.get('summary', '')}"
        if len(discord_updates) > 1:
            discord_line += f" (+{len(discord_updates) - 1} channels)"
    else:
        discord_line = "No Discord updates."
    discord_line = _truncate(discord_line, 200)

    site_url = f"{SITE_BASE}/daily/{date}" if date else SITE_BASE

    embed = Embed(
        title=f"📰 ElizaOS Daily — {date}",
        description=summary,
        color=EMBED_COLOR,
        timestamp=datetime.now(timezone.utc),
    )
    embed.set_author(name="elizaos.news", url=SITE_BASE)

    # Thumbnail from poster media fields (try multiple locations)
    poster_url = (
        facts.get("images", {}).get("overall") or
        facts.get("overall_media", {}).get("poster_url") or
        facts.get("media", {}).get("posters", {}).get("overall")
    )
    if poster_url:
        embed.set_thumbnail(url=poster_url)

    embed.add_field(name="⚙️ GitHub", value=github_line, inline=False)
    embed.add_field(name="💬 Discord", value=discord_line, inline=False)
    embed.add_field(name="🔗 Read more",
                    value=f"[elizaos.news/daily/{date}]({site_url})", inline=False)

    return embed


# ── Daily briefing mode (bot) ─────────────────────────────────────────

async def send_daily_briefing(facts_path: str, channel_id: int):
    with open(facts_path) as f:
        facts = json.load(f)

    embed = build_main_embed(facts)
    view = BriefingView(facts)

    if not BOT_TOKEN:
        print("ERROR: DISCORD_BOT_TOKEN not set")
        sys.exit(1)

    intents = discord.Intents.default()
    client = discord.Client(intents=intents)

    @client.event
    async def on_ready():
        try:
            channel = await client.fetch_channel(channel_id)
            await channel.send(embed=embed, view=view)
            print(f"Posted daily briefing to #{channel.name}")
            # Wait for button interactions up to VIEW_TIMEOUT, then exit
            await view.wait()
        except Exception as e:
            print(f"ERROR: {e}")
        finally:
            await client.close()

    try:
        await client.start(BOT_TOKEN)
    except Exception as e:
        print(f"Bot error: {e}")
    finally:
        if not client.is_closed():
            await client.close()
        await asyncio.sleep(0.1)


# ── Simple webhook mode ───────────────────────────────────────────────

async def send_simple(image_path: str | None, url: str | None, channel_id: int, title: str = "elizaos.news — Daily Briefing"):
    """Post a daily video using the bot (no separate webhook URL needed).

    Supports both image (PNG/JPG) and video (MP4) attachments.
    MP4 files are posted as video attachments — Discord plays them inline.
    """
    if not BOT_TOKEN:
        print("ERROR: DISCORD_BOT_TOKEN not set")
        sys.exit(1)

    embed = Embed(
        title=title,
        color=EMBED_COLOR,
    )
    if url:
        embed.url = url
        embed.description = f"[View the full daily briefing]({url})"

    intents = discord.Intents.default()
    client = discord.Client(intents=intents)

    @client.event
    async def on_ready():
        try:
            channel = await client.fetch_channel(channel_id)
            file = None
            if image_path and Path(image_path).exists():
                is_video = Path(image_path).suffix.lower() == ".mp4"
                filename = "daily-card.mp4" if is_video else "poster.png"
                file = discord.File(image_path, filename=filename)
                if not is_video:
                    embed.set_image(url=f"attachment://{filename}")
            await channel.send(embed=embed, file=file)
            print(f"Posted weekly visual to #{channel.name}")
        except Exception as e:
            print(f"ERROR: {e}")
        finally:
            await client.close()

    try:
        await client.start(BOT_TOKEN)
    except Exception as e:
        print(f"Bot error: {e}")
    finally:
        if not client.is_closed():
            await client.close()
        await asyncio.sleep(0.1)


# ── CLI ───────────────────────────────────────────────────────────────

def _resolve_simple_args(date: str | None, image: str | None, url: str | None):
    """Fill in --image and --url from --date if not explicitly provided."""
    if date:
        if not url:
            url = f"{SITE_BASE}/daily/{date}"
        if not image:
            # Look for any PNG in media/daily/<date>/
            media_dir = Path("media/daily") / date
            pngs = sorted(media_dir.glob("*.png")) if media_dir.is_dir() else []
            if pngs:
                image = str(pngs[0])
                print(f"Auto-selected poster: {image}")
            else:
                print(f"No poster found in {media_dir}, posting without image")
    return image, url


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("facts", nargs="?",
                        help="Path to facts JSON (daily briefing mode)")
    parser.add_argument("--channel", type=int, default=CHANNEL_ID,
                        help="Discord channel ID (default: $DISCORD_CHANNEL_ID)")
    parser.add_argument("--simple", action="store_true",
                        help="Video/image mode: posts file + site link")
    parser.add_argument("--title", default="elizaos.news — Daily Briefing",
                        help="Embed title for --simple mode")
    parser.add_argument("--date",
                        help="Date YYYY-MM-DD: auto-fills --url and finds poster in media/daily/")
    parser.add_argument("--image", help="Image file to attach")
    parser.add_argument("--url", help="Site URL to link")
    args = parser.parse_args()

    if args.simple:
        image, url = _resolve_simple_args(args.date, args.image, args.url)
        asyncio.run(send_simple(image, url, args.channel, args.title))
    elif args.facts:
        asyncio.run(send_daily_briefing(args.facts, args.channel))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
