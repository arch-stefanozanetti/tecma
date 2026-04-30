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

echo "== Fase 1 readiness check =="

check_file ".github/workflows/ci-be.yml"
check_file ".github/workflows/ci-fe.yml"
check_file "be-followup-v3/Dockerfile"
check_file "fe-followup-v3/Dockerfile"
check_file "docker-compose.yml"
check_file "RUNBOOK_DEPLOY.md"
check_file "CONTRIBUTING.md"

if rg -n "localhost:5060|:5060" load performance >/dev/null 2>&1; then
  echo "[FAIL] trovati riferimenti a porta :5060 in load/performance"
  failures=$((failures + 1))
else
  echo "[OK] nessun riferimento a :5060 in load/performance"
fi

echo "[INFO] branch protection: verifica manuale da GitHub Settings > Branches"

if [[ "$failures" -gt 0 ]]; then
  echo "== RESULT: FAIL ($failures issue) =="
  exit 1
fi

echo "== RESULT: PASS =="
