# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **AI News Website** repository for the "Cron Job" AI news show hosted on [elizaos.news](https://elizaos.news). The pipeline records Shmotime episodes, generates trailers, uploads to YouTube/CDN, and updates the website.

## Repository Structure

### Pipeline Orchestrator
- **scripts/run_pipeline.sh**: Full end-to-end pipeline orchestrator — chains all steps with logging, error handling, `--dry-run`, `--from-step=N`, and Discord/desktop notifications. See `scripts/README.md` for details.

### Core Scripts
- **scripts/recorder.js**: Puppeteer-based episode recorder (captures video + session log with word-level timestamps)
- **scripts/youtube_metadata.py**: Generates YouTube metadata (title, description with chapters, tags) from session logs
- **scripts/youtube_upload.py**: Uploads video to YouTube with metadata, thumbnail, playlist; also `--visibility` to change listing status
- **scripts/llm_producer.py**: LLM-powered clip analysis and trailer config generation (subcommands: `clips`, `trailer`)
- **scripts/generate_manifest.py**: Generates media manifest with provenance for CDN uploads; `--metadata-json` to link YouTube URL
- **scripts/cdn_upload.py**: Bunny CDN uploader (single file, directory, stdin, or manifest-based)
- **scripts/publish_m3tv.py**: Updates M3TV website with new episode data (pipeline step 8); requires `WEBSITE_REPO` env var or `--website-repo`
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
- publish_youtube.py - Merged into `youtube_upload.py --visibility`

## Pipeline Flow

```
run_pipeline.sh step 1 (record) → youtube_metadata.py → youtube_upload.py
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

## Print Media Pipeline (Posters & Dashboards)

This repo is also the **media production layer** for elizaOS content. The knowledge repo provides data; this repo generates visual media from it.

### Knowledge Symlink
- `knowledge -> /home/jin/repo/knowledge` (symlink at repo root)
- Scripts read data from `knowledge/the-council/facts/`, `knowledge/the-council/council_briefing/`, etc.
- Set `KNOWLEDGE_ROOT` env var to override the symlink path

### Poster/Illustration Generation
- **scripts/posters/illustrate.py**: Main illustration pipeline - generates editorial posters from daily facts
- **scripts/posters/illustrate-adaptive.py**: LLM-first format-agnostic illustration pipeline
- **scripts/posters/scene_director.py**: Scene director pipeline for multi-image editorial narratives
- **scripts/posters/create-entity-icons.py**: Entity icon generation with CoinGecko integration
- **scripts/posters/create-tag-icons.py**: Tag icon generation
- **scripts/posters/validate-illustrations.py**: Vision-based illustration validation
- **scripts/posters/character-analyze.py**: Character reference sheet analysis
- **scripts/posters/character-reference.py**: Character reference sheet generation
- **scripts/posters/test-all-scripts.py**: Comprehensive test runner for all poster scripts
- **scripts/posters/config/**: Style presets and character configurations
- **scripts/posters/characters/**: Character reference sheets and assets (~94MB)
- **scripts/posters/assets/**: Fonts, logos, templates, entity icon inventory

### RSS & CDN
- **scripts/generate-rss.py**: RSS feed generation from knowledge data (facts + council briefings)
- **scripts/cdn/upload.py**: Bunny CDN uploader for media files
- **rss/**: Generated RSS feeds (feed.xml, council.xml, style.xsl)

### Dashboards & Viewers
- **dashboards/media-studio.html**: Hub page for all media tools
- **dashboards/facts.html** + **facts.css**: Facts data dashboard (API-driven)
- **dashboards/council.html** + **council.css**: Council briefing dashboard (API-driven)
- **dashboards/gallery.html**: Poster gallery viewer
- **dashboards/facts-viewer.html**: Magazine-style facts viewer with CDN images
- **dashboards/validation-viewer.html**: AI validation report viewer
- **dashboards/lib/data-loader.js**: Unified data loading library (fetches from knowledge API)
- **dashboards/lib/design-tokens.css**: Design system tokens

### Media Output
- **media/daily/**: Generated poster output organized by date (YYYY-MM-DD/)
- Generated posters stay in this repo, not pushed back to knowledge

### Path Resolution
Scripts use two root paths:
- `WORKSPACE_ROOT` = ai-news-website root (for output: media/, rss/)
- `KNOWLEDGE_ROOT` = knowledge repo (for input: the-council/, hackmd/, ai-news/)
- `SCRIPT_DIR` = scripts/posters/ (for assets: characters/, config/)

```bash
# Generate posters from facts
uv run python scripts/posters/illustrate.py -f knowledge/the-council/facts/2026-02-08.json --batch

# Generate RSS feeds
uv run python scripts/generate-rss.py

# Serve dashboards locally
python -m http.server 8080
# Browser: http://localhost:8080/dashboards/media-studio.html
```

## Development Notes

- Legacy content is preserved in `tmp/legacy/` (gitignored)
- The `unity/` directory preserves the old Unity version website as a self-contained mini-site
- YouTube upload infrastructure uses OAuth (local credentials via `setup_youtube_auth.py`)
- LLM steps (clip analysis, trailer generation) use OpenRouter API via `llm_producer.py`
- CDN uploads go to Bunny CDN
- Print media scripts use OpenRouter API via `OPENROUTER_API_KEY` env var
