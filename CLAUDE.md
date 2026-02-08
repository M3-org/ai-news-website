# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **AI News Website** repository for the "Cron Job" AI news show hosted on [elizaos.news](https://elizaos.news). The pipeline records Shmotime episodes, generates trailers, uploads to YouTube/CDN, and updates the website.

## Repository Structure

### Pipeline Orchestrator
- **scripts/run_pipeline.sh**: Full end-to-end pipeline orchestrator — chains all steps with logging, error handling, `--dry-run`, `--from-step=N`, and Discord/desktop notifications. See `scripts/README.md` for details.

### Core Scripts
- **scripts/record_cronjob.sh**: Fetches latest episode from Shmotime API and records via `recorder.js`
- **scripts/recorder.js**: Puppeteer-based episode recorder (captures video + session log with word-level timestamps)
- **scripts/generate_youtube_metadata.py**: Generates YouTube metadata (title, description with chapters, tags) from session logs
- **upload_to_youtube.py**: Uploads video to YouTube with metadata, thumbnail, and playlist placement
- **setup_youtube_auth.py**: One-time YouTube OAuth credential setup
- **scripts/analyze_clips.py**: LLM-based clip analysis (OpenRouter + Kimi K2.5) with optional ffmpeg extraction
- **scripts/generate_trailer.py**: LLM-based trailer config generator for Remotion
- **scripts/generate_manifest.py**: Generates media manifest with provenance for CDN uploads
- **scripts/cdn_upload.py**: Bunny CDN uploader (single file, directory, stdin, or manifest-based)
- **scripts/update_website.py**: *(Legacy)* Updates `unity/episodes.json` — replaced by `scripts/publish_m3tv.py` in the pipeline

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

## Pipeline Flow

```
record_cronjob.sh → generate_youtube_metadata.py → upload_to_youtube.py
                  → analyze_clips.py → generate_manifest.py → cdn_upload.py
                  → generate_trailer.py → Remotion render → cdn_upload.py
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
- LLM steps (clip analysis, trailer generation) use OpenRouter API
- CDN uploads go to Bunny CDN
