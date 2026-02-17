# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **AI News Website** for [elizaos.news](https://elizaos.news) — a daily AI-generated intelligence briefing for the ElizaOS ecosystem, plus the "Cron Job" weekly animated news show pipeline.

## Website (Astro + React Islands)

The site is built with **Astro 5** (static output) and **React 18** islands for interactive components. Deployed to GitHub Pages via GitHub Actions.

### Architecture

```
src/
  layouts/
    BaseLayout.astro        # Shared <head>, footer (RSS, YouTube, GitHub, Discord, X, M3TV, Docs, HiScores, Unity)
    NewspaperLayout.astro    # Newspaper chrome (nav + main grid wrapper)
    DarkLayout.astro         # Dark theme base (council, gallery)
  pages/
    index.astro              # Homepage = latest daily briefing (fetches M3TV episodes at build time)
    daily/[date].astro       # /daily/2026-02-16 — SSG via getStaticPaths from knowledge data
    council/[date].astro     # /council/2026-02-16
    gallery.astro            # Poster gallery
  components/
    nav/SiteNav.astro        # Fixed nav: Home, Gallery | M3TV, Unity, RSS icon, theme toggle
    nav/DatePicker.tsx       # React island: prev/next + date input
    daily/                   # Masthead, LeadStory, KeyFacts, DailySidebar, CategoryBox,
                             # StrategyBox, CouncilSection, DevelopmentGrid, FullStories
    council/                 # MeetingContext.tsx, DailyFocus.tsx (collapsible React islands)
    common/                  # Badge, Card, CharacterAvatar
  lib/
    data-loader.ts           # Build-time data loading from knowledge/ directory (fs.readFileSync)
    types.ts                 # TypeScript interfaces for all JSON data shapes
    dates.ts                 # Date formatting utilities
  styles/
    newspaper.css            # Dual-theme styles (light .newspaper / dark .dark) via CSS variables (--np-*)
    global.css               # Reset, footer styles
```

### Key Patterns

- **Dual theme**: Light (`.newspaper`) and dark (`.dark`) via CSS variables (`--np-bg`, `--np-text`, `--np-link`, etc.). Theme toggle persists to localStorage. FOUC prevented by inline `<script>` in `<head>`.
- **Data at build time**: `src/lib/data-loader.ts` reads from `knowledge/` symlink (local) or sparse-checkout (CI). No client-side API calls for content.
- **React islands**: Only used where interactivity is needed — DatePicker, MeetingContext, DailyFocus. Everything else is Astro (zero JS).
- **Static assets**: `media/daily/`, `unity/`, `rss/` are symlinked into `public/` for local dev. CI copies them to `dist/` post-build.
- **Polymarket ticker**: Theme-aware (light/dark iframes toggled via CSS). Sits between masthead separator rules.
- **Latest Episodes**: Homepage fetches from `https://www.m3org.com/tv/data/cronjob-episodes.json` at build time.
- **Fonts**: Playfair Display (headlines), IBM Plex Serif (body), DM Sans (UI) via Google Fonts.

### Commands

```bash
npm run dev          # Astro dev server (port 4321)
npm run build        # Static build to dist/ (805+ pages)
npm run preview      # Preview built site
npm run sync         # Pull latest knowledge repo data
```

### Deploy (GitHub Actions)

`.github/workflows/deploy.yml` triggers on push to `main`:
1. Checkout repo + sparse-checkout `elizaOS/knowledge`
2. `npm ci && npm run build`
3. Copy static assets (`unity/`, `media/daily/`, `rss/`, `media/dashboards/*.json`) to `dist/`
4. Upload artifact → deploy to GitHub Pages

GitHub Pages source is set to **workflow** mode (not branch).

### Legacy (Deprecated)

Old HTML dashboards and root `index.html` moved to `tmp/legacy/dashboards/` (gitignored). The Astro build now serves all pages. Files kept locally for reference:
- `index.html` — old dark landing page
- `dashboards/*.html` — redirect shims
- `media/dashboards/*.html`, `*.css`, `lib/` — full dashboard pages replaced by Astro

## Pipeline Scripts

### Orchestrator
- **scripts/run_pipeline.sh**: Full end-to-end pipeline — chains all steps with logging, error handling, `--dry-run`, `--from-step=N`, and Discord/desktop notifications.

### Core Scripts
- **scripts/recorder.cjs**: Puppeteer-based episode recorder (`.cjs` because package.json has `"type": "module"`)
- **scripts/youtube_metadata.py**: YouTube metadata (title, chapters, tags) from session logs
- **scripts/youtube_upload.py**: Upload + `--visibility` to change listing status
- **scripts/llm_producer.py**: LLM clip analysis and trailer config (subcommands: `clips`, `trailer`)
- **scripts/generate_manifest.py**: Media manifest with provenance; `--metadata-json` to link YouTube URL
- **scripts/cdn_upload.py**: Bunny CDN uploader (single file, directory, stdin, or manifest-based)
- **scripts/publish_m3tv.py**: Updates M3TV website with episode data (step 8)
- **scripts/discord_notify.py**: Discord notification for pipeline completion

### Pipeline Flow

```
run_pipeline.sh step 1 (record) → youtube_metadata.py → youtube_upload.py
                                → llm_producer.py clips → generate_manifest.py → cdn_upload.py
                                → llm_producer.py trailer → Remotion render → cdn_upload.py
                                → publish_m3tv.py → Discord/desktop notification
```

### Automation

```crontab
15 2 * * 0 cd /path/to/ai-news-website && ./scripts/run_pipeline.sh >> logs/pipeline.log 2>&1
```

## Print Media Pipeline

### Knowledge Data
- `knowledge -> /home/jin/repo/knowledge` (symlink, gitignored)
- CI uses sparse-checkout of `elizaOS/knowledge`
- Set `KNOWLEDGE_ROOT` env var to override

### Poster Generation
- **scripts/posters/illustrate.py**: Main illustration pipeline from daily facts
- **scripts/posters/characters/**: Character reference sheets (~94MB)
- **scripts/posters/config/**: Style presets
- Output: `media/daily/YYYY-MM-DD/*.png`

### RSS
- **scripts/generate-rss.py**: Generates `rss/feed.xml` and `rss/council.xml`

### Other Assets
- **unity/**: Archived Unity show (self-contained mini-site, copied to dist)
- **remotion/**: React-based trailer rendering
- **media/dashboards/*.json**: Validation data used by poster scripts (kept in repo)

## Development Notes

- Use `uv run python` instead of `python3` (hook enforced)
- Legacy content preserved in `tmp/legacy/` (gitignored)
- YouTube OAuth via `setup_youtube_auth.py` → `youtube_credentials.json`
- LLM steps use OpenRouter API via `OPENROUTER_API_KEY`
- CDN uploads go to Bunny CDN
