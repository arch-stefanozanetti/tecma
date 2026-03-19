#!/usr/bin/env bash
# Build FE FollowUp 3.0 — stessa sequenza usata su Render (followup-3-fe).
# Eseguire dalla root del repo. Usato da CI e da Render (buildCommand).
# Single source of truth: modifiche qui si riflettono su CI e deploy.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DESIGN_SYSTEM_DIR="business/tecma-digital-platform/design-system"
FE_DIR="business/tecma-digital-platform/followup-3.0/fe-followup-v3"

echo "==> Building design-system..."
cd "$DESIGN_SYSTEM_DIR"
npm ci
npm run build

echo "==> Building fe-followup-v3..."
cd "$REPO_ROOT/$FE_DIR"
rm -rf node_modules
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
pnpm run build

echo "==> FE build done (output in $FE_DIR/dist)"
