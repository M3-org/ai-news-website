#!/bin/bash

# Server-side episode processing script
# This script runs on the VPS to process and upload episodes

set -euo pipefail

# Configuration
EPISODE_DATE="${1:-}"
EPISODES_PATH="/home/uploader/Episodes"
ARCHIVE_PATH="/home/uploader/archive"
WORK_DIR="/home/uploader/work"
REPO_DIR="/home/uploader/ai-news-website"

# Logging
LOG_FILE="/home/uploader/logs/process_episode.log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

cleanup() {
    log "Cleaning up work directory"
    rm -rf "$WORK_DIR"
}

trap cleanup EXIT

# Validate input
if [[ -z "$EPISODE_DATE" ]]; then
    log "ERROR: Episode date is required"
    exit 1
fi

if [[ ! "$EPISODE_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    log "ERROR: Invalid date format. Use YYYY-MM-DD"
    exit 1
fi

log "=== Processing episode $EPISODE_DATE ==="

# Check if episode exists
EPISODE_ZIP="$EPISODES_PATH/${EPISODE_DATE}.zip"
if [[ ! -f "$EPISODE_ZIP" ]]; then
    log "INFO: Episode $EPISODE_DATE not found at $EPISODE_ZIP"
    exit 0
fi

log "Found episode: $EPISODE_ZIP"

# Create work directory
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Extract episode
log "Extracting episode..."
unzip -q "$EPISODE_ZIP" -d extracted/

# Find episode directory
EPISODE_DIR=$(find extracted -type d -name "*${EPISODE_DATE}*" | head -1)
if [[ -z "$EPISODE_DIR" ]]; then
    log "ERROR: Episode directory not found in zip"
    exit 1
fi

log "Found episode directory: $EPISODE_DIR"

# Set up YouTube credentials from environment
export YOUTUBE_CLIENT_ID="${YOUTUBE_CLIENT_ID:-}"
export YOUTUBE_CLIENT_SECRET="${YOUTUBE_CLIENT_SECRET:-}"
export YOUTUBE_REFRESH_TOKEN="${YOUTUBE_REFRESH_TOKEN:-}"

# Process each language
for lang in ch ko en; do
    METADATA_FILE="$EPISODE_DIR/metadata/aipodcast_${EPISODE_DATE}_youtube_metadata_${lang}.json"
    
    if [[ ! -f "$METADATA_FILE" ]]; then
        log "WARNING: Metadata file not found for $lang: $METADATA_FILE"
        continue
    fi
    
    log "Processing $lang version..."
    
    # Fix JSON structure if needed
    python3 << EOF
import json
import sys

try:
    with open('$METADATA_FILE', 'r') as f:
        data = json.load(f)
    
    # Flatten structure if needed
    if 'episode_metadata' in data:
        data = data['episode_metadata']
    
    # Add playlist_id if missing
    if 'playlist_id' not in data:
        data['playlist_id'] = 'PLp5K4ceh2pR0hfdu4bUoNKCeqYm0n78Xx'
    
    # Ensure privacy is unlisted
    data['privacy_status'] = 'unlisted'
    
    with open('$METADATA_FILE', 'w') as f:
        json.dump(data, f, indent=2)
        
    print(f"Fixed metadata structure for $lang")
except Exception as e:
    print(f"Error processing metadata for $lang: {e}")
    sys.exit(1)
EOF

    # Upload to YouTube
    if cd "$REPO_DIR" && python3 upload_to_youtube.py --from-json "$METADATA_FILE"; then
        log "Successfully uploaded $lang version"
    else
        log "ERROR: Failed to upload $lang version"
        # Continue with other languages
    fi
    
    cd "$WORK_DIR"
done

# Update episodes.json
log "Updating episodes.json..."
if cd "$REPO_DIR" && python3 update_episodes_json.py --episode-date "$EPISODE_DATE"; then
    log "Successfully updated episodes.json"
else
    log "ERROR: Failed to update episodes.json"
fi

# Archive processed episode
log "Archiving episode..."
mkdir -p "$ARCHIVE_PATH"
if mv "$EPISODE_ZIP" "$ARCHIVE_PATH/"; then
    log "Successfully archived $EPISODE_DATE.zip"
else
    log "ERROR: Failed to archive episode"
fi

log "=== Episode $EPISODE_DATE processing completed ==="