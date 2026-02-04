#!/bin/bash
#
# Record the latest Cron Job episode from Shmotime
#
# Fetches the latest episode URL from the Shmotime API and records it
# using recorder.js with proper naming conventions.
#
# Usage:
#   ./scripts/record_cronjob.sh              # Record latest episode
#   ./scripts/record_cronjob.sh --dry-run    # Show what would be recorded
#
# Crontab (Sunday 02:15 UTC = Saturday 9:15pm EST / 6:15pm PST):
#   15 2 * * 0 cd /path/to/ai-news-website && ./scripts/record_cronjob.sh >> logs/record.log 2>&1
#
# Environment:
#   ALERT_WEBHOOK_URL - Discord webhook URL for notifications (optional)
#

set -e

# Discord webhook for alerts (optional)
DISCORD_WEBHOOK="${ALERT_WEBHOOK_URL:-}"

send_alert() {
    local message="$1"
    if [[ -n "$DISCORD_WEBHOOK" ]]; then
        curl -s -X POST "$DISCORD_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"content\": \"$message\"}" > /dev/null 2>&1 || true
    fi
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Configuration
SHOW_ID="5296"  # Cron Job show ID
SHOW_NAME="Cron-Job"
API_URL="https://shmotime.com/wp-json/shmotime/v1/get-latest-episode?show_id=${SHOW_ID}"
OUTPUT_DIR="./episodes"
LOG_DIR="./logs"

# Parse arguments
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
fi

# Ensure directories exist
mkdir -p "$OUTPUT_DIR" "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Fetching latest episode from Shmotime API..."

# Fetch episode data
RESPONSE=$(curl -s "$API_URL")

# Check for success
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [[ "$SUCCESS" != "true" ]]; then
    log "ERROR: API request failed"
    echo "$RESPONSE" | jq .
    send_alert "❌ **Cron Job Recording** failed: API request unsuccessful"
    exit 1
fi

# Extract episode info
EPISODE_URL=$(echo "$RESPONSE" | jq -r '.episode.permalink')
EPISODE_TITLE=$(echo "$RESPONSE" | jq -r '.episode.title')
EPISODE_ID=$(echo "$RESPONSE" | jq -r '.episode.id')
EPISODE_DATE=$(echo "$RESPONSE" | jq -r '.episode.date' | cut -d'T' -f1)

log "Found episode: $EPISODE_TITLE (ID: $EPISODE_ID)"
log "URL: $EPISODE_URL"
log "Date: $EPISODE_DATE"

# Build output filename
# Format: YYYY-MM-DD_Cron-Job_Episode-Title.mp4
TITLE_SLUG=$(echo "$EPISODE_TITLE" | sed 's/ /-/g' | sed 's/[^a-zA-Z0-9-]//g')
OUTPUT_BASE="${EPISODE_DATE}_${SHOW_NAME}_${TITLE_SLUG}"

log "Output base: $OUTPUT_BASE"

# Check if already recorded
if [[ -f "${OUTPUT_DIR}/${OUTPUT_BASE}.mp4" ]]; then
    log "Episode already recorded: ${OUTPUT_DIR}/${OUTPUT_BASE}.mp4"
    send_alert "ℹ️ Episode already recorded: ${EPISODE_TITLE}"
    exit 0
fi

if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY RUN - Would execute:"
    echo "  node scripts/recorder.js \\"
    echo "    --date=${EPISODE_DATE} \\"
    echo "    --show=${SHOW_NAME} \\"
    echo "    --output=${OUTPUT_DIR} \\"
    echo "    --stop-recording-at=end_postcredits \\"
    echo "    \"${EPISODE_URL}\""
    exit 0
fi

log "Starting recording..."

# Record the episode
if ! node scripts/recorder.js \
    --date="${EPISODE_DATE}" \
    --show="${SHOW_NAME}" \
    --output="${OUTPUT_DIR}" \
    --stop-recording-at=end_postcredits \
    "${EPISODE_URL}"; then
    log "ERROR: Recording failed"
    send_alert "❌ **Cron Job Recording** failed: recorder.js error for ${EPISODE_TITLE}"
    exit 1
fi

log "Recording complete!"

# Check for output files
if [[ -f "${OUTPUT_DIR}/${OUTPUT_BASE}.mp4" ]]; then
    log "Video saved: ${OUTPUT_DIR}/${OUTPUT_BASE}.mp4"
    ls -lh "${OUTPUT_DIR}/${OUTPUT_BASE}.mp4"
fi

if [[ -f "${OUTPUT_DIR}/${OUTPUT_BASE}_session-log.json" ]]; then
    log "Session log: ${OUTPUT_DIR}/${OUTPUT_BASE}_session-log.json"
fi

# Send success alert
send_alert "✅ **Cron Job Recording** complete: ${EPISODE_TITLE}"

log "Done!"
