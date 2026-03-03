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
TRAILER_DIR="./episodes/trailers"
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
FORCE_RERECORD=false
RECORDING_MODE=""

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
        -f|--force)
            FORCE_RERECORD=true
            ;;
        --recording-mode=*)
            RECORDING_MODE="${arg#*=}"
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run          Preview each step without executing"
            echo "  --from-step=N      Resume from step N (1-9)"
            echo "  --skip-record      Skip recording, use latest existing episode"
            echo "  --date=YYYY-MM-DD  Override episode date"
            echo "  -f, --force        Clean up old episode (YouTube, playlist, website) and re-record"
            echo "  --recording-mode=N Append ?recordingMode=N to URL, save to episodes/no-music/"
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
            echo "  8. Stage for publish"
            echo "  9. Notify (Discord + desktop; Publish triggers website update)"
            exit 0
            ;;
        *)
            echo "Unknown argument: $arg"
            exit 1
            ;;
    esac
done

# Override output dir when recording-mode is set
if [[ -n "$RECORDING_MODE" ]]; then
    OUTPUT_DIR="./episodes/no-music"
fi

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

    # Auto-skip YouTube steps when --recording-mode is set (trailer-only recording)
    if [[ -n "$RECORDING_MODE" && ("$step_num" == 2 || "$step_num" == 3) ]]; then
        log "SKIP Step ${step_num}: ${step_name} (recording-mode, no YouTube)"
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
# Force re-record cleanup
# ============================================================================

_cleanup_old_episode() {
    local date_str="${EPISODE_DATE:-${DATE_OVERRIDE:-}}"
    if [[ -z "$date_str" ]]; then
        log "ERROR: --force requires --date=YYYY-MM-DD or a resolvable episode date"
        return 1
    fi

    log "========================================"
    log "Force re-record: cleaning up $date_str"
    log "========================================"

    # --- Resolve old video_id from pipeline state or metadata ---
    local old_video_id=""
    local state_file="${OUTPUT_DIR}/${date_str}_pipeline_state.json"
    local published_state="${OUTPUT_DIR}/published/${date_str}_pipeline_state.json"

    for sf in "$state_file" "$published_state"; do
        if [[ -f "$sf" && -z "$old_video_id" ]]; then
            old_video_id=$(python3 -c "
import json
with open('$sf') as f:
    s = json.load(f)
print(s.get('youtube_video_id', ''))" 2>/dev/null || true)
        fi
    done

    # Fallback: check metadata JSONs
    if [[ -z "$old_video_id" ]]; then
        local meta_file
        meta_file=$(ls -t "${OUTPUT_DIR}/${date_str}"_*_youtube_metadata.json "${OUTPUT_DIR}/published/${date_str}"_*_youtube_metadata.json 2>/dev/null | head -1 || true)
        if [[ -n "$meta_file" ]]; then
            old_video_id=$(python3 -c "
import json
with open('$meta_file') as f:
    d = json.load(f)
print(d.get('video_id', ''))" 2>/dev/null || true)
        fi
    fi

    # --- YouTube cleanup ---
    if [[ -n "$old_video_id" ]]; then
        log "Old video ID: $old_video_id"

        if [[ "$DRY_RUN" == "true" ]]; then
            log "[DRY RUN] Would set $old_video_id to private"
        else
            log "Setting $old_video_id to private..."
            python3 scripts/youtube_upload.py --visibility private --video "$old_video_id" || \
                log "WARNING: Failed to set video to private (may already be private)"
        fi

        local playlist_id="${YOUTUBE_PLAYLIST_ID:-}"
        if [[ -n "$playlist_id" ]]; then
            if [[ "$DRY_RUN" == "true" ]]; then
                log "[DRY RUN] Would remove $old_video_id from playlist $playlist_id"
            else
                log "Removing $old_video_id from playlist $playlist_id..."
                python3 scripts/youtube_upload.py --remove-from-playlist "$playlist_id" --video "$old_video_id" || \
                    log "WARNING: Failed to remove from playlist (may already be removed)"
            fi
        fi
    else
        log "No old video ID found — skipping YouTube cleanup"
    fi

    # --- Website unpublish ---
    local website_repo="${WEBSITE_REPO:-}"
    if [[ -n "$website_repo" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            log "[DRY RUN] Would unpublish $date_str from website"
            python3 scripts/publish_m3tv.py --unpublish --episode-date "$date_str" \
                --website-repo "$website_repo" --dry-run || true
        else
            log "Unpublishing $date_str from website..."
            python3 scripts/publish_m3tv.py --unpublish --episode-date "$date_str" \
                --website-repo "$website_repo" --push || \
                log "WARNING: Website unpublish failed (may not have been published)"
        fi
    else
        log "WEBSITE_REPO not set — skipping website unpublish"
    fi

    # --- Move local files to trash ---
    local trash_dir="${OUTPUT_DIR}/trash"
    mkdir -p "$trash_dir"

    local moved=0
    for pattern in \
        "${OUTPUT_DIR}/${date_str}_"*.mp4 \
        "${OUTPUT_DIR}/${date_str}_"*_session-log.json \
        "${OUTPUT_DIR}/${date_str}_"*_youtube_metadata.json \
        "${OUTPUT_DIR}/${date_str}_"*_suggestions.json \
        "${OUTPUT_DIR}/${date_str}_pipeline_state.json" \
        "${OUTPUT_DIR}/published/${date_str}_"*_youtube_metadata.json \
        "${OUTPUT_DIR}/published/${date_str}_pipeline_state.json"
    do
        # shellcheck disable=SC2086
        for f in $pattern; do
            if [[ -f "$f" ]]; then
                if [[ "$DRY_RUN" == "true" ]]; then
                    log "[DRY RUN] Would move to trash: $f"
                else
                    mv "$f" "$trash_dir/"
                    log "Moved to trash: $(basename "$f")"
                fi
                moved=$((moved + 1))
            fi
        done
    done

    if [[ "$moved" -eq 0 ]]; then
        log "No local files found for $date_str to clean up"
    fi

    # Clear in-memory state so the pipeline starts fresh
    YOUTUBE_URL="" YOUTUBE_VIDEO_ID="" CDN_TRAILER_URL=""
    SESSION_LOG="" VIDEO_FILE="" METADATA_JSON="" TRAILER_CONFIG=""

    log "Cleanup complete for $date_str"
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
    node scripts/recorder.cjs \
        --headless \
        --quiet \
        --date="${ep_date}" \
        --show="${SHOW_NAME}" \
        --output="${OUTPUT_DIR}" \
        --stop-recording-at=end_postcredits \
        ${RECORDING_MODE:+--recording-mode="${RECORDING_MODE}"} \
        "${ep_url}"

    log "Recording complete: $VIDEO_FILE"

    # Generate proxy for Remotion Studio preview
    log "Generating proxy video for studio preview..."
    bash scripts/generate_proxy.sh "$VIDEO_FILE" || \
        log "WARNING: Proxy generation failed (non-fatal)"

    _save_state

    # Second pass: record no-music version for trailer cutting
    # Skip if --recording-mode is already set (user is doing a manual recording-mode run)
    if [[ -z "$RECORDING_MODE" ]]; then
        local no_music_dir="./episodes/no-music"
        local no_music_file="${no_music_dir}/${output_base}.mp4"

        if [[ -f "$no_music_file" ]]; then
            log "No-music version already recorded: $no_music_file"
        else
            log "Recording no-music version for trailer..."
            mkdir -p "$no_music_dir"
            node scripts/recorder.cjs \
                --headless --quiet \
                --date="${ep_date}" --show="${SHOW_NAME}" \
                --output="${no_music_dir}" \
                --stop-recording-at=end_postcredits \
                --recording-mode=1 \
                "${ep_url}"
            log "No-music recording complete: $no_music_file"
        fi
    fi
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

    python3 scripts/youtube_metadata.py "$SESSION_LOG" \
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

    if ! python3 scripts/youtube_upload.py --from-json "$METADATA_JSON"; then
        log "ERROR: YouTube upload command failed"
        return 1
    fi

    if [[ ! -f "$METADATA_JSON" ]]; then
        log "ERROR: Metadata JSON missing after upload: $METADATA_JSON"
        return 1
    fi

    # Extract video ID from updated metadata
    YOUTUBE_VIDEO_ID=$(python3 -c "
import json, sys
with open('$METADATA_JSON') as f:
    d = json.load(f)
print(d.get('video_id', d.get('id', '')))" 2>/dev/null || true)

    if [[ -z "$YOUTUBE_VIDEO_ID" ]]; then
        log "ERROR: Could not extract video ID from metadata after upload"
        return 1
    fi

    YOUTUBE_URL="https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}"
    log "YouTube upload complete: $YOUTUBE_URL"
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

    # Back up existing trailer so a failed render doesn't leave a stale file
    local trailer_backup=""
    if [[ -f "$trailer_output" ]]; then
        trailer_backup="${trailer_output}.bak"
        mv "$trailer_output" "$trailer_backup"
    fi

    if ! (cd remotion && npx remotion render \
        --props "../${TRAILER_CONFIG}" \
        --gl=angle \
        Trailer \
        "../${trailer_output}"); then
        log "ERROR: Remotion render failed"
        # Restore backup if render failed
        if [[ -n "$trailer_backup" && -f "$trailer_backup" ]]; then
            mv "$trailer_backup" "$trailer_output"
            log "Restored previous trailer from backup"
        fi
        return 1
    fi

    # Clean up backup on success
    if [[ -n "$trailer_backup" && -f "$trailer_backup" ]]; then
        rm -f "$trailer_backup"
    fi

    if [[ -f "$trailer_output" ]]; then
        log "Trailer rendered: $trailer_output"
    else
        log "WARNING: Trailer output not found after successful render"
        return 1
    fi
}

step_7_cdn_upload() {
    _find_session_log

    local date_str
    date_str="${EPISODE_DATE:-$(date '+%Y-%m-%d')}"
    local clips_dir="${OUTPUT_DIR}/clips"
    local remote_base="cronjob/${date_str}"
    local episode_base=""
    local manifest_path=""
    local manifest_to_upload=""
    local filtered_manifest_path=""

    if [[ -n "$SESSION_LOG" ]]; then
        episode_base=$(basename "$SESSION_LOG" | sed 's/_session-log\.json$//')
    fi

    # Generate manifest if clips exist
    if [[ -d "$clips_dir" ]] && ls "$clips_dir"/*.mp4 &>/dev/null 2>&1; then
        log "Generating manifest for clips..."

        local manifest_args=("$clips_dir" --show cronjob)
        if [[ -n "$SESSION_LOG" ]]; then
            manifest_args+=(--session-log "$SESSION_LOG")
        fi
        if [[ -n "$METADATA_JSON" && -f "$METADATA_JSON" ]]; then
            manifest_args+=(--metadata-json "$METADATA_JSON")
        fi
        python3 scripts/generate_manifest.py "${manifest_args[@]}"

        manifest_path="${clips_dir}/manifest.json"
        manifest_to_upload="$manifest_path"

        # Filter to current episode clips only, so old clips in episodes/clips are not re-uploaded.
        if [[ -n "$episode_base" && -f "$manifest_path" ]]; then
            filtered_manifest_path="${clips_dir}/manifest_${episode_base}_upload.json"
            local filtered_count=""
            if filtered_count=$(python3 - "$manifest_path" "$filtered_manifest_path" "$episode_base" <<'PYEOF'
import json
import sys

manifest_path, output_path, prefix = sys.argv[1:4]
with open(manifest_path, "r", encoding="utf-8") as f:
    manifest = json.load(f)

files = manifest.get("files", [])
filtered = [entry for entry in files if entry.get("filename", "").startswith(prefix + "_")]
manifest["files"] = filtered

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

print(len(filtered))
PYEOF
); then
                manifest_to_upload="$filtered_manifest_path"
                log "Filtered clip manifest to episode prefix '${episode_base}': ${filtered_count} file(s)"
                if [[ "$filtered_count" -eq 0 ]]; then
                    log "No clips found for current episode prefix in clips directory, skipping clip upload"
                    rm -f "$filtered_manifest_path"
                    manifest_to_upload=""
                fi
            else
                log "WARNING: Failed to filter clip manifest; falling back to full manifest upload"
                manifest_to_upload="$manifest_path"
            fi
        fi

        log "Uploading clips to CDN..."
        if [[ -n "$manifest_to_upload" ]]; then
            python3 scripts/cdn_upload.py \
                --manifest "$manifest_to_upload" \
                --remote "${remote_base}/clips/"
        fi
        if [[ -n "$filtered_manifest_path" && -f "$filtered_manifest_path" ]]; then
            rm -f "$filtered_manifest_path"
        fi
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
            --force --json 2>&1) || true

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

step_8_stage_for_publish() {
    local date_str
    date_str="${EPISODE_DATE:-$(date '+%Y-%m-%d')}"
    local publish_source_dir="${OUTPUT_DIR}/published"
    local state_file

    log "Staging episode for publish: $date_str"

    mkdir -p "$publish_source_dir"

    # Keep canonical publish inputs in episodes/published.
    if [[ -n "${METADATA_JSON:-}" && -f "$METADATA_JSON" ]]; then
        local metadata_dest
        metadata_dest="${publish_source_dir}/$(basename "$METADATA_JSON")"
        if [[ "$(realpath "$METADATA_JSON")" != "$(realpath "$metadata_dest" 2>/dev/null || echo "$metadata_dest")" ]]; then
            cp "$METADATA_JSON" "$metadata_dest"
            log "Synced metadata to publish source: $(basename "$METADATA_JSON")"
        else
            log "Metadata already in publish source: $(basename "$METADATA_JSON")"
        fi
    else
        local latest_metadata
        latest_metadata=$(ls -t "${OUTPUT_DIR}/${date_str}"_*_youtube_metadata.json 2>/dev/null | head -1 || true)
        if [[ -n "$latest_metadata" && -f "$latest_metadata" ]]; then
            local latest_dest
            latest_dest="${publish_source_dir}/$(basename "$latest_metadata")"
            if [[ "$(realpath "$latest_metadata")" != "$(realpath "$latest_dest" 2>/dev/null || echo "$latest_dest")" ]]; then
                cp "$latest_metadata" "$latest_dest"
                log "Synced metadata to publish source: $(basename "$latest_metadata")"
            else
                log "Metadata already in publish source: $(basename "$latest_metadata")"
            fi
        fi
    fi

    state_file="$(_state_file)"
    if [[ -f "$state_file" ]]; then
        cp "$state_file" "${publish_source_dir}/$(basename "$state_file")"
        log "Synced pipeline state to publish source: $(basename "$state_file")"
    fi

    # Website publish is now triggered by Discord approval (step 9).
    # We only stage files here — publish_m3tv.py runs after human clicks "Publish".
    export PUBLISH_SOURCE_DIR="$publish_source_dir"
    log "Episode staged for publish (awaiting Discord approval)"
}

step_9_notify() {
    local date_str="${EPISODE_DATE:-$(date '+%Y-%m-%d')}"
    local duration=$(( $(date +%s) - PIPELINE_START ))
    local duration_min=$(( duration / 60 ))
    local duration_sec=$(( duration % 60 ))
    local title="${EPISODE_TITLE:-Cron Job Episode}"
    local publish_source_dir="${PUBLISH_SOURCE_DIR:-${OUTPUT_DIR}/published}"

    log "Pipeline completed in ${duration_min}m ${duration_sec}s"
    log "Episode: $title"
    [[ -n "$YOUTUBE_URL" ]] && log "YouTube: $YOUTUBE_URL"
    [[ -n "$CDN_TRAILER_URL" ]] && log "Trailer: $CDN_TRAILER_URL"

    # Desktop notification
    notify_desktop "Pipeline Complete" "${title}\n${duration_min}m ${duration_sec}s"

    # Save final state (ensures all URLs are persisted)
    _save_state

    # Discord bot notification (background — waits for publish button)
    # The bot now also triggers publish_m3tv.py when "Publish" is clicked.
    local state_file="$(_state_file)"
    local trailer_file="${TRAILER_DIR}/${date_str}_trailer.mp4"

    if [[ -n "${DISCORD_BOT_TOKEN:-}" && -f "$state_file" ]]; then
        local bot_args=(
            --state "$state_file"
            --timeout "${DISCORD_PUBLISH_TIMEOUT:-86400}"
        )
        [[ -n "${DISCORD_PUBLISH_ROLE_ID:-}" ]] && bot_args+=(--role-id "$DISCORD_PUBLISH_ROLE_ID")
        [[ -f "$trailer_file" ]] && bot_args+=(--trailer "$trailer_file")

        # Pass website publish args so the bot can trigger publish_m3tv.py on approval
        bot_args+=(--publish-source-dir "$publish_source_dir")
        bot_args+=(--episode-date "$date_str")
        [[ -n "${WEBSITE_REPO:-}" ]] && bot_args+=(--website-repo "$WEBSITE_REPO")

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
    [[ "$FORCE_RERECORD" == "true" ]] && log "Force re-record: YES"
    [[ -n "$DATE_OVERRIDE" ]] && log "Date override: $DATE_OVERRIDE"

    if [[ -n "$DATE_OVERRIDE" ]]; then
        EPISODE_DATE="$DATE_OVERRIDE"
    fi

    # Always resolve episode date from API if not already set
    if [[ -z "$EPISODE_DATE" ]]; then
        log "Fetching episode date from Shmotime API..."
        local api_response
        api_response=$(curl -s "$API_URL" 2>/dev/null || true)
        if [[ -n "$api_response" ]]; then
            EPISODE_DATE=$(echo "$api_response" | jq -r '.episode.date // empty' 2>/dev/null | cut -d'T' -f1 || true)
            EPISODE_TITLE=$(echo "$api_response" | jq -r '.episode.title // empty' 2>/dev/null || true)
        fi
        if [[ -z "$EPISODE_DATE" ]]; then
            EPISODE_DATE=$(date '+%Y-%m-%d')
            log "WARNING: Could not fetch date from API, using today: $EPISODE_DATE"
        else
            log "Episode date: $EPISODE_DATE (${EPISODE_TITLE:-unknown})"
        fi
    fi

    # Force re-record: clean up old episode before proceeding
    if [[ "$FORCE_RERECORD" == "true" ]]; then
        _cleanup_old_episode || exit 1
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
    run_step 8 "Stage for publish"          step_8_stage_for_publish || exit 1
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
