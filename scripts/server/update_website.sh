#!/bin/bash

# Server-side website update script
# This script updates episodes.json and optionally index.html after episode processing

set -euo pipefail

# Configuration
EPISODE_DATE="${1:-}"
REPO_DIR="/home/uploader/ai-news-website"
LOG_FILE="/home/uploader/logs/update_website.log"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Validate input
if [[ -z "$EPISODE_DATE" ]]; then
    log "ERROR: Episode date is required"
    exit 1
fi

log "=== Updating website for episode $EPISODE_DATE ==="

# Change to repository directory
cd "$REPO_DIR"

# Update episodes.json and index.html
log "Updating website files..."
if python3 scripts/update_website.py --episode-date "$EPISODE_DATE" --update-index; then
    log "Successfully updated episodes.json and index.html"
else
    log "ERROR: Failed to update website files"
    exit 1
fi

# Optional: Generate any other website files
if [[ -f "scripts/generate_rss.py" ]]; then
    log "Generating RSS feed..."
    if python3 scripts/generate_rss.py; then
        log "Successfully generated RSS feed"
    else
        log "WARNING: Failed to generate RSS feed"
    fi
fi

log "=== Website update completed for episode $EPISODE_DATE ==="