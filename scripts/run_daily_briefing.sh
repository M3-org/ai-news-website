#!/bin/bash
#
# Daily Briefing Pipeline
#
# Generates and posts the daily ElizaOS briefing to Discord:
#   1. Find latest facts JSON from knowledge repo
#   2. Post text briefing via discord_webhook.py
#   3. Generate Remotion props (generate_daily_card.py)
#   4. Render DailyCard video (Remotion, GPU via EGL)
#   5. Post video to Discord
#
# Usage:
#   ./scripts/run_daily_briefing.sh                  # Today's briefing
#   ./scripts/run_daily_briefing.sh --date=2026-03-10  # Specific date
#   ./scripts/run_daily_briefing.sh --dry-run        # Preview without executing
#   ./scripts/run_daily_briefing.sh --from-step=3   # Resume from step N
#
# Crontab (13:00 UTC daily):
#   0 13 * * * cd /path/to/ai-news-website && ./scripts/run_daily_briefing.sh >> logs/daily-briefing.log 2>&1
#
# Environment (.env or shell):
#   DISCORD_BOT_TOKEN   - Discord bot token (required)
#   DISCORD_CHANNEL_ID  - Channel to post in (required)
#   OPENROUTER_API_KEY  - For LLM summarisation in discord_webhook.py (required)
#   ALERT_WEBHOOK_URL   - Discord webhook for pipeline alerts (optional)
#   KNOWLEDGE_ROOT      - Override path to knowledge repo (default: ./knowledge)
#

set -euo pipefail

cleanup_browsers() {
    pkill -P $$ -f 'chrome-headless-shell' 2>/dev/null || true
}
trap cleanup_browsers EXIT

# ============================================================================
# Setup
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [[ -f .env ]]; then
    set -a
    # shellcheck source=/dev/null
    source .env
    set +a
fi

LOG_DIR="./logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/daily-briefing_$(date '+%Y-%m-%d').log"

DISCORD_WEBHOOK="${ALERT_WEBHOOK_URL:-}"
KNOWLEDGE_ROOT="${KNOWLEDGE_ROOT:-./knowledge}"

DRY_RUN=false
FROM_STEP=1
TARGET_DATE=""

for arg in "$@"; do
    case "$arg" in
        --dry-run)       DRY_RUN=true ;;
        --from-step=*)   FROM_STEP="${arg#*=}" ;;
        --date=*)        TARGET_DATE="${arg#*=}" ;;
        *)               echo "Unknown argument: $arg"; exit 1 ;;
    esac
done

# ============================================================================
# Helpers
# ============================================================================

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

send_alert() {
    local message="$1"
    if [[ -n "$DISCORD_WEBHOOK" ]]; then
        curl -s -X POST "$DISCORD_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"content\": \"$message\"}" > /dev/null 2>&1 || true
    fi
}

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
    else
        local exit_code=$?
        log "ERROR: Step ${step_num} (${step_name}) failed with exit code ${exit_code}"
        send_alert "❌ Daily briefing failed at Step ${step_num}: ${step_name}"
        notify_desktop "Daily Briefing Failed" "Step ${step_num}: ${step_name}" critical
        exit "$exit_code"
    fi
}

notify_desktop() {
    local title="$1"
    local body="$2"
    local urgency="${3:-normal}"
    if command -v notify-send &> /dev/null; then
        notify-send --urgency="$urgency" "$title" "$body" 2>/dev/null || true
    fi
}

# ============================================================================
# Resolve date and facts file
# ============================================================================

if [[ -z "$TARGET_DATE" ]]; then
    TARGET_DATE="$(date -u +%Y-%m-%d)"
fi

FACTS_DIR="${KNOWLEDGE_ROOT}/the-council/facts"
FACTS_FILE="${FACTS_DIR}/${TARGET_DATE}.json"

if [[ ! -f "$FACTS_FILE" ]]; then
    log "Facts not found for ${TARGET_DATE}, falling back to latest available..."
    FACTS_FILE="$(ls -t "${FACTS_DIR}"/????-??-??.json 2>/dev/null | head -1 || true)"
fi

if [[ -z "$FACTS_FILE" || ! -f "$FACTS_FILE" ]]; then
    log "ERROR: No facts file found in ${FACTS_DIR}"
    send_alert "❌ Daily briefing skipped — no facts file found for ${TARGET_DATE}"
    exit 1
fi

log "Using facts: ${FACTS_FILE}"
BRIEFING_DATE="$(basename "$FACTS_FILE" .json)"

PROPS_FILE="/tmp/daily-card-props-${BRIEFING_DATE}.json"
VIDEO_FILE="/tmp/daily-card-${BRIEFING_DATE}.mp4"

# ============================================================================
# Pipeline
# ============================================================================

log "========================================"
log "Daily Briefing Pipeline — ${BRIEFING_DATE}"
log "========================================"

# Step 1: Text briefing → Discord
run_step 1 "Post text briefing" \
    uv run python scripts/discord_webhook.py "$FACTS_FILE"

# Step 2: Generate Remotion props
run_step 2 "Generate Remotion props" \
    uv run python scripts/generate_daily_card.py "$FACTS_FILE" \
        --out "$PROPS_FILE"

# Step 3: Render DailyCard video
run_step 3 "Render DailyCard video" \
    bash -c "cd remotion && npx remotion render DailyCard \
        --props '${PROPS_FILE}' \
        --gl=egl \
        --crf=28 \
        '${VIDEO_FILE}'"

# Step 4: Post video → Discord
run_step 4 "Post video to Discord" \
    uv run python scripts/discord_webhook.py --simple \
        --image "$VIDEO_FILE" \
        --url "https://elizaos.news/daily/${BRIEFING_DATE}" \
        --title "ElizaOS Daily — ${BRIEFING_DATE}"

log "========================================"
log "Daily briefing complete — ${BRIEFING_DATE}"
log "========================================"

notify_desktop "Daily Briefing Done" "${BRIEFING_DATE}" normal
