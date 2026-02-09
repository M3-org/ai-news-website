# M3TV Weekly Publish — Architecture Reference

## Overview

After `scripts/run_pipeline.sh` finishes each week, Step 8 (`publish_m3tv.py`) automatically updates M3TV (`website/tv`) with the new Cron Job episode and deploys via git push to `M3-org/website`.

**Status:** Implemented and active. Old `update_website.py` has been archived to `tmp/legacy/`.

## Deployment Path

**git commit + git push** to `website/main` is the primary deployment path.

- `website` is deployed from `main` on GitHub Pages.
- Source-of-truth stays in git — rollback, auditability, reproducible deploys.
- FTP is optional fallback only, not the default.

## Architecture

- `website/tv/data/cronjob-episodes.json` — source of truth for Cron Job episode data.
- `website/tv/shows/cronjob.html` — fetches `../data/cronjob-episodes.json` at runtime.
- `website/tv/gallery.json` — gallery listing with Cron Job cards.

`scripts/publish_m3tv.py` upserts into both JSON files and commits/pushes.

## Data Format

### `tv/data/cronjob-episodes.json`

Date-keyed language entries:

```json
{
  "2026-02-02": {
    "en": {
      "id": "00v29Fv1D7Y",
      "title": "Cron Job S2E1: Workflow Revolution",
      "thumbnail": "https://i.ytimg.com/vi/00v29Fv1D7Y/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=00v29Fv1D7Y"
    }
  }
}
```

## Usage

```bash
# Requires WEBSITE_REPO env var or --website-repo flag
python3 scripts/publish_m3tv.py --episode-date=2026-02-02 --website-repo=/path/to/website --push

# Using env var (recommended for automation)
WEBSITE_REPO=/path/to/website python3 scripts/publish_m3tv.py --episode-date=2026-02-02 --push

# Dry run
python3 scripts/publish_m3tv.py --episode-date=2026-02-02 --dry-run
```

Flags:
- `--episode-date YYYY-MM-DD` (required)
- `--website-repo PATH` or `WEBSITE_REPO` env var (required)
- `--metadata-json <path>` — optional override for metadata file discovery
- `--push` — commit and push to website repo
- `--no-push` — override `--push` (useful for testing)
- `--dry-run` — preview changes without writing

## Pipeline Integration

`run_pipeline.sh` Step 8 calls:
```bash
python3 scripts/publish_m3tv.py --episode-date="$date_str" --push
```

The `WEBSITE_REPO` env var is loaded from `.env` by the pipeline.

## Idempotency Rules

- Re-running same date/video does not duplicate gallery entries.
- Re-running with unchanged data produces no commit.
- Script exits success with "no changes" message when idempotent.

## Failure Handling

- Missing or malformed metadata: fails Step 8 with explicit error.
- Missing `WEBSITE_REPO`: fails with actionable error message.
- Push failure: fails Step 8 and surfaces in pipeline notifications.
