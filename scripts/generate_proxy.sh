#!/usr/bin/env bash
# Generate proxy videos for Remotion Studio preview
# Usage: ./scripts/generate_proxy.sh [episodes/*.mp4]
# If no args, processes all mp4s in episodes/ that lack a proxy

set -euo pipefail

PROXY_DIR="remotion/public/episodes"
EPISODES_DIR="episodes"

# Proxy settings: 360p, 24fps, ~35MB for 15min video
SCALE="640:360"
FPS="24"
CRF="36"
AUDIO_BITRATE="96k"

mkdir -p "$PROXY_DIR"

generate_proxy() {
    local src="$1"
    local basename
    basename=$(basename "$src" .mp4)
    local proxy="${PROXY_DIR}/${basename}_proxy.mp4"

    if [[ -f "$proxy" ]]; then
        echo "  Skip: proxy exists for $basename"
        return 0
    fi

    echo "  Generating proxy: $basename"
    ffmpeg -y -i "$src" \
        -vf "scale=${SCALE}" \
        -r "$FPS" \
        -c:v libx264 -preset ultrafast -crf "$CRF" \
        -c:a aac -b:a "$AUDIO_BITRATE" \
        "$proxy" 2>/dev/null

    local size
    size=$(du -h "$proxy" | cut -f1)
    echo "  Done: ${proxy} (${size})"
}

# If args provided, use those files. Otherwise find all non-proxy mp4s.
if [[ $# -gt 0 ]]; then
    files=("$@")
else
    files=()
    for f in "${EPISODES_DIR}"/*.mp4; do
        [[ "$f" == *_proxy.mp4 ]] && continue
        [[ -f "$f" ]] && files+=("$f")
    done
fi

if [[ ${#files[@]} -eq 0 ]]; then
    echo "No mp4 files to process."
    exit 0
fi

echo "Generating proxies for ${#files[@]} file(s)..."
for f in "${files[@]}"; do
    generate_proxy "$f"
done
echo "All proxies ready in ${PROXY_DIR}/"
