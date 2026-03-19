#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[secrets] scanning tracked files for hardcoded secrets..."

tmpfile="$(mktemp)"
trap 'rm -f "$tmpfile"' EXIT

# 1) .env* tracked files with non-empty sensitive vars (excluding explicit safe placeholder).
tracked_env_files="$(git ls-files | rg '(^|/)\.env($|\.|\.example$)' || true)"
if [[ -n "$tracked_env_files" ]]; then
  printf "%s\n" "$tracked_env_files" | xargs rg -n --no-heading -S \
    -e '^\s*MONGO_URI\s*=\s*mongodb(\+srv)?:\/\/[^#\n\r ]+:[^#\n\r ]+@' \
    -e '^\s*SES_SMTP_USER\s*=\s*[^#\s]+' \
    -e '^\s*SES_SMTP_PASS\s*=\s*[^#\s]+' \
    -e '^\s*DOCUSIGN_API_TOKEN\s*=\s*[^#\s]+' \
    -e '^\s*YOUSIGN_API_TOKEN\s*=\s*[^#\s]+' \
    -e '^\s*MCP_API_KEY\s*=\s*[^#\s]+' \
    -e '^\s*AUTH_JWT_SECRET\s*=\s*[^#\s]+' \
    >> "$tmpfile" || true
fi

if [[ -s "$tmpfile" ]]; then
  grep -vE 'AUTH_JWT_SECRET\s*=\s*dev-followup-secret-change-me|MCP_API_KEY\s*=\s*replace-with-long-random-value-min-24-chars' "$tmpfile" > "${tmpfile}.filtered" || true
  mv "${tmpfile}.filtered" "$tmpfile"
fi

# 2) hardcoded runtime credentials in TS/JS files (minimal denylist, intentionally strict).
tracked_source_files="$(git ls-files '*.ts' '*.tsx' '*.js' '*.mjs' || true)"
if [[ -n "$tracked_source_files" ]]; then
  printf "%s\n" "$tracked_source_files" | xargs rg -n --no-heading -S \
    -e 'const\s+(PASSWORD|ADMIN_PASSWORD|MCP_API_KEY)\s*=\s*["'"'"'][^"'"'"']{8,}["'"'"']' \
    >> "$tmpfile" || true
fi

if [[ -s "$tmpfile" ]]; then
  echo "[secrets] potential secret leak detected:"
  cat "$tmpfile"
  echo "[secrets] commit blocked. Move secrets to untracked env vars or secret manager."
  exit 1
fi

echo "[secrets] no hardcoded secrets found."
