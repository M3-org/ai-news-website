# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **AI News Website** repository for the "Cron Job" AI news show hosted on [elizaos.news](https://elizaos.news). The repository contains two automated pipelines:

1. **Cron Job Pipeline** - Weekly 3D animated news show (records Shmotime episodes → YouTube)
2. **Print Media Pipeline** - Daily social media posters from elizaOS/knowledge facts

## Common Commands

### Cron Job Pipeline
```bash
# Full end-to-end pipeline
./scripts/run_pipeline.sh

# Dry run (preview steps)
./scripts/run_pipeline.sh --dry-run

# Resume from specific step
./scripts/run_pipeline.sh --from-step=4

# Skip recording, use existing video
./scripts/run_pipeline.sh --skip-record
```

### Print Media / Posters
```bash
# Generate posters for a specific date
uv run python scripts/posters/illustrate.py --date 2026-02-08 --batch --with-icons

# Test all poster generation scripts
uv run python scripts/posters/test-all-scripts.py

# Validate generated illustrations with AI
uv run python scripts/posters/validate-illustrations.py

# Generate RSS feeds
uv run python scripts/generate-rss.py
```

### Remotion (Trailers)
```bash
# Generate trailer config from episode
uv run python scripts/llm_producer.py trailer episodes/*_session-log.json

# Open Remotion studio for preview/editing
cd remotion && npm start

# Render trailer to video
cd remotion && npx remotion render Trailer
```

### Local Development
```bash
# Serve dashboards locally
python -m http.server 8080
# Then visit: http://localhost:8080/media/dashboards/

# Install dependencies
npm install                              # Node/Puppeteer deps
pip install -r requirements.txt          # Python deps (if requirements.txt exists)
uv sync                                  # Or use uv for Python deps
cd remotion && npm install               # Remotion deps
```

## Tool Chain

This project uses multiple runtime environments:

- **`node` / `npm`**: JavaScript scripts (recorder.js) and Remotion
- **`uv run python`**: Python scripts via uv package manager (preferred for posters)
- **`python3`**: Direct Python invocation (acceptable, but uv is preferred)
- **`./scripts/run_pipeline.sh`**: Bash orchestrator for Cron Job pipeline

**When writing Python scripts:** Use `uv run python` for consistency with existing tooling and hooks.

## Environment Setup

### Required Configuration Files

1. **`.env`** - Copy from `.env.example` and configure:
   ```bash
   OPENROUTER_API_KEY=sk-or-...          # Required for LLM features
   BUNNY_STORAGE_ZONE=...                # Required for CDN uploads
   BUNNY_STORAGE_PASSWORD=...            # Required for CDN uploads
   BUNNY_CDN_URL=https://cdn.elizaos.news
   WEBSITE_REPO=/path/to/M3-org/website  # Required for publish.py --target=m3tv
   PUBLISH_TARGETS="m3tv ftp"            # Space-separated targets (m3tv, ftp, or both)
   KNOWLEDGE_ROOT=/path/to/knowledge     # Override for knowledge symlink
   ALERT_WEBHOOK_URL=...                 # Optional Discord alerts
   # FTP_HOST, FTP_USER, FTP_PASSWORD    # For --target=ftp publishing
   ```

2. **YouTube OAuth** (for video uploads):
   ```bash
   python3 setup_youtube_auth.py
   ```
   Generates `youtube_credentials.json` from `client_secrets.json`

3. **Knowledge Symlink** (for poster generation):
   ```bash
   ln -s /path/to/elizaOS/knowledge knowledge
   ```
   Or set `KNOWLEDGE_ROOT` environment variable

### Key File Locations

- **Configuration**: `.env`, `youtube_credentials.json`, `client_secrets.json`
- **Documentation**: `scripts/README.md` (full pipeline reference), `scripts/posters/README.md` (poster system)
- **Outputs**: `episodes/` (recordings), `trailers/` (rendered trailers), `media/daily/` (posters), `logs/` (pipeline logs)
- **Dashboards**: `media/dashboards/` (canonical location for all viewer UIs)
- **Assets**: `scripts/posters/assets/` (fonts, logos, templates), `scripts/posters/characters/` (character reference sheets)

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
- **scripts/publish.py**: Unified publisher for episode data (pipeline step 8); supports `--target=m3tv` (git) or `--target=ftp` (direct server upload)
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
- update_website.py - Replaced by `publish.py`
- publish_m3tv.py - Replaced by `publish.py` (git-only → unified git/FTP backends)
- publish_youtube.py - Merged into `youtube_upload.py --visibility`

## Pipeline Flow

```
run_pipeline.sh step 1 (record) → youtube_metadata.py → youtube_upload.py
                                → llm_producer.py clips → generate_manifest.py → cdn_upload.py
                                → llm_producer.py trailer → Remotion render → cdn_upload.py
                                → publish.py → Discord/desktop notification
```

All steps are chained by `scripts/run_pipeline.sh`. See `scripts/README.md` for the full pipeline diagram and script reference.

## Automation

### Local Cron (Cron Job Pipeline)

The Cron Job episode pipeline runs locally via cron:

```crontab
15 2 * * 0 cd /path/to/ai-news-website && ./scripts/run_pipeline.sh >> logs/pipeline.log 2>&1
```

**Timing:** Runs every Sunday at 02:15 UTC (Saturday 9:15pm EST), 15 minutes after Shmotime video should be ready.

### GitHub Actions (Print Media Pipeline)

Two workflows auto-generate posters:

1. **Daily workflow** (`.github/workflows/generate-posters.yml`)
   - Runs at 11:00 UTC daily (30 min after knowledge repo updates)
   - Generates illustrations with `--batch --with-icons`
   - Uploads to Bunny CDN (if secrets configured)
   - Auto-commits to `media/daily/` and `rss/`

2. **Manual workflow** (`.github/workflows/generate-illustrations.yml`)
   - Trigger from Actions tab with custom options
   - Configurable date, icons, CDN upload, dry-run

**Required GitHub Secrets:**
- `OPENROUTER_API_KEY` (required for image generation)
- `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_PASSWORD`, `BUNNY_CDN_URL` (optional, for CDN upload)

## Architecture Overview

### Data Flow
```
┌─────────────────────────────────────────────────────────────┐
│ CRON JOB PIPELINE (Weekly)                                   │
│ Shmotime API → recorder.js → episodes/*.mp4                  │
│              → youtube_upload.py → YouTube                   │
│              → llm_producer.py → trailers/                   │
│              → publish.py → M3-org/website or FTP            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PRINT MEDIA PIPELINE (Daily)                                 │
│ knowledge/facts/ → illustrate.py → media/daily/              │
│                  → cdn/upload.py → Bunny CDN                 │
│                  → generate-rss.py → rss/feed.xml            │
└─────────────────────────────────────────────────────────────┘
```

### Key Integration Points
- **knowledge symlink**: `knowledge -> /home/jin/repo/knowledge` (input for poster generation)
- **WEBSITE_REPO env var**: Path to M3-org/website (output for episode data)
- **Bunny CDN**: Shared hosting for both trailers and posters
- **OpenRouter API**: Powers LLM analysis (clips, trailers) and image generation (posters)

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

## Testing & Validation

### Poster Generation Testing
```bash
# Run comprehensive test suite for all poster scripts
uv run python scripts/posters/test-all-scripts.py

# Run tests for specific date
uv run python scripts/posters/test-all-scripts.py -d 2026-02-08

# Regenerate HTML gallery without running tests
uv run python scripts/posters/test-all-scripts.py --html-only

# View test results
python -m http.server 8080
# Visit: http://localhost:8080/media/dashboards/gallery.html
```

**Test outputs:**
- `media/dashboards/results.json` - Test results with commands and status
- `media/dashboards/gallery.html` - Visual comparison dashboard
- `media/samples/illustrate*/` - Generated test images

### AI-Powered Validation
```bash
# Validate illustrations from multiple reader perspectives
uv run python scripts/posters/validate-illustrations.py

# Validate specific test folder
uv run python scripts/posters/validate-illustrations.py --test style-editorial

# View validation reports
# Visit: http://localhost:8080/media/dashboards/validation-viewer.html
```

**Validation perspectives:**
- Casual Scroller (2-second attention span)
- Community Member (daily follower)
- Developer (technical substance seeker)
- First-Time Visitor (ElizaOS newcomer)

### Dashboard Viewers

All dashboards are in `media/dashboards/` (canonical location):
- **index.html** - Media studio hub
- **gallery.html** - Test output gallery
- **validation-viewer.html** - AI validation reports
- **facts-viewer.html** - Magazine-style daily briefing viewer
- **facts.html** - Facts data dashboard (API-driven)
- **council.html** - Council briefing dashboard (API-driven)

Legacy redirects from `/dashboards/*.html` → `media/dashboards/*.html` are maintained for backwards compatibility.

## Important Patterns & Conventions

### File Naming
- Episodes: `{date}_{show}_{title}.mp4`, `{date}_{show}_{title}_session-log.json`
- Posters: `media/daily/{YYYY-MM-DD}/{category}.png` (e.g., `overall.png`, `github-updates.png`)
- Trailers: `trailers/{date}_{show}_{title}_trailer-config.json`, `{date}_trailer.mp4`

### Data Flow Conventions
- **Session logs** (`_session-log.json`): Word-level timestamps, scene/dialogue structure - source of truth for episode content
- **Manifests** (`manifest.json`): Track file provenance, CDN URLs, generation metadata
- **Metadata JSON** (`_youtube_metadata.json`): YouTube upload parameters, updated with video_id after upload
- **Pipeline state** (`_pipeline_state.json`): Track progress across pipeline steps

### CDN Upload Pattern
Scripts generate local files → `generate_manifest.py` creates manifest → `cdn_upload.py --manifest` uploads & updates manifest with URLs

### Character Reference System
Characters in `scripts/posters/characters/{name}/`:
- Source images: `*.png`
- Analysis: `manifest.json` (pose, expression, costume metadata)
- Reference sheets: `reference-sheet-{name}.png` (canonical), `reference-sheet-{theme}.png` (variations)
- Used by illustration scripts via character name reference

### Organic Variation (Posters)
Batch poster generation uses date-seeded variation for unique daily output:
- **Lens** (7 options): emotion, journey, conflict, contrast, spotlight, snapshot, ecosystem
- **Composition** (6 options): bird's eye, silhouette, close-up, wide angle, dutch angle, over-shoulder
- **Mood** (16 options): seasonal (4) + holidays (12) with special character costumes on Halloween/Christmas
- Total combinations: 672 unique creative briefs

## Development Notes

- Legacy content is preserved in `tmp/legacy/` (gitignored)
- The `unity/` directory preserves the old Unity version website as a self-contained mini-site
- YouTube upload infrastructure uses OAuth (local credentials via `setup_youtube_auth.py`)
- LLM steps (clip analysis, trailer generation) use OpenRouter API via `llm_producer.py`
- CDN uploads go to Bunny CDN
- Print media scripts use OpenRouter API via `OPENROUTER_API_KEY` env var
- **Hook configuration**: Git hooks and other automations expect `uv run python` for Python scripts
- **Media samples**: Test outputs and experiments go in `media/samples/`, not committed to git
- **Generated content**: `media/daily/`, `trailers/`, and `episodes/` are gitignored
- **Dry-run pattern**: Most scripts support `--dry-run` flag for safe testing
- **Date handling**: Use `YYYY-MM-DD` format consistently across all scripts

## Quick Reference

### Most Common Tasks

**Record new episode:**
```bash
./scripts/run_pipeline.sh
```

**Generate today's posters:**
```bash
uv run python scripts/posters/illustrate.py --date $(date +%Y-%m-%d) --batch --with-icons
```

**Test poster generation:**
```bash
uv run python scripts/posters/test-all-scripts.py
python -m http.server 8080  # View at /media/dashboards/gallery.html
```

**Update website with new episode:**
```bash
# Publish via git (default)
uv run python scripts/publish.py --episode-date 2026-02-08 --target=m3tv --push

# Or publish via FTP
uv run python scripts/publish.py --episode-date 2026-02-08 --target=ftp
```

**Change YouTube video privacy:**
```bash
uv run python scripts/youtube_upload.py --visibility public --video VIDEO_ID
```

### Debugging Tips

- **Pipeline logs**: Check `logs/pipeline_{date}.log` for full execution trace
- **Dry-run first**: Use `--dry-run` flags to preview operations without side effects
- **Test scripts individually**: Run pipeline steps manually to isolate issues (see `scripts/README.md`)
- **Check .env**: Many errors stem from missing/incorrect environment variables
- **Validate manifests**: Use `scripts/posters/validate-entity-icons.py` to check icon inventory integrity
- **Vision analysis**: Use `scripts/posters/utils/vision.py` to debug image issues with AI analysis
