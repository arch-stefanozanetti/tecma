#!/usr/bin/env bash
# Promuove il branch corrente su main senza aprire il browser GitHub.
# Flusso: push branch → crea PR se manca → merge (admin bypass check se permesso, altrimenti attende CI).
#
# Prerequisito una tantum:  gh auth login
# (oppure export GH_TOKEN=ghp_... con scope repo)
#
# Uso (dalla root del repo tecma):
#   bash scripts/gh-promote-to-main.sh
#   bash scripts/gh-promote-to-main.sh --no-admin   # solo merge dopo check verdi (no bypass)
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Errore: esegui da dentro il repository git tecma." >&2; exit 1; }
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "Installa GitHub CLI: https://cli.github.com/  (brew install gh)" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Non sei autenticato su gh. Esegui una volta:  gh auth login" >&2
  exit 1
fi

USE_ADMIN=1
for arg in "$@"; do
  case "$arg" in
    --no-admin) USE_ADMIN=0 ;;
  esac
done

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" == "main" ]]; then
  echo "Sei già su main. Per pubblicare:  git push origin main"
  echo "(Se il push è rifiutato, vedi business/tecma-digital-platform/followup-3.0/docs/GITHUB_AUTOMATION_MAIN.md)"
  exit 0
fi

echo ">>> Push origin $BRANCH"
git push -u origin "$BRANCH"

PR_NUM="$(gh pr list --head "$BRANCH" --base main --json number --jq '.[0].number' 2>/dev/null || true)"
if [[ -z "$PR_NUM" || "$PR_NUM" == "null" ]]; then
  echo ">>> Creazione PR verso main"
  gh pr create --base main --head "$BRANCH" \
    --title "chore: promote ${BRANCH} → main (auto)" \
    --body "Promozione automatica via \`scripts/gh-promote-to-main.sh\`. Nessun intervento manuale richiesto in UI."
  PR_NUM="$(gh pr list --head "$BRANCH" --base main --json number --jq '.[0].number')"
fi

echo ">>> PR #${PR_NUM} — merge su main"
if [[ "$USE_ADMIN" -eq 1 ]]; then
  if gh pr merge "$PR_NUM" --merge --admin 2>/dev/null; then
    echo ">>> Merge completato (bypass admin)."
    exit 0
  fi
  echo ">>> Bypass admin non disponibile: attendo i check obbligatori…"
fi

gh pr checks "$PR_NUM" --watch --fail-fast --required
gh pr merge "$PR_NUM" --merge
echo ">>> Merge completato."
echo ">>> Aggiorna il clone:  git checkout main && git pull origin main"
