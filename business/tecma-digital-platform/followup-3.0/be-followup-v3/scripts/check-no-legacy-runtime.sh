#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

TARGET_FILES=(
  "be-followup-v3/src/core/apartments/apartments.service.ts"
  "be-followup-v3/src/core/requests/requests.service.ts"
  "be-followup-v3/src/core/unit-pricing/unit-pricing.service.ts"
  "be-followup-v3/src/core/future/future.service.ts"
)

PATTERNS=(
  "return queryLegacyApartments\\("
  "fetchQuoteFromLegacy\\("
  "source:\\s*\"rawPrice\""
  "collection\\(\"apartments\"\\)"
)

for pattern in "${PATTERNS[@]}"; do
  if rg -n "$pattern" "${TARGET_FILES[@]}" >/tmp/legacy_guard_hits.txt; then
    echo "[legacy-guard] Forbidden runtime legacy pattern found: $pattern"
    cat /tmp/legacy_guard_hits.txt
    rm -f /tmp/legacy_guard_hits.txt
    exit 1
  fi
done

echo "[legacy-guard] OK"

