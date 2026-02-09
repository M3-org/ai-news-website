# Scripts — Cron Job Episode Pipeline

End-to-end pipeline for recording Shmotime episodes, generating trailers, uploading to YouTube/CDN, and updating the website.

## Pipeline Overview

```
                          ┌──────────────────┐
                          │  Shmotime API     │
                          │  (episode URL)    │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                   Step 1 │  run_pipeline.sh  │  Record episode via Puppeteer
                          │  recorder.js      │
                          └────────┬─────────┘
                                   │
                          episodes/{date}_{show}_{title}.mp4
                          episodes/{date}_{show}_{title}_session-log.json
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                  │
        ┌────────▼───────┐ ┌──────▼───────┐ ┌───────▼──────┐
 Step 2 │  youtube_      │ │ llm_producer │ │ llm_producer │  Steps 2, 4, 5
        │  metadata.py   │ │ .py clips    │ │ .py trailer  │  (can overlap)
        └────────┬───────┘ └──────┬───────┘ └───────┬──────┘
                 │                │                  │
        ┌────────▼───────┐       │         ┌───────▼──────┐
 Step 3 │ youtube_       │       │  Step 6 │ Remotion     │
        │ upload.py      │       │         │ render       │
        └────────┬───────┘       │         └───────┬──────┘
                 │                │                  │
         YouTube URL      clips/ dir        trailers/{date}_trailer.mp4
                 │                │                  │
                 │         ┌──────▼───────┐          │
                 │  Step 7 │ generate_    │          │
                 │         │ manifest.py  │          │
                 │         └──────┬───────┘          │
                 │                │                  │
                 │         ┌──────▼───────┐          │
                 │  Step 7 │ cdn_upload   │◄─────────┘
                 │         │ .py          │
                 │         └──────┬───────┘
                 │                │
                 │           CDN URLs
                 │                │
                 └───────┬────────┘
                         │
                ┌────────▼───────┐
         Step 8 │ publish_m3tv   │
                │ .py            │
                └────────┬───────┘
                         │
                ┌────────▼───────┐
         Step 9 │ Notify         │
                │ Discord + OS   │
                └────────────────┘
```

## Scripts Reference

### `run_pipeline.sh` — Full Orchestrator

Chains all steps into a single invocation with logging, error handling, and notifications.

```bash
# Full pipeline
./scripts/run_pipeline.sh

# Preview without executing
./scripts/run_pipeline.sh --dry-run

# Resume from step 4 (skip recording + metadata)
./scripts/run_pipeline.sh --from-step=4

# Skip recording (use existing video)
./scripts/run_pipeline.sh --skip-record
```

**Flags:**
| Flag | Description |
|------|-------------|
| `--dry-run` | Print each step without executing |
| `--from-step=N` | Resume from step N (1-9) |
| `--skip-record` | Skip recording, use latest existing episode |
| `--date=YYYY-MM-DD` | Override episode date (default: auto-detect) |

**Outputs:** `logs/pipeline_{date}.log`

---

### `recorder.js` — Puppeteer Recorder

Low-level recorder that captures video from a Shmotime episode URL. Called by `run_pipeline.sh` step 1.

```bash
node scripts/recorder.js \
    --date=2026-02-02 \
    --show=Cron-Job \
    --output=episodes \
    --stop-recording-at=end_postcredits \
    "https://shmotime.com/episode/..."
```

**Inputs:** Episode URL, CLI flags
**Outputs:** `.mp4` video + `_session-log.json`
**Dependencies:** Node.js, `puppeteer-stream`, GPU-capable display

---

### `youtube_metadata.py` — YouTube Metadata Generator

Creates YouTube upload metadata (title, description with chapters, tags, thumbnail) from a session log.

```bash
python3 scripts/youtube_metadata.py episodes/*_session-log.json
python3 scripts/youtube_metadata.py episodes/*_session-log.json \
    --playlist-id PLxxxx --privacy public --download-thumb
```

**Inputs:** `_session-log.json`
**Outputs:** `_youtube_metadata.json` (compatible with `youtube_upload.py --from-json`)

---

### `youtube_upload.py` — YouTube Uploader & Privacy Manager

Uploads video to YouTube with metadata, thumbnail, and optional playlist placement. Also supports changing an existing video's privacy/listing status.

```bash
# From metadata JSON (preferred)
python3 scripts/youtube_upload.py --from-json episodes/*_youtube_metadata.json

# From session log (generates metadata on-the-fly)
python3 scripts/youtube_upload.py --from-session-log episodes/*_session-log.json

# Direct arguments
python3 scripts/youtube_upload.py --video-file ep.mp4 --title "Episode" --privacy-status public

# Change listing status of an existing video (e.g. unlisted -> public)
python3 scripts/youtube_upload.py --visibility public --video dQw4w9WgXcQ
python3 scripts/youtube_upload.py --visibility public --video "https://youtube.com/watch?v=dQw4w9WgXcQ"
python3 scripts/youtube_upload.py --visibility public --from-state episodes/2026-02-08_pipeline_state.json
```

**Inputs:** Video file + metadata (JSON, session-log, or CLI args)
**Outputs:** Writes `video_id` and `url` back to metadata JSON on success
**Dependencies:** `google-api-python-client`, `google-auth-oauthlib`

---

### `setup_youtube_auth.py` — YouTube OAuth Setup

One-time interactive setup to generate OAuth credentials for YouTube uploads.

```bash
python3 setup_youtube_auth.py
```

**Inputs:** `client_secrets.json` (from Google Cloud Console)
**Outputs:** `youtube_credentials.json`

---

### `llm_producer.py` — LLM Clip Analysis & Trailer Generator

Uses OpenRouter LLMs to analyze episode session logs. Two subcommands:

#### `clips` — Identify clip-worthy moments

```bash
python3 scripts/llm_producer.py clips episodes/*_session-log.json
python3 scripts/llm_producer.py clips episodes/*_session-log.json --extract  # Also extract via ffmpeg
python3 scripts/llm_producer.py clips episodes/*_session-log.json --dry-run
```

**Inputs:** `_session-log.json`
**Outputs:**
- `_suggestions.json` — Clip suggestions with timing
- `clips/*.mp4` — Extracted clips (with `--extract`)

#### `trailer` — Generate trailer configs for Remotion

```bash
python3 scripts/llm_producer.py trailer episodes/*_session-log.json
python3 scripts/llm_producer.py trailer episodes/*_session-log.json --manual  # Interactive mode
python3 scripts/llm_producer.py trailer episodes/*_session-log.json --dry-run
```

**Inputs:** `_session-log.json`
**Outputs:** `trailers/{date}_{show}_{title}_trailer-config.json` (Remotion props)

**Dependencies:** `requests`, OpenRouter API key, `ffmpeg` (for clip extraction)

---

### `generate_manifest.py` — Media Manifest Generator

Scans a directory for media files and creates `manifest.json` with provenance metadata. Used as input for CDN uploads. Optionally links the YouTube full-video URL into the manifest via `--metadata-json`.

```bash
python3 scripts/generate_manifest.py episodes/clips/ --show cronjob

# With session log for enriched provenance
python3 scripts/generate_manifest.py episodes/clips/ --show cronjob \
    --session-log episodes/*_session-log.json

# Include YouTube URL from metadata JSON
python3 scripts/generate_manifest.py episodes/clips/ --show cronjob \
    --metadata-json episodes/*_youtube_metadata.json
```

**Inputs:** Directory of media files, optional session log, optional YouTube metadata JSON
**Outputs:** `manifest.json` in the scanned directory (includes `youtube_url` in `source` when `--metadata-json` provided)

---

### `cdn_upload.py` — Bunny CDN Uploader

Uploads files to Bunny CDN. Supports single files, directories, stdin, and manifest-based uploads.

```bash
# Upload from manifest (updates manifest with CDN URLs)
python3 scripts/cdn_upload.py --manifest episodes/clips/manifest.json --remote cronjob/clips/

# Upload single file
python3 scripts/cdn_upload.py trailers/trailer.mp4 --remote cronjob/trailers/

# Upload directory
python3 scripts/cdn_upload.py --dir episodes/clips/ --remote cronjob/clips/

# JSON output for scripting
python3 scripts/cdn_upload.py file.mp4 --remote path/ --json
```

**Inputs:** Files (single, directory, stdin, or manifest)
**Outputs:** CDN URLs; updates `manifest.json` with URLs when using `--manifest`
**Dependencies:** Bunny CDN credentials (see `.env.example`)

---

### `discord_notify.py` — Discord Notification Bot

Sends rich Discord notifications after pipeline completion, with optional publish button.

---

### `publish_m3tv.py` — Website Publisher (Step 8)

Updates the M3TV website (`m3org.com/tv`) with new episode data. Upserts into `cronjob-episodes.json` and `gallery.json`, then commits and pushes.

```bash
# Requires --website-repo or WEBSITE_REPO env var
python3 scripts/publish_m3tv.py --episode-date=2026-02-02 --website-repo=/path/to/website --push

# Using env var (recommended for automation)
WEBSITE_REPO=/path/to/website python3 scripts/publish_m3tv.py --episode-date=2026-02-02 --push

# Preview changes without writing
python3 scripts/publish_m3tv.py --episode-date=2026-02-02 --website-repo=/path/to/website --dry-run
```

**Inputs:** Episode date, website repo path (via `--website-repo` or `WEBSITE_REPO` env var), optional `--metadata-json` override
**Outputs:** Updated `tv/data/cronjob-episodes.json` and `tv/gallery.json` in the website repo

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values.

| Variable | Required By | Description |
|----------|-------------|-------------|
| `OPENROUTER_API_KEY` | llm_producer.py | OpenRouter API key for LLM analysis |
| `ALERT_WEBHOOK_URL` | run_pipeline | Discord webhook URL for notifications |
| `BUNNY_STORAGE_ZONE` | cdn_upload | Bunny CDN storage zone name |
| `BUNNY_STORAGE_PASSWORD` | cdn_upload | Bunny CDN API password |
| `BUNNY_CDN_URL` | cdn_upload | CDN base URL (e.g., `https://cdn.elizaos.news`) |
| `BUNNY_STORAGE_HOST` | cdn_upload | Storage host region (default: LA) |
| `YOUTUBE_PLAYLIST_ID` | youtube_upload | Playlist to add uploaded videos to |
| `WEBSITE_REPO` | publish_m3tv | Path to the M3-org/website repo checkout |

YouTube OAuth credentials (`client_secrets.json`, `youtube_credentials.json`) are managed separately via `setup_youtube_auth.py`.

## Directory Structure

```
ai-news-website/
├── scripts/
│   ├── run_pipeline.sh          # Full orchestrator
│   ├── recorder.js              # Puppeteer recorder
│   ├── youtube_metadata.py       # YouTube metadata generator
│   ├── youtube_upload.py        # YouTube uploader + privacy manager
│   ├── llm_producer.py          # LLM clip analysis + trailer generation
│   ├── generate_manifest.py
│   ├── cdn_upload.py
│   ├── publish_m3tv.py          # Website publisher (step 8)
│   └── discord_notify.py        # Discord notifications
├── unity/                       # Archived Unity show mini-site
│   ├── index.html
│   ├── episodes.json
│   └── ai16z.json
├── episodes/                    # Recorded episodes (gitignored)
│   ├── {date}_{show}_{title}.mp4
│   ├── {date}_{show}_{title}_session-log.json
│   ├── {date}_{show}_{title}_youtube_metadata.json
│   ├── {date}_{show}_{title}_suggestions.json
│   ├── clips/                   # Extracted clips
│   │   └── manifest.json
│   └── thumbnails/
├── trailers/                    # Generated trailers (gitignored)
│   ├── {date}_{show}_{title}_trailer-config.json
│   └── {date}_trailer.mp4
├── logs/                        # Pipeline logs (gitignored)
│   └── pipeline_{date}.log
├── remotion/                    # Remotion project for trailer rendering
├── setup_youtube_auth.py
├── .env                         # Local credentials (gitignored)
└── .env.example
```

## Automation

### Crontab (recommended)

Record and process every Sunday at 2:15 AM UTC (Saturday 9:15 PM EST):

```crontab
15 2 * * 0 cd /path/to/ai-news-website && ./scripts/run_pipeline.sh >> logs/pipeline.log 2>&1
```

### tmux alternative

For long-running sessions where you want to monitor progress:

```bash
tmux new-session -d -s pipeline './scripts/run_pipeline.sh'
tmux attach -t pipeline  # Reattach to watch
```

### Manual run

```bash
# Full pipeline
./scripts/run_pipeline.sh

# Just record + upload (skip trailer/clips)
./scripts/run_pipeline.sh --from-step=1 --skip-clips --skip-trailer

# Reprocess existing recording
./scripts/run_pipeline.sh --skip-record --date=2026-02-02
```
