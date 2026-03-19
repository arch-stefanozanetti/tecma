#!/usr/bin/env bash
# Build BE FollowUp 3.0 — stessa sequenza usata su Render (followup-3-be).
# Eseguire dalla root del repo. Usato da CI e da Render (buildCommand).
# Single source of truth: modifiche qui si riflettono su CI e deploy.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BE_DIR="business/tecma-digital-platform/followup-3.0/be-followup-v3"

echo "==> Building be-followup-v3..."
cd "$BE_DIR"
npm ci
npm run build

echo "==> BE build done (output in $BE_DIR/dist)"
