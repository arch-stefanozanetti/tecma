#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

TARGET_PATHS=(
  "be-followup-v3/src/core"
  "be-followup-v3/src/routes"
)

PATTERNS=(
  "queryLegacy[A-Za-z0-9_]*\\("
  "fetchQuoteFromLegacy\\("
  "automata_configurations"
  "status-automata"
  "collection\\(\"calendars\"\\)"
  "getDbByName\\(\"asset\"\\)"
  "apartments_view"
  "source:\\s*\"rawPrice\""
  "collection\\(\"apartments\"\\)"
)

for pattern in "${PATTERNS[@]}"; do
  if rg -n \
    -g '!**/*.test.ts' \
    -g '!**/*.spec.ts' \
    -g '!**/__tests__/**' \
    "$pattern" \
    "${TARGET_PATHS[@]}" >/tmp/legacy_guard_hits.txt; then
    echo "[legacy-guard] Forbidden runtime legacy pattern found: $pattern"
    cat /tmp/legacy_guard_hits.txt
    rm -f /tmp/legacy_guard_hits.txt
    exit 1
  fi
done

echo "[legacy-guard] OK"
