# AI News Website

Automated pipeline for recording, processing, and publishing the AI News show - a 3D animated news program covering the ElizaOS ecosystem.

**Live at:** [elizaos.news](https://elizaos.news)

## Shows

### Cron Job
Weekly AI news covering ElizaOS development, token economics, and ecosystem updates.

- **Schedule:** Every Sunday at 9pm EST
- **Source:** [Shmotime](https://shmotime.com)
- **Show ID:** 5296

## YouTube Playlists

- [English](https://www.youtube.com/playlist?list=PLp5K4ceh2pR0hfdu4bUoNKCeqYm0n78Xx)
- [Chinese](https://www.youtube.com/playlist?list=PLp5K4ceh2pR3EsXoR4E9s8mRVE_ywioJS)
- [Korean](https://www.youtube.com/playlist?list=PLp5K4ceh2pR3cIS4AEN3UDxoiVrR9J1JB)
- [Archive](https://www.youtube.com/playlist?list=PLp5K4ceh2pR2rFqszls1C8tGo0_ZCgPl6)

## Quick Start

```bash
# Install dependencies
npm install
pip install google-auth google-auth-oauthlib google-api-python-client python-dotenv

# Record the latest episode
./scripts/record_cronjob.sh

# Generate YouTube metadata with chapters
uv run python scripts/generate_youtube_metadata.py episodes/2026-02-02_Cron-Job_*.mp4

# Upload to YouTube
uv run python upload_to_youtube.py --from-json episodes/2026-02-02_*_youtube_metadata.json
```

## Pipeline Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. Record      │────▶│  2. Process     │────▶│  3. Publish     │
│                 │     │                 │     │                 │
│ record_cronjob  │     │ generate_meta   │     │ upload_youtube  │
│ recorder.js     │     │ generate_manifest│    │ cdn_upload      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Scripts

### Recording

| Script | Description |
|--------|-------------|
| `scripts/record_cronjob.sh` | Fetch and record latest Cron Job episode |
| `scripts/recorder.js` | Puppeteer-based recorder with word-level timestamps |

### Processing

| Script | Description |
|--------|-------------|
| `scripts/generate_youtube_metadata.py` | Generate YouTube metadata with auto-chapters |
| `scripts/generate_manifest.py` | Generate manifest with provenance for clips |

### Publishing

| Script | Description |
|--------|-------------|
| `upload_to_youtube.py` | Upload videos to YouTube with metadata |
| `setup_youtube_auth.py` | One-time YouTube OAuth setup |
| `scripts/cdn_upload.py` | Upload assets to Bunny CDN |
| `scripts/update_website.py` | Update episodes.json for the website |
| `scripts/fetch_ai16z_channel.py` | One-time import of long-form `@Ai16Z` videos into `ai16z.json` |

One-time archive import:

```bash
uv run python scripts/fetch_ai16z_channel.py --out ai16z.json
```

## Automated Recording

Set up a cron job to automatically record new episodes:

```bash
# Edit crontab
crontab -e

# Sunday 02:15 UTC = Saturday 9:15pm EST / 6:15pm PST
# Note: '0' = Sunday in cron (UTC). This is Saturday night in US timezones.
15 2 * * 0 cd /path/to/ai-news-website && ./scripts/record_cronjob.sh >> logs/record.log 2>&1
```

### Timing Chain

| Event | UTC | EST | PST |
|-------|-----|-----|-----|
| elizaos workflow | Sun 00:00 | Sat 7pm | Sat 4pm |
| weekly.json ready | Sun 01:00 | Sat 8pm | Sat 5pm |
| Shmotime video ready | Sun 02:00 | Sat 9pm | Sat 6pm |
| **Recorder runs** | **Sun 02:15** | **Sat 9:15pm** | **Sat 6:15pm** |

The recorder runs 15 minutes after the video should be ready, providing a buffer for processing.

### Discord Alerts

Set `ALERT_WEBHOOK_URL` in your environment to receive Discord notifications:
- ✅ Success: Episode recorded successfully
- ❌ Failure: Recording failed (API error or recorder error)
- ℹ️ Skip: Episode already recorded

Test manually:
```bash
./scripts/record_cronjob.sh --dry-run  # Preview
./scripts/record_cronjob.sh            # Record

# With alerts
ALERT_WEBHOOK_URL="your_webhook" ./scripts/record_cronjob.sh --dry-run
```

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
# Bunny CDN (for asset hosting)
BUNNY_STORAGE_ZONE=your_zone
BUNNY_STORAGE_PASSWORD=your_password
BUNNY_CDN_URL=https://cdn.elizaos.news

# YouTube (run setup_youtube_auth.py first)
# Credentials stored in youtube_credentials.json
```

## Directory Structure

```
ai-news-website/
├── episodes/                    # Recorded episodes & metadata
│   ├── clips/                   # Extracted clips
│   │   └── manifest.json        # Clip provenance & CDN URLs
│   ├── thumbnails/              # Episode thumbnails
│   └── *.mp4, *_session-log.json
├── scripts/
│   ├── record_cronjob.sh        # Automated recording
│   ├── recorder.js              # Browser-based recorder
│   ├── generate_manifest.py     # Manifest generation
│   ├── generate_youtube_metadata.py
│   ├── cdn_upload.py            # CDN upload utility
│   └── update_website.py        # Website updater
├── upload_to_youtube.py         # YouTube uploader
├── setup_youtube_auth.py        # YouTube auth setup
├── index.html                   # Website (elizaos.news)
└── .env.example                 # Environment template
```

## Output Files

Recording produces these files:

| File | Description |
|------|-------------|
| `{date}_{show}_{title}.mp4` | Final video (1080p, 30fps) |
| `{date}_{show}_{title}_session-log.json` | Scene/dialogue timing with word timestamps |
| `{date}_{show}_{title}_youtube_metadata.json` | YouTube upload metadata with chapters |

## Clip Types

The manifest system tracks three types of clips:

| Type | Pattern | Provenance |
|------|---------|------------|
| Scene | `*_scene3.mp4` | dialogue array, actors, location, timing |
| Actor | `*_actor_jin_1.mp4` | line text, scene number, location |
| Location | `*_loc_stonks.mp4` | all actors at location |

## Requirements

- Node.js 18+
- Python 3.10+
- Chrome/Chromium (for recording)
- FFmpeg (for video processing)

## License

MIT
