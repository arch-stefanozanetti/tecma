#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

failures=0

check_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    echo "[OK] file presente: $file"
  else
    echo "[FAIL] file mancante: $file"
    failures=$((failures + 1))
  fi
}

echo "== Greenfield readiness check =="

check_file ".github/workflows/ci-be.yml"
check_file ".github/workflows/ci-fe.yml"
check_file "services/api/package.json"
check_file "apps/web/package.json"
check_file "docker-compose.yml"
check_file "docs/RUNBOOK_DEPLOY.md"
check_file "CONTRIBUTING.md"

if rg -n ":5060|legacy-runtime-path" . >/dev/null 2>&1; then
  echo "[FAIL] trovati riferimenti legacy non ammessi"
  failures=$((failures + 1))
else
  echo "[OK] nessun riferimento legacy bloccante"
fi

echo "[INFO] branch protection: verifica manuale da GitHub Settings > Branches"

if [[ "$failures" -gt 0 ]]; then
  echo "== RESULT: FAIL ($failures issue) =="
  exit 1
fi

echo "== RESULT: PASS =="
