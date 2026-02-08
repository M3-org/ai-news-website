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
                   Step 1 │  record_cronjob   │  Record episode via Puppeteer
                          │  recorder.js      │
                          └────────┬─────────┘
                                   │
                          episodes/{date}_{show}_{title}.mp4
                          episodes/{date}_{show}_{title}_session-log.json
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                  │
        ┌────────▼───────┐ ┌──────▼───────┐ ┌───────▼──────┐
 Step 2 │  generate_yt   │ │ analyze_clips│ │ generate_    │  Steps 2, 4, 5
        │  _metadata.py  │ │ .py (LLM)    │ │ trailer.py   │  (can overlap)
        └────────┬───────┘ └──────┬───────┘ └───────┬──────┘
                 │                │                  │
        ┌────────▼───────┐       │         ┌───────▼──────┐
 Step 3 │ upload_to_     │       │  Step 6 │ Remotion     │
        │ youtube.py     │       │         │ render       │
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

### `record_cronjob.sh` — Episode Recorder

Fetches the latest episode URL from Shmotime API and records it using `recorder.js` (Puppeteer + puppeteer-stream).

```bash
./scripts/record_cronjob.sh              # Record latest episode
./scripts/record_cronjob.sh --dry-run    # Show what would be recorded
```

**Inputs:** Shmotime API (show ID 5296)
**Outputs:**
- `episodes/{date}_{show}_{title}.mp4` — Full episode video
- `episodes/{date}_{show}_{title}_session-log.json` — Structured episode data with word-level timestamps

**Dependencies:** Node.js, `puppeteer-stream`

---

### `recorder.js` — Puppeteer Recorder

Low-level recorder that captures video from a Shmotime episode URL. Called by `record_cronjob.sh`.

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

### `generate_youtube_metadata.py` — YouTube Metadata Generator

Creates YouTube upload metadata (title, description with chapters, tags, thumbnail) from a session log.

```bash
python3 scripts/generate_youtube_metadata.py episodes/*_session-log.json
python3 scripts/generate_youtube_metadata.py episodes/*_session-log.json \
    --playlist-id PLxxxx --privacy public --download-thumb
```

**Inputs:** `_session-log.json`
**Outputs:** `_youtube_metadata.json` (compatible with `upload_to_youtube.py --from-json`)

---

### `upload_to_youtube.py` — YouTube Uploader

Uploads video to YouTube with metadata, thumbnail, and optional playlist placement.

```bash
# From metadata JSON (preferred)
python3 upload_to_youtube.py --from-json episodes/*_youtube_metadata.json

# From session log (generates metadata on-the-fly)
python3 upload_to_youtube.py --from-session-log episodes/*_session-log.json

# Direct arguments
python3 upload_to_youtube.py --video-file ep.mp4 --title "Episode" --privacy public
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

### `analyze_clips.py` — LLM Clip Analyzer

Uses OpenRouter + Kimi K2.5 to identify clip-worthy moments from episode session logs.

```bash
python3 scripts/analyze_clips.py episodes/*_session-log.json
python3 scripts/analyze_clips.py episodes/*_session-log.json --extract  # Also extract clips via ffmpeg
python3 scripts/analyze_clips.py episodes/*_session-log.json --dry-run
```

**Inputs:** `_session-log.json`
**Outputs:**
- `_suggestions.json` — Clip suggestions with timing
- `clips/*.mp4` — Extracted clips (with `--extract`)

**Dependencies:** `requests`, OpenRouter API key, `ffmpeg` (for extraction)

---

### `generate_trailer.py` — Trailer Config Generator

Uses LLM to select punchy 1-3 second moments for a "Coming up on Cron Job..." trailer.

```bash
python3 scripts/generate_trailer.py episodes/*_session-log.json
python3 scripts/generate_trailer.py episodes/*_session-log.json --manual  # Interactive mode
python3 scripts/generate_trailer.py episodes/*_session-log.json --dry-run
```

**Inputs:** `_session-log.json`
**Outputs:** `trailers/{date}_{show}_{title}_trailer-config.json` (Remotion props)
**Dependencies:** `requests`, OpenRouter API key

---

### `generate_manifest.py` — Media Manifest Generator

Scans a directory for media files and creates `manifest.json` with provenance metadata. Used as input for CDN uploads.

```bash
python3 scripts/generate_manifest.py episodes/clips/ --show cronjob
python3 scripts/generate_manifest.py episodes/clips/ --show cronjob \
    --session-log episodes/*_session-log.json
```

**Inputs:** Directory of media files, optional session log
**Outputs:** `manifest.json` in the scanned directory

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

### `update_website.py` — Website Updater *(Legacy)*

> **Deprecated:** Replaced by `publish_m3tv.py` in the pipeline (step 8). Kept for reference until the new publisher has run 2+ cycles.

Updates `unity/episodes.json` with YouTube video info and optionally commits/pushes.

```bash
python3 scripts/update_website.py --episode-date=2026-02-02
python3 scripts/update_website.py --episode-date=2026-02-02 --push
```

**Inputs:** Episode metadata files in `Episodes/{date}/metadata/`
**Outputs:** Updated `unity/episodes.json`

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values.

| Variable | Required By | Description |
|----------|-------------|-------------|
| `OPENROUTER_API_KEY` | analyze_clips, generate_trailer | OpenRouter API key for LLM analysis |
| `ALERT_WEBHOOK_URL` | run_pipeline, record_cronjob | Discord webhook URL for notifications |
| `BUNNY_STORAGE_ZONE` | cdn_upload | Bunny CDN storage zone name |
| `BUNNY_STORAGE_PASSWORD` | cdn_upload | Bunny CDN API password |
| `BUNNY_CDN_URL` | cdn_upload | CDN base URL (e.g., `https://cdn.elizaos.news`) |
| `BUNNY_STORAGE_HOST` | cdn_upload | Storage host region (default: LA) |
| `YOUTUBE_PLAYLIST_ID` | upload_to_youtube | Playlist to add uploaded videos to |

YouTube OAuth credentials (`client_secrets.json`, `youtube_credentials.json`) are managed separately via `setup_youtube_auth.py`.

## Directory Structure

```
ai-news-website/
├── scripts/
│   ├── run_pipeline.sh          # Full orchestrator
│   ├── record_cronjob.sh        # Episode recording
│   ├── recorder.js              # Puppeteer recorder
│   ├── generate_youtube_metadata.py
│   ├── analyze_clips.py
│   ├── generate_trailer.py
│   ├── generate_manifest.py
│   ├── cdn_upload.py
│   ├── publish_m3tv.py          # Website publisher (step 8)
│   └── update_website.py        # Legacy website updater
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
├── upload_to_youtube.py
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
