# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **AI News Website** repository for the "Cron Job" AI news show hosted on [elizaos.news](https://elizaos.news). The pipeline records Shmotime episodes, generates trailers, uploads to YouTube/CDN, and updates the website.

## Repository Structure

### Pipeline Orchestrator
- **scripts/run_pipeline.sh**: Full end-to-end pipeline orchestrator — chains all steps with logging, error handling, `--dry-run`, `--from-step=N`, and Discord/desktop notifications. See `scripts/README.md` for details.

### Core Scripts
- **scripts/recorder.js**: Puppeteer-based episode recorder (captures video + session log with word-level timestamps)
- **scripts/generate_youtube_metadata.py**: Generates YouTube metadata (title, description with chapters, tags) from session logs
- **scripts/upload_to_youtube.py**: Uploads video to YouTube with metadata, thumbnail, and playlist placement
- **scripts/publish_youtube.py**: Changes a YouTube video's privacy status (e.g. unlisted -> public)
- **scripts/llm_producer.py**: LLM-powered clip analysis and trailer config generation (subcommands: `clips`, `trailer`)
- **scripts/generate_manifest.py**: Generates media manifest with provenance for CDN uploads
- **scripts/cdn_upload.py**: Bunny CDN uploader (single file, directory, stdin, or manifest-based)
- **scripts/publish_m3tv.py**: Updates website with new episode data (pipeline step 8)
- **scripts/discord_notify.py**: Discord bot notification for pipeline completion
- **setup_youtube_auth.py**: One-time YouTube OAuth credential setup

### Website
- **index.html**: Current placeholder page
- **unity/**: Archived Unity show as a self-contained mini-site (`unity/index.html`, `unity/episodes.json`, `unity/ai16z.json`)

### Configuration
- **CNAME**: Domain configuration (elizaos.news)
- **.env.example**: Environment variable template
- **scripts/README.md**: Full pipeline documentation with script reference

### Remotion (Trailer Rendering)
- **remotion/**: React-based video rendering project for trailers (`npx remotion render`)

### Legacy Content (in tmp/legacy/, gitignored)
The following have been moved to `tmp/legacy/`:
- Episodes/ - Historical episode JSON files
- media/ - Visual assets
- facts/ - Curated news data
- docs/ - Unity system documentation
- record_cronjob.sh - Standalone recorder (duplicated in run_pipeline.sh step 1)
- analyze_clips.py - Replaced by `llm_producer.py clips`
- generate_trailer.py - Replaced by `llm_producer.py trailer`
- update_website.py - Replaced by `publish_m3tv.py`

## Pipeline Flow

```
run_pipeline.sh step 1 (record) → generate_youtube_metadata.py → upload_to_youtube.py
                                → llm_producer.py clips → generate_manifest.py → cdn_upload.py
                                → llm_producer.py trailer → Remotion render → cdn_upload.py
                                → publish_m3tv.py → Discord/desktop notification
```

All steps are chained by `scripts/run_pipeline.sh`. See `scripts/README.md` for the full pipeline diagram and script reference.

## Automation

The pipeline runs locally via cron (no VPS or GitHub Actions):

```crontab
15 2 * * 0 cd /path/to/ai-news-website && ./scripts/run_pipeline.sh >> logs/pipeline.log 2>&1
```

## Development Notes

- Legacy content is preserved in `tmp/legacy/` (gitignored)
- The `unity/` directory preserves the old Unity version website as a self-contained mini-site
- YouTube upload infrastructure uses OAuth (local credentials via `setup_youtube_auth.py`)
- LLM steps (clip analysis, trailer generation) use OpenRouter API via `llm_producer.py`
- CDN uploads go to Bunny CDN
