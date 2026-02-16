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
pip install google-auth google-auth-oauthlib google-api-python-client python-dotenv requests

# Run the full pipeline (record + process + publish)
./scripts/run_pipeline.sh

# Or run individual steps:

# Generate YouTube metadata with chapters
python3 scripts/youtube_metadata.py episodes/2026-02-02_Cron-Job_*_session-log.json

# Upload to YouTube
python3 scripts/youtube_upload.py --from-json episodes/2026-02-02_*_youtube_metadata.json

# Analyze clips via LLM
python3 scripts/llm_producer.py clips episodes/*_session-log.json

# Generate trailer config via LLM
python3 scripts/llm_producer.py trailer episodes/*_session-log.json
```

## Pipeline Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. Record      │────>│  2. Process     │────>│  3. Publish     │
│                 │     │                 │     │                 │
│ run_pipeline.sh │     │ generate_meta   │     │ youtube_upload  │
│ recorder.cjs     │     │ llm_producer.py │     │ cdn_upload      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Automation

### Local Cron Job (Cron Job show)

Add this one-liner to your crontab to run the weekly pipeline every Sunday at 02:15 UTC:

```bash
(crontab -l 2>/dev/null; echo "15 2 * * 0 cd $(pwd) && ./scripts/run_pipeline.sh >> logs/pipeline.log 2>&1") | crontab -
```

### GitHub Actions (Daily poster generation)

Two workflows auto-generate illustrations from the [elizaOS/knowledge](https://github.com/elizaOS/knowledge) facts:

- **Daily workflow** — Runs at 11:00 UTC (30 min after knowledge repo updates)
- **Manual workflow** — Configurable date, icons, CDN upload, dry-run options

**Required GitHub Secrets:**
- `OPENROUTER_API_KEY` — OpenRouter API key (required for image generation)
- `BUNNY_STORAGE_ZONE` — Bunny CDN storage zone (optional, for auto-upload)
- `BUNNY_STORAGE_PASSWORD` — Bunny CDN API password (optional)
- `BUNNY_CDN_URL` — CDN base URL like `https://cdn.elizaos.news` (optional)

Set these at: **Settings → Secrets and variables → Actions → New repository secret**

## Scripts

### Recording

| Script | Description |
|--------|-------------|
| `scripts/run_pipeline.sh` | Full end-to-end pipeline orchestrator |
| `scripts/recorder.cjs` | Puppeteer-based recorder with word-level timestamps |

### Processing

| Script | Description |
|--------|-------------|
| `scripts/youtube_metadata.py` | Generate YouTube metadata with auto-chapters |
| `scripts/llm_producer.py clips` | LLM-based clip analysis with optional ffmpeg extraction |
| `scripts/llm_producer.py trailer` | LLM-based trailer config generator for Remotion |
| `scripts/generate_manifest.py` | Generate manifest with provenance for clips; `--metadata-json` to link YouTube URL |
| `scripts/posters/illustrate.py` | Generate social media posters from knowledge repo facts |
| `scripts/generate-rss.py` | Generate RSS feeds for daily facts and council notes |

### Publishing

| Script | Description |
|--------|-------------|
| `scripts/youtube_upload.py` | Upload videos to YouTube; `--visibility` to change listing status |
| `setup_youtube_auth.py` | One-time YouTube OAuth setup |
| `scripts/cdn_upload.py` | Upload assets to Bunny CDN (pipeline + poster workflows, with retry and `--update-manifest`) |
| `scripts/publish_m3tv.py` | Update website with episode data |
| `scripts/discord_notify.py` | Discord notification bot |

### Dashboards

| Dashboard | Description |
|-----------|-------------|
| `media/dashboards/index.html` | Central hub for facts viewer, gallery, validation tools |
| `media/dashboards/facts.html` | Browse daily facts from knowledge repo with media previews |
| `media/dashboards/gallery.html` | Visual gallery of all generated posters |
| `media/dashboards/council.html` | Council meeting notes viewer |

Legacy `/dashboards/*.html` URLs are maintained as redirect shims to `media/dashboards/*.html`.

### Media Samples Organization

`media/samples/` is used for generated artifacts and experiments:

- `media/samples/characters/`: reference sheets used by dashboards
- `media/samples/illustrate*/`, `media/samples/scene_director/`, `media/samples/create-tag-icons/`: generated experiment outputs
- `media/samples/prototypes/`: non-core viewer prototypes
- `media/samples/reports/`: ad hoc report outputs

Generated dashboard data files live in `media/dashboards/`:

- `media/dashboards/results.json`
- `media/dashboards/validation-*.json`

To audit overlap between dashboard and sample roots:

```bash
./scripts/check-media-overlap.sh --allow-diff
```

One-time archive import:

```bash
uv run python scripts/fetch_ai16z_channel.py --out ai16z.json
```

## Local Cron Setup (Cron Job show)

Set up a cron job to automatically record new episodes:

```bash
# Edit crontab
crontab -e

# Sunday 02:15 UTC = Saturday 9:15pm EST / 6:15pm PST
# Note: '0' = Sunday in cron (UTC). This is Saturday night in US timezones.
15 2 * * 0 cd /path/to/ai-news-website && ./scripts/run_pipeline.sh >> logs/pipeline.log 2>&1
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
- Success: Episode recorded successfully
- Failure: Recording failed (API error or recorder error)
- Skip: Episode already recorded

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
# OpenRouter (for LLM-based features: clips, trailers, poster generation)
OPENROUTER_API_KEY=sk-or-...

# Bunny CDN (for asset hosting)
BUNNY_STORAGE_ZONE=your_zone
BUNNY_STORAGE_PASSWORD=your_password
BUNNY_CDN_URL=https://cdn.elizaos.news

# Website repo path (for publish_m3tv.py step 8)
WEBSITE_REPO=/path/to/M3-org/website

# Knowledge repo path (for poster generation)
KNOWLEDGE_ROOT=/path/to/elizaOS/knowledge

# YouTube (run setup_youtube_auth.py first)
# Credentials stored in youtube_credentials.json
```

## Directory Structure

```
ai-news-website/
├── scripts/
│   ├── run_pipeline.sh             # Full Cron Job pipeline orchestrator
│   ├── recorder.cjs                 # Browser-based recorder
│   ├── youtube_metadata.py         # YouTube metadata generator
│   ├── youtube_upload.py           # YouTube uploader + privacy manager
│   ├── llm_producer.py             # LLM clip analysis + trailer generation
│   ├── generate_manifest.py        # Manifest generation
│   ├── cdn_upload.py               # CDN upload (consolidated, with retry)
│   ├── publish_m3tv.py             # Website publisher
│   ├── discord_notify.py           # Discord notifications
│   ├── posters/illustrate.py       # Poster generation from knowledge facts
│   └── generate-rss.py             # RSS feed generator
├── .github/workflows/
│   ├── generate-posters.yml        # Daily poster generation (11:00 UTC)
│   └── generate-illustrations.yml  # Manual poster generation
├── media/dashboards/               # Interactive data viewers (canonical)
│   ├── index.html                  # Central hub
│   ├── facts.html                  # Daily facts browser
│   ├── gallery.html                # Poster gallery
│   └── council.html                # Council notes viewer
├── media/samples/                  # Generated samples and experiments
│   ├── prototypes/                 # Experimental viewers
│   ├── reports/                    # Ad hoc report artifacts
│   └── illustrate*/ scene_director/ create-tag-icons/
├── episodes/                       # Recorded episodes & metadata
│   ├── clips/                      # Extracted clips
│   │   └── manifest.json           # Clip provenance & CDN URLs
│   ├── thumbnails/                 # Episode thumbnails
│   └── *.mp4, *_session-log.json
├── media/daily/                    # Generated posters (gitignored)
├── trailers/                       # Generated trailers (gitignored)
├── rss/                            # RSS feeds
│   ├── feed.xml                    # Daily facts feed
│   └── council.xml                 # Council notes feed
├── remotion/                       # Remotion project for trailer rendering
├── unity/                          # Archived Unity show (self-contained mini-site)
├── setup_youtube_auth.py           # YouTube auth setup
├── index.html                      # Website landing page (elizaos.news)
└── .env.example                    # Environment template
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
