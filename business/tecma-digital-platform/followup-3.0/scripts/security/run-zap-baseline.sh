#!/usr/bin/env bash
# Esegue OWASP ZAP baseline in Docker contro un URL di staging.
# Uso:
#   TARGET_URL="https://staging.example.com" bash scripts/security/run-zap-baseline.sh
# oppure:
#   npm run security:zap:baseline -- --target https://staging.example.com
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
mkdir -p security-reports

TARGET_URL="${TARGET_URL:-}"
if [[ "${1:-}" == "--target" && -n "${2:-}" ]]; then
  TARGET_URL="$2"
fi

if [[ -z "$TARGET_URL" ]]; then
  echo "Errore: TARGET_URL non impostato."
  echo "Esempio: TARGET_URL=\"https://staging.example.com\" npm run security:zap:baseline"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Errore: docker non trovato nel PATH."
  exit 1
fi

HTML_OUT="$ROOT/security-reports/zap-baseline-report.html"
MD_OUT="$ROOT/security-reports/zap-baseline-report.md"
JSON_OUT="$ROOT/security-reports/zap-baseline-report.json"

echo "==> ZAP baseline target: $TARGET_URL"
docker run --rm -t \
  -v "$ROOT/security-reports:/zap/wrk" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
  -t "$TARGET_URL" \
  -J /zap/wrk/zap-baseline-report.json \
  -r /zap/wrk/zap-baseline-report.html \
  -w /zap/wrk/zap-baseline-report.md \
  || true

echo "Output:"
echo " - $HTML_OUT"
echo " - $MD_OUT"
echo " - $JSON_OUT"
echo "Nota: ZAP baseline e' uno smoke DAST, non sostituisce un penetration test umano."
