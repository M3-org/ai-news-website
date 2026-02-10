#!/usr/bin/env bash
set -euo pipefail

# Reports overlapping relative paths between media/dashboards and media/samples.
# Exits non-zero if differences are found, unless --allow-diff is passed.

ALLOW_DIFF=0
if [[ "${1:-}" == "--allow-diff" ]]; then
  ALLOW_DIFF=1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DASH_DIR="media/dashboards"
SAMPLES_DIR="media/samples"

if [[ ! -d "$DASH_DIR" ]]; then
  echo "Missing directory: $DASH_DIR"
  exit 1
fi

if [[ ! -d "$SAMPLES_DIR" ]]; then
  echo "Missing directory: $SAMPLES_DIR"
  exit 1
fi

dash_list="$(mktemp)"
samples_list="$(mktemp)"
trap 'rm -f "$dash_list" "$samples_list"' EXIT

find "$DASH_DIR" -type f -printf '%P\n' | sort > "$dash_list"
find "$SAMPLES_DIR" -type f -printf '%P\n' | sort > "$samples_list"

overlap="$(comm -12 "$dash_list" "$samples_list" || true)"

if [[ -z "$overlap" ]]; then
  echo "No overlapping files between $DASH_DIR and $SAMPLES_DIR."
  exit 0
fi

echo "Overlap files:"
echo "$overlap" | sed 's/^/  - /'
echo

diff_count=0
same_count=0

while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue
  if cmp -s "$DASH_DIR/$rel" "$SAMPLES_DIR/$rel"; then
    echo "SAME  $rel"
    same_count=$((same_count + 1))
  else
    echo "DIFF  $rel"
    diff_count=$((diff_count + 1))
  fi
done <<< "$overlap"

echo
echo "Summary: same=$same_count diff=$diff_count total=$((same_count + diff_count))"

if [[ "$diff_count" -gt 0 && "$ALLOW_DIFF" -ne 1 ]]; then
  echo "Differences detected. Re-run with --allow-diff to ignore."
  exit 2
fi

