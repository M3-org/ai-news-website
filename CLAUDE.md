# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **AI News Website** repository for hosting the AI news show. The repository is being upgraded to a new pipeline. Legacy Unity-based content has been moved to `tmp/legacy/`.

## Repository Structure

### Core Scripts (YouTube Upload Infrastructure)
- **upload_to_youtube.py**: Main YouTube upload script - handles video uploads with metadata
- **setup_youtube_auth.py**: YouTube OAuth authentication setup - run once to configure credentials
- **scripts/update_website.py**: Updates episodes.json for the website
- **scripts/local_daily_upload.sh**: Local workflow for manual episode uploads

### Website
- **index.html**: Current placeholder page (new pipeline coming soon)
- **unity.html**: Archived Unity version website

### Configuration
- **CNAME**: Domain configuration (elizaos.news)
- **.github/workflows/daily-upload.yml**: GitHub Actions workflow for automated uploads

### Legacy Content (in tmp/legacy/, gitignored)
The following have been moved to `tmp/legacy/` for the new pipeline:
- Episodes/ - Historical episode JSON files
- media/ - Visual assets
- facts/ - Curated news data
- docs/ - Unity system documentation
- episodes.json - Episode index

## Key Scripts

### upload_to_youtube.py
Main upload script that:
- Uploads videos to YouTube with metadata
- Handles authentication via OAuth
- Supports custom titles, descriptions, and thumbnails

### scripts/local_daily_upload.sh
Local workflow script for manual uploads when not using the automated pipeline.

### scripts/update_website.py
Updates the episodes.json index file for the website.

## GitHub Actions

The `daily-upload.yml` workflow SSHs to a remote VPS (`clanktank.tv`) and runs scripts there at `~/scripts/server/`. This repo contains a local reference copy but the active scripts run on the VPS.

## Development Notes

- Legacy content is preserved in `tmp/legacy/` (gitignored)
- The `unity.html` file preserves the old Unity version website
- New pipeline development is in progress
- YouTube upload infrastructure remains functional
