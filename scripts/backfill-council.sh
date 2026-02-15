#!/usr/bin/env bash
# Wrapper to run council backfill from the symlinked knowledge repo.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KNOWLEDGE_ROOT="${KNOWLEDGE_ROOT:-${WEBSITE_ROOT}/knowledge}"
TARGET_SCRIPT="${KNOWLEDGE_ROOT}/scripts/etl/backfill/backfill-council.sh"

if [[ ! -f "${TARGET_SCRIPT}" ]]; then
  echo "ERROR: backfill script not found at ${TARGET_SCRIPT}"
  echo "Set KNOWLEDGE_ROOT to your knowledge repo path, then retry."
  exit 1
fi

exec "${TARGET_SCRIPT}" "$@"
