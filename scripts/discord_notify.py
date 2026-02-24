#!/usr/bin/env python3
"""
Discord bot notification for Cron Job pipeline.

Sends episode summary with trailer attachment and Publish/Cancel buttons,
plus a bare YouTube URL for native Discord preview. Auto-publishes after
timeout (default 24h).

Usage:
    python3 scripts/discord_notify.py --state episodes/2026-02-08_pipeline_state.json
    python3 scripts/discord_notify.py --state ... --trailer trailers/2026-02-08_trailer.mp4
    python3 scripts/discord_notify.py --state ... --timeout 3600  # 1h instead of 24h

Env vars:
    DISCORD_BOT_TOKEN          - Bot token (required)
    DISCORD_NOTIFY_CHANNEL_ID  - Channel to post in (required)
    DISCORD_PUBLISH_ROLE_ID    - Role ID allowed to click Publish/Cancel (optional)
"""

import argparse
import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

import discord

# Reuse set_privacy function from youtube_upload (same directory)
from youtube_upload import set_privacy as publish


# ---------------------------------------------------------------------------
# Role check helper
# ---------------------------------------------------------------------------

def _has_publish_role(interaction: discord.Interaction, role_id: int | None) -> bool:
    """Check if the user has the required role. Returns True if no role is configured."""
    if not role_id:
        return True
    member = interaction.user
    if not hasattr(member, "roles"):
        return False
    return any(r.id == role_id for r in member.roles)


# ---------------------------------------------------------------------------
# Publish/Cancel view
# ---------------------------------------------------------------------------


class PublishView(discord.ui.View):
    """Two-button view: Publish (green) and Cancel (red)."""

    def __init__(
        self,
        video_id: str,
        timeout: float = 86400,
        role_id: int | None = None,
        content: str = "",
        website_args: dict | None = None,
    ):
        super().__init__(timeout=timeout)
        self.video_id = video_id
        self.role_id = role_id
        self.content = content  # original message content for edits
        self.result = None  # "published", "cancelled", or None (timeout)
        self.website_args = website_args  # args for publish_m3tv.py

    async def _run_website_publish(self) -> subprocess.CompletedProcess | None:
        """Run publish_m3tv.py to push episode data to the website repo."""
        if not self.website_args:
            return None
        args = self.website_args
        if not args.get("website_repo"):
            print("WARNING: No website_repo configured; skipping website publish")
            return None

        cmd = [
            sys.executable, "scripts/publish_m3tv.py",
            "--episode-date", args["episode_date"],
            "--source-dir", args["source_dir"],
            "--website-repo", args["website_repo"],
            "--sync-all", "--push",
        ]
        print(f"Running website publish: {' '.join(cmd)}")
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(cmd, capture_output=True, text=True),
        )
        if result.returncode != 0:
            print(f"publish_m3tv.py failed (rc={result.returncode}):\n{result.stderr}")
        else:
            print("Website publish succeeded")
        return result

    @discord.ui.button(label="Publish", style=discord.ButtonStyle.green)
    async def publish_btn(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        if not _has_publish_role(interaction, self.role_id):
            await interaction.response.send_message(
                "You don't have permission to publish.", ephemeral=True
            )
            return

        await interaction.response.defer()
        try:
            publish(self.video_id, "public")
        except Exception as e:
            await interaction.followup.send(
                f"Publish failed: {e}", ephemeral=True
            )
            return

        # YouTube is now public — update website
        status_parts = [f"\n**Published** by {interaction.user.mention}"]
        wp_result = await self._run_website_publish()
        if wp_result and wp_result.returncode != 0:
            status_parts.append(
                f"\n:warning: YouTube published but website update failed:"
                f"\n```\n{wp_result.stderr[:500]}\n```"
            )

        self.result = "published"
        self._disable_all()
        await interaction.edit_original_response(
            content=self.content + "".join(status_parts),
            view=self,
        )
        self.stop()

    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.red)
    async def cancel_btn(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        if not _has_publish_role(interaction, self.role_id):
            await interaction.response.send_message(
                "You don't have permission.", ephemeral=True
            )
            return

        self.result = "cancelled"
        self._disable_all()
        await interaction.response.edit_message(
            content=self.content + f"\n**Kept unlisted** by {interaction.user.mention}",
            view=self,
        )
        self.stop()

    async def on_timeout(self):
        """Auto-publish when timeout expires."""
        try:
            publish(self.video_id, "public")
            self.result = "published"
            # Also trigger website publish on auto-approve
            await self._run_website_publish()
        except Exception:
            self.result = "timeout_failed"

    def _disable_all(self):
        for item in self.children:
            item.disabled = True


# ---------------------------------------------------------------------------
# Content builders
# ---------------------------------------------------------------------------


def _load_json(path: str) -> dict | list:
    """Load a JSON file if it exists."""
    if path and Path(path).exists():
        with open(path) as f:
            return json.load(f)
    return {}


def _format_duration(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m}m {s}s"


def _build_highlights(trailer_config: dict) -> str:
    """Extract punchy clip quotes from trailer config."""
    clips = trailer_config.get("clips", []) if isinstance(trailer_config, dict) else []
    if not clips:
        return ""
    lines = []
    for clip in clips[:5]:  # cap at 5 to keep it concise
        text = clip.get("text", "").strip().rstrip(",")
        actor = clip.get("actor", "")
        if text:
            lines.append(f'> "{text}" — {actor}')
    return "\n".join(lines)


def build_content(state: dict, metadata: dict, trailer_config: dict, role_id: int | None) -> str:
    """Build the text content for the notification message."""
    title = state.get("episode_title", "Cron Job Episode")
    source = metadata.get("_source", {}) if metadata else {}
    episode_id = source.get("episode_id", "")
    duration_sec = source.get("duration_sec", 0)

    parts = [title]
    if episode_id:
        parts.append(episode_id)
    if duration_sec:
        parts.append(_format_duration(duration_sec))
    headline = " | ".join(parts)

    lines = []
    if role_id:
        lines.append(f"<@&{role_id}> **{headline}**")
    else:
        lines.append(f"**{headline}**")

    # Summary from metadata description (first paragraph)
    description = metadata.get("description", "") if metadata else ""
    if description:
        summary = description.split("\n\n")[0].strip()
        if summary:
            lines.append(summary)

    highlights = _build_highlights(trailer_config)
    if highlights:
        lines.append(highlights)

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Bot entrypoint
# ---------------------------------------------------------------------------


async def run(
    state: dict,
    trailer_path: str | None,
    channel_id: int,
    timeout: float,
    role_id: int | None = None,
    website_args: dict | None = None,
):
    intents = discord.Intents.default()
    client = discord.Client(intents=intents)

    @client.event
    async def on_ready():
        try:
            channel = await client.fetch_channel(channel_id)
        except Exception as e:
            print(f"ERROR: Channel {channel_id} not found: {e}")
            await client.close()
            return

        video_id = state.get("youtube_video_id", "")
        yt_url = state.get("youtube_url", "")
        metadata = _load_json(state.get("metadata_json", ""))
        trailer_config = _load_json(state.get("trailer_config", ""))
        content = build_content(state, metadata, trailer_config, role_id)

        # Attach trailer if available
        file = None
        if trailer_path and Path(trailer_path).exists():
            file = discord.File(trailer_path, filename=Path(trailer_path).name)

        # Message 1: content + trailer attachment
        await channel.send(
            content=content,
            file=file,
            allowed_mentions=discord.AllowedMentions(roles=True),
        )

        # Message 2: YouTube URL (native preview) + Publish/Cancel buttons
        msg = None
        view = (
            PublishView(
                video_id=video_id,
                timeout=timeout,
                role_id=role_id,
                content=yt_url,
                website_args=website_args,
            )
            if video_id
            else None
        )
        if yt_url:
            msg = await channel.send(
                content=yt_url,
                view=view,
            )
        elif view:
            msg = await channel.send(view=view)

        if view and msg:
            # Wait for button press or timeout
            await view.wait()

            # Button handlers edit the message themselves for publish/cancel.
            # Only timeout needs a fallback edit here.
            if view.result is None or view.result == "timeout_failed":
                status = "Auto-published" if view.result is None else "Auto-publish failed"
                view._disable_all()
                try:
                    await msg.edit(
                        content=yt_url + f"\n**{status}** after timeout",
                        view=view,
                    )
                except Exception:
                    pass

        await client.close()

    token = os.environ.get("DISCORD_BOT_TOKEN", "")
    if not token:
        print("ERROR: DISCORD_BOT_TOKEN not set")
        sys.exit(1)

    await client.start(token)


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--state", required=True, help="Pipeline state JSON file")
    parser.add_argument("--trailer", help="Trailer .mp4 to attach")
    parser.add_argument(
        "--channel-id",
        type=int,
        default=int(os.environ.get("DISCORD_NOTIFY_CHANNEL_ID", "0")),
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=86400,
        help="Seconds to wait for button press (default: 86400 = 24h)",
    )
    parser.add_argument(
        "--role-id",
        type=int,
        default=int(os.environ.get("DISCORD_PUBLISH_ROLE_ID", "0")) or None,
        help="Discord role ID required to click Publish/Cancel",
    )
    parser.add_argument(
        "--publish-source-dir",
        help="Source directory for publish_m3tv.py (episodes/published)",
    )
    parser.add_argument(
        "--episode-date",
        help="Episode date YYYY-MM-DD for publish_m3tv.py",
    )
    parser.add_argument(
        "--website-repo",
        default=os.environ.get("WEBSITE_REPO"),
        help="Path to website repo for publish_m3tv.py",
    )
    args = parser.parse_args()

    with open(args.state) as f:
        state = json.load(f)

    if not args.channel_id:
        print("ERROR: --channel-id or DISCORD_NOTIFY_CHANNEL_ID required")
        sys.exit(1)

    # Build website publish args if provided
    website_args = None
    if args.publish_source_dir and args.episode_date:
        website_args = {
            "source_dir": args.publish_source_dir,
            "episode_date": args.episode_date,
            "website_repo": args.website_repo or "",
        }

    asyncio.run(run(state, args.trailer, args.channel_id, args.timeout, args.role_id, website_args))


if __name__ == "__main__":
    main()
