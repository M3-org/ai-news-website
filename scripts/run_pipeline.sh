#!/bin/bash
#
# Cron Job Episode Pipeline Orchestrator
#
# Chains the full episode pipeline: record → metadata → upload → clips →
# trailer → CDN → website update → notify.
#
# Usage:
#   ./scripts/run_pipeline.sh                    # Full pipeline
#   ./scripts/run_pipeline.sh --dry-run          # Preview without executing
#   ./scripts/run_pipeline.sh --from-step=4      # Resume from step 4
#   ./scripts/run_pipeline.sh --skip-record      # Use existing recording
#   ./scripts/run_pipeline.sh --date=2026-02-02  # Override date
#
# Crontab (Sunday 02:15 UTC = Saturday 9:15pm EST / 6:15pm PST):
#   15 2 * * 0 cd /path/to/ai-news-website && ./scripts/run_pipeline.sh >> logs/pipeline.log 2>&1
#
# Environment:
#   ALERT_WEBHOOK_URL   - Discord webhook URL for notifications (optional)
#   OPENROUTER_API_KEY  - OpenRouter API key for LLM steps (required for steps 4-5)
#   YOUTUBE_PLAYLIST_ID - YouTube playlist ID (optional)
#   BUNNY_STORAGE_ZONE  - Bunny CDN storage zone (required for step 7)
#   BUNNY_STORAGE_PASSWORD - Bunny CDN password (required for step 7)
#   BUNNY_CDN_URL       - CDN base URL (required for step 7)
#

set -euo pipefail

# ============================================================================
# Setup
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Load .env if present
if [[ -f .env ]]; then
    set -a
    # shellcheck source=/dev/null
    source .env
    set +a
fi

# Configuration
SHOW_ID="5296"
SHOW_NAME="Cron-Job"
API_URL="https://shmotime.com/wp-json/shmotime/v1/get-latest-episode?show_id=${SHOW_ID}"
OUTPUT_DIR="./episodes"
LOG_DIR="./logs"
TRAILER_DIR="./trailers"
DISCORD_WEBHOOK="${ALERT_WEBHOOK_URL:-}"

# Pipeline state (exported so child processes / inline Python can read them)
PIPELINE_START=$(date +%s)
export YOUTUBE_URL="" YOUTUBE_VIDEO_ID="" CDN_TRAILER_URL=""
export EPISODE_TITLE="" EPISODE_DATE=""
export SESSION_LOG="" VIDEO_FILE="" METADATA_JSON="" TRAILER_CONFIG=""

# ============================================================================
# Argument parsing
# ============================================================================

DRY_RUN=false
FROM_STEP=1
SKIP_RECORD=false
DATE_OVERRIDE=""

for arg in "$@"; do
    case "$arg" in
        --dry-run)
            DRY_RUN=true
            ;;
        --from-step=*)
            FROM_STEP="${arg#*=}"
            ;;
        --skip-record)
            SKIP_RECORD=true
            FROM_STEP=$((FROM_STEP > 2 ? FROM_STEP : 2))
            ;;
        --date=*)
            DATE_OVERRIDE="${arg#*=}"
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run          Preview each step without executing"
            echo "  --from-step=N      Resume from step N (1-9)"
            echo "  --skip-record      Skip recording, use latest existing episode"
            echo "  --date=YYYY-MM-DD  Override episode date"
            echo "  --help             Show this help"
            echo ""
            echo "Steps:"
            echo "  1. Record episode"
            echo "  2. Generate YouTube metadata"
            echo "  3. Upload to YouTube"
            echo "  4. Analyze clips (LLM)"
            echo "  5. Generate trailer config (LLM)"
            echo "  6. Render trailer via Remotion"
            echo "  7. Generate manifest + Upload to CDN"
            echo "  8. Update website"
            echo "  9. Notify (Discord + desktop)"
            exit 0
            ;;
        *)
            echo "Unknown argument: $arg"
            exit 1
            ;;
    esac
done

# ============================================================================
# Logging & Notifications
# ============================================================================

mkdir -p "$OUTPUT_DIR" "$LOG_DIR" "$TRAILER_DIR"

LOG_FILE="${LOG_DIR}/pipeline_$(date '+%Y-%m-%d').log"

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

# Send plain-text Discord alert (fallback)
send_alert() {
    local message="$1"
    if [[ -n "$DISCORD_WEBHOOK" ]]; then
        curl -s -X POST "$DISCORD_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"content\": \"<@&1442659164043219036> $message\"}" > /dev/null 2>&1 || true
    fi
}

# Send rich Discord embed
send_discord_embed() {
    local title="$1"
    local description="$2"
    local color="$3"  # decimal color value
    local fields="$4" # JSON array of field objects

    if [[ -z "$DISCORD_WEBHOOK" ]]; then
        return
    fi

    local payload
    payload=$(cat <<ENDOFPAYLOAD
{
  "content": "<@&1442659164043219036>",
  "embeds": [{
    "title": "${title}",
    "description": "${description}",
    "color": ${color},
    "fields": ${fields},
    "footer": {
      "text": "Cron Job Pipeline"
    },
    "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  }]
}
ENDOFPAYLOAD
)

    curl -s -X POST "$DISCORD_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "$payload" > /dev/null 2>&1 || true
}

# Desktop notification (Linux)
notify_desktop() {
    local title="$1"
    local body="$2"
    local urgency="${3:-normal}"  # low, normal, critical

    if command -v notify-send &> /dev/null; then
        notify-send --urgency="$urgency" "$title" "$body" 2>/dev/null || true
    fi
}

# ============================================================================
# Step runner
# ============================================================================

run_step() {
    local step_num="$1"
    local step_name="$2"
    shift 2

    if [[ "$step_num" -lt "$FROM_STEP" ]]; then
        log "SKIP Step ${step_num}: ${step_name} (resuming from step ${FROM_STEP})"
        return 0
    fi

    log "========================================"
    log "Step ${step_num}: ${step_name}"
    log "========================================"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would execute: $*"
        return 0
    fi

    if "$@"; then
        log "Step ${step_num} complete."
        return 0
    else
        local exit_code=$?
        log "ERROR: Step ${step_num} (${step_name}) failed with exit code ${exit_code}"
        send_alert "❌ **Pipeline Failed** at Step ${step_num}: ${step_name}"
        notify_desktop "Pipeline Failed" "Step ${step_num}: ${step_name}" critical
        return "$exit_code"
    fi
}

# ============================================================================
# State persistence — save/load pipeline state for resume
# ============================================================================

_state_file() {
    echo "${OUTPUT_DIR}/${EPISODE_DATE:-$(date '+%Y-%m-%d')}_pipeline_state.json"
}

_save_state() {
    python3 - "$(_state_file)" <<'PYEOF'
import json, sys, os
state = {}
path = sys.argv[1]
if os.path.exists(path):
    with open(path) as f:
        state = json.load(f)
for key in ("EPISODE_TITLE", "EPISODE_DATE", "YOUTUBE_URL",
            "YOUTUBE_VIDEO_ID", "CDN_TRAILER_URL", "SESSION_LOG",
            "METADATA_JSON", "TRAILER_CONFIG"):
    val = os.environ.get(key, "")
    if val:
        state[key.lower()] = val
with open(path, "w") as f:
    json.dump(state, f, indent=2)
PYEOF
}

_load_state() {
    local sf="$(_state_file)"
    [[ -f "$sf" ]] || return 0
    log "Loading state: $(basename "$sf")"
    eval "$(python3 -c "
import json, os, shlex
with open('$sf') as f:
    s = json.load(f)
for k, v in s.items():
    if v and not os.environ.get(k.upper()):
        print(f'{k.upper()}={shlex.quote(str(v))}')
")"
}

# ============================================================================
# Pipeline Steps
# ============================================================================

step_1_record() {
    if [[ "$SKIP_RECORD" == "true" ]]; then
        log "Skipping recording (--skip-record)"
        return 0
    fi

    log "Fetching latest episode from Shmotime API..."
    local response
    response=$(curl -s "$API_URL")

    local success
    success=$(echo "$response" | jq -r '.success')
    if [[ "$success" != "true" ]]; then
        log "ERROR: Shmotime API request failed"
        return 1
    fi

    local ep_url ep_title ep_id ep_date
    ep_url=$(echo "$response" | jq -r '.episode.permalink')
    ep_title=$(echo "$response" | jq -r '.episode.title')
    ep_id=$(echo "$response" | jq -r '.episode.id')
    ep_date=$(echo "$response" | jq -r '.episode.date' | cut -d'T' -f1)

    EPISODE_TITLE="$ep_title"

    if [[ -n "$DATE_OVERRIDE" ]]; then
        ep_date="$DATE_OVERRIDE"
    fi
    EPISODE_DATE="$ep_date"

    local title_slug
    title_slug=$(echo "$ep_title" | sed 's/ /-/g' | sed 's/[^a-zA-Z0-9-]//g')
    local output_base="${ep_date}_${SHOW_NAME}_${title_slug}"

    VIDEO_FILE="${OUTPUT_DIR}/${output_base}.mp4"
    SESSION_LOG="${OUTPUT_DIR}/${output_base}_session-log.json"

    log "Episode: $ep_title (ID: $ep_id)"
    log "URL: $ep_url"
    log "Date: $ep_date"

    # Check if already recorded
    if [[ -f "$VIDEO_FILE" ]]; then
        log "Episode already recorded: $VIDEO_FILE"
        return 0
    fi

    log "Starting recording..."
    node scripts/recorder.js \
        --headless \
        --quiet \
        --date="${ep_date}" \
        --show="${SHOW_NAME}" \
        --output="${OUTPUT_DIR}" \
        --stop-recording-at=end_postcredits \
        "${ep_url}"

    log "Recording complete: $VIDEO_FILE"
    _save_state
}

step_2_generate_metadata() {
    _find_session_log

    if [[ -z "$SESSION_LOG" ]]; then
        log "ERROR: No session log found"
        return 1
    fi

    log "Generating YouTube metadata from: $(basename "$SESSION_LOG")"

    local playlist_arg=""
    if [[ -n "${YOUTUBE_PLAYLIST_ID:-}" ]]; then
        playlist_arg="--playlist-id=${YOUTUBE_PLAYLIST_ID}"
    fi

    python3 scripts/generate_youtube_metadata.py "$SESSION_LOG" \
        --privacy unlisted \
        --download-thumb \
        ${playlist_arg:+"$playlist_arg"}

    # Determine metadata file path
    local base
    base=$(echo "$SESSION_LOG" | sed 's/_session-log\.json$//')
    METADATA_JSON="${base}_youtube_metadata.json"

    if [[ ! -f "$METADATA_JSON" ]]; then
        log "ERROR: Metadata file not generated: $METADATA_JSON"
        return 1
    fi

    log "Metadata generated: $METADATA_JSON"
}

step_3_upload_youtube() {
    if [[ -z "$METADATA_JSON" ]]; then
        _find_metadata_json
    fi

    if [[ -z "$METADATA_JSON" ]]; then
        log "ERROR: No metadata JSON found"
        return 1
    fi

    log "Uploading to YouTube from: $(basename "$METADATA_JSON")"

    python3 scripts/upload_to_youtube.py --from-json "$METADATA_JSON"

    # Extract video ID from updated metadata
    if [[ -f "$METADATA_JSON" ]]; then
        YOUTUBE_VIDEO_ID=$(python3 -c "
import json, sys
with open('$METADATA_JSON') as f:
    d = json.load(f)
print(d.get('video_id', d.get('id', '')))" 2>/dev/null || true)

        if [[ -n "$YOUTUBE_VIDEO_ID" ]]; then
            YOUTUBE_URL="https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}"
            log "YouTube upload complete: $YOUTUBE_URL"
        else
            log "WARNING: Could not extract video ID from metadata"
        fi
    fi
    _save_state
}

step_4_analyze_clips() {
    _find_session_log

    if [[ -z "$SESSION_LOG" ]]; then
        log "ERROR: No session log found"
        return 1
    fi

    log "Analyzing clips from: $(basename "$SESSION_LOG")"

    python3 scripts/llm_producer.py clips "$SESSION_LOG" --extract

    log "Clip analysis complete"
}

step_5_generate_trailer() {
    _find_session_log

    if [[ -z "$SESSION_LOG" ]]; then
        log "ERROR: No session log found"
        return 1
    fi

    log "Generating trailer config from: $(basename "$SESSION_LOG")"

    python3 scripts/llm_producer.py trailer "$SESSION_LOG" --output="$TRAILER_DIR"

    # Find the generated config
    local base
    base=$(basename "$SESSION_LOG" | sed 's/_session-log\.json$//')
    TRAILER_CONFIG="${TRAILER_DIR}/${base}_trailer-config.json"

    if [[ -f "$TRAILER_CONFIG" ]]; then
        log "Trailer config generated: $TRAILER_CONFIG"
    else
        log "WARNING: Trailer config not found at $TRAILER_CONFIG"
    fi
}

step_6_render_trailer() {
    if [[ -z "$TRAILER_CONFIG" ]]; then
        _find_trailer_config
    fi

    if [[ -z "$TRAILER_CONFIG" || ! -f "$TRAILER_CONFIG" ]]; then
        log "WARNING: No trailer config found, skipping render"
        return 0
    fi

    local date_str
    date_str="${EPISODE_DATE:-$(date '+%Y-%m-%d')}"
    local trailer_output="${TRAILER_DIR}/${date_str}_trailer.mp4"

    log "Rendering trailer via Remotion..."
    log "Config: $TRAILER_CONFIG"
    log "Output: $trailer_output"

    (cd remotion && npx remotion render \
        --props "../${TRAILER_CONFIG}" \
        Trailer \
        "../${trailer_output}")

    if [[ -f "$trailer_output" ]]; then
        log "Trailer rendered: $trailer_output"
    else
        log "WARNING: Trailer output not found"
        return 1
    fi
}

step_7_cdn_upload() {
    _find_session_log

    local date_str
    date_str="${EPISODE_DATE:-$(date '+%Y-%m-%d')}"
    local clips_dir="${OUTPUT_DIR}/clips"
    local remote_base="cronjob/${date_str}"

    # Generate manifest if clips exist
    if [[ -d "$clips_dir" ]] && ls "$clips_dir"/*.mp4 &>/dev/null 2>&1; then
        log "Generating manifest for clips..."

        local manifest_args=("$clips_dir" --show cronjob)
        if [[ -n "$SESSION_LOG" ]]; then
            manifest_args+=(--session-log "$SESSION_LOG")
        fi
        python3 scripts/generate_manifest.py "${manifest_args[@]}"

        log "Uploading clips to CDN..."
        python3 scripts/cdn_upload.py \
            --manifest "${clips_dir}/manifest.json" \
            --remote "${remote_base}/clips/"
    else
        log "No clips found, skipping clip upload"
    fi

    # Upload trailer if it exists
    local trailer_file="${TRAILER_DIR}/${date_str}_trailer.mp4"
    if [[ -f "$trailer_file" ]]; then
        log "Uploading trailer to CDN..."

        local cdn_result
        cdn_result=$(python3 scripts/cdn_upload.py \
            "$trailer_file" \
            --remote "${remote_base}/trailers/" \
            --json 2>&1) || true

        # Try to extract URL from JSON response
        if [[ -n "$cdn_result" ]]; then
            CDN_TRAILER_URL=$(echo "$cdn_result" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if isinstance(data, list) and data:
        print(data[0].get('cdn_url', ''))
except: pass" 2>/dev/null) || true
        fi

        # Fallback: construct from CDN convention
        if [[ -z "$CDN_TRAILER_URL" ]]; then
            CDN_TRAILER_URL="${BUNNY_CDN_URL:-https://cdn.elizaos.news}/cronjob/${date_str}/trailers/$(basename "$trailer_file")"
            log "Using constructed trailer URL: $CDN_TRAILER_URL"
        else
            log "Trailer uploaded: $CDN_TRAILER_URL"
        fi
    else
        log "No trailer file found, skipping trailer upload"
    fi
    _save_state
}

step_8_update_website() {
    local date_str
    date_str="${EPISODE_DATE:-$(date '+%Y-%m-%d')}"

    log "Updating website for date: $date_str"

    python3 scripts/publish_m3tv.py --episode-date="$date_str" --website-repo="/home/jin/repo/website" --push

    log "Website updated"
}

step_9_notify() {
    local date_str="${EPISODE_DATE:-$(date '+%Y-%m-%d')}"
    local duration=$(( $(date +%s) - PIPELINE_START ))
    local duration_min=$(( duration / 60 ))
    local duration_sec=$(( duration % 60 ))
    local title="${EPISODE_TITLE:-Cron Job Episode}"

    log "Pipeline completed in ${duration_min}m ${duration_sec}s"
    log "Episode: $title"
    [[ -n "$YOUTUBE_URL" ]] && log "YouTube: $YOUTUBE_URL"
    [[ -n "$CDN_TRAILER_URL" ]] && log "Trailer: $CDN_TRAILER_URL"

    # Desktop notification
    notify_desktop "Pipeline Complete" "${title}\n${duration_min}m ${duration_sec}s"

    # Save final state (ensures all URLs are persisted)
    _save_state

    # Discord bot notification (background — waits for publish button)
    local state_file="$(_state_file)"
    local trailer_file="${TRAILER_DIR}/${date_str}_trailer.mp4"

    if [[ -n "${DISCORD_BOT_TOKEN:-}" && -f "$state_file" ]]; then
        local bot_args=(
            --state "$state_file"
            --timeout "${DISCORD_PUBLISH_TIMEOUT:-86400}"
        )
        [[ -n "${DISCORD_PUBLISH_ROLE_ID:-}" ]] && bot_args+=(--role-id "$DISCORD_PUBLISH_ROLE_ID")
        [[ -f "$trailer_file" ]] && bot_args+=(--trailer "$trailer_file")

        log "Launching Discord notification bot..."
        nohup python3 scripts/discord_notify.py "${bot_args[@]}" \
            >> "${LOG_DIR}/discord_notify_${date_str}.log" 2>&1 &
        log "Discord bot PID: $! (log: discord_notify_${date_str}.log)"
    fi

    # Fallback: webhook alert if no bot token
    if [[ -z "${DISCORD_BOT_TOKEN:-}" && -n "$DISCORD_WEBHOOK" ]]; then
        local fields="[{\"name\":\"Date\",\"value\":\"${date_str}\",\"inline\":true}"
        [[ -n "$YOUTUBE_URL" ]] && fields+=",{\"name\":\"YouTube\",\"value\":\"${YOUTUBE_URL}\",\"inline\":true}"
        fields+="]"

        send_discord_embed \
            "Pipeline Complete: ${title}" \
            "Completed in ${duration_min}m ${duration_sec}s" \
            3066993 \
            "$fields"
    fi

    log "Notifications sent"
}

# ============================================================================
# Helpers — find latest files when resuming
# ============================================================================

_find_session_log() {
    if [[ -n "$SESSION_LOG" && -f "$SESSION_LOG" ]]; then
        return
    fi

    local date_str="${EPISODE_DATE:-${DATE_OVERRIDE:-}}"

    if [[ -n "$date_str" ]]; then
        # Find by date
        SESSION_LOG=$(ls -t "${OUTPUT_DIR}/${date_str}"_*_session-log.json 2>/dev/null | head -1 || true)
    fi

    if [[ -z "$SESSION_LOG" ]]; then
        # Find most recent
        SESSION_LOG=$(ls -t "${OUTPUT_DIR}"/*_session-log.json 2>/dev/null | head -1 || true)
    fi

    if [[ -n "$SESSION_LOG" ]]; then
        log "Using session log: $(basename "$SESSION_LOG")"

        # Derive other paths
        local base
        base=$(echo "$SESSION_LOG" | sed 's/_session-log\.json$//')
        VIDEO_FILE="${base}.mp4"

        # Extract date from filename
        if [[ -z "$EPISODE_DATE" ]]; then
            EPISODE_DATE=$(basename "$SESSION_LOG" | grep -oP '^\d{4}-\d{2}-\d{2}' || true)
        fi
    fi
}

_find_metadata_json() {
    if [[ -n "$METADATA_JSON" && -f "$METADATA_JSON" ]]; then
        return
    fi

    _find_session_log

    if [[ -n "$SESSION_LOG" ]]; then
        local base
        base=$(echo "$SESSION_LOG" | sed 's/_session-log\.json$//')
        METADATA_JSON="${base}_youtube_metadata.json"
    fi

    if [[ -z "$METADATA_JSON" || ! -f "$METADATA_JSON" ]]; then
        local date_str="${EPISODE_DATE:-}"
        if [[ -n "$date_str" ]]; then
            METADATA_JSON=$(ls -t "${OUTPUT_DIR}/${date_str}"_*_youtube_metadata.json 2>/dev/null | head -1 || true)
        fi
    fi

    if [[ -z "$METADATA_JSON" || ! -f "$METADATA_JSON" ]]; then
        METADATA_JSON=$(ls -t "${OUTPUT_DIR}"/*_youtube_metadata.json 2>/dev/null | head -1 || true)
    fi
}

_find_trailer_config() {
    if [[ -n "$TRAILER_CONFIG" && -f "$TRAILER_CONFIG" ]]; then
        return
    fi

    local date_str="${EPISODE_DATE:-}"
    if [[ -n "$date_str" ]]; then
        TRAILER_CONFIG=$(ls -t "${TRAILER_DIR}/${date_str}"_*_trailer-config.json 2>/dev/null | head -1 || true)
    fi

    if [[ -z "$TRAILER_CONFIG" ]]; then
        TRAILER_CONFIG=$(ls -t "${TRAILER_DIR}"/*_trailer-config.json 2>/dev/null | head -1 || true)
    fi
}

# ============================================================================
# Main
# ============================================================================

main() {
    log "========================================"
    log "Cron Job Pipeline — $(date '+%Y-%m-%d %H:%M:%S')"
    log "========================================"
    log "Dry run: $DRY_RUN"
    log "From step: $FROM_STEP"
    log "Skip record: $SKIP_RECORD"
    [[ -n "$DATE_OVERRIDE" ]] && log "Date override: $DATE_OVERRIDE"

    if [[ -n "$DATE_OVERRIDE" ]]; then
        EPISODE_DATE="$DATE_OVERRIDE"
    fi

    # If resuming, try to find existing files and restore state
    if [[ "$FROM_STEP" -gt 1 || "$SKIP_RECORD" == "true" ]]; then
        _find_session_log
        _find_metadata_json
        _find_trailer_config
        _load_state
    fi

    # Fallback: extract missing state from metadata JSON
    if [[ -n "$METADATA_JSON" && -f "$METADATA_JSON" ]]; then
        if [[ -z "$EPISODE_TITLE" || -z "$YOUTUBE_VIDEO_ID" ]]; then
            eval "$(python3 -c "
import json, os, shlex
with open('$METADATA_JSON') as f:
    d = json.load(f)
if not os.environ.get('EPISODE_TITLE'):
    t = d.get('_source', {}).get('episode_name', d.get('title', '').split(' - ')[0])
    if t: print(f'EPISODE_TITLE={shlex.quote(t)}')
vid = d.get('video_id', d.get('id', ''))
if vid and not os.environ.get('YOUTUBE_VIDEO_ID'):
    print(f'YOUTUBE_VIDEO_ID={shlex.quote(vid)}')
    print(f'YOUTUBE_URL=https://www.youtube.com/watch?v={vid}')
" 2>/dev/null || true)"
        fi
    fi

    run_step 1 "Record episode"            step_1_record       || exit 1
    run_step 2 "Generate YouTube metadata" step_2_generate_metadata || exit 1
    run_step 3 "Upload to YouTube"         step_3_upload_youtube    || exit 1
    run_step 4 "Analyze clips (LLM)"       step_4_analyze_clips     || exit 1
    run_step 5 "Generate trailer config"   step_5_generate_trailer  || exit 1
    run_step 6 "Render trailer"            step_6_render_trailer    || exit 1
    run_step 7 "Upload to CDN"             step_7_cdn_upload        || exit 1
    run_step 8 "Update website"            step_8_update_website    || exit 1
    run_step 9 "Notify"                    step_9_notify            || true

    log "========================================"
    log "Pipeline complete!"
    log "========================================"
    [[ -n "$EPISODE_TITLE" ]]   && log "  Episode:  $EPISODE_TITLE"
    [[ -n "$YOUTUBE_URL" ]]     && log "  YouTube:  $YOUTUBE_URL (unlisted)"
    [[ -n "$CDN_TRAILER_URL" ]] && log "  Trailer:  $CDN_TRAILER_URL"
    log "========================================"
}

main
