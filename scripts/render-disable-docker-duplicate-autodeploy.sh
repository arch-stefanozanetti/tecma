#!/usr/bin/env bash
# Disattiva l'auto-deploy sul Web Service Docker duplicato (es. "tecma") per evitare
# update_failed ad ogni push su main quando le env non sono allineate a followup-3-be.
#
# Prerequisito: API key da https://dashboard.render.com/settings#api-keys
#   export RENDER_API_KEY='rnd_...'
#
# ID predefinito: servizio "tecma" (tecma-z02v) — sovrascrivi con RENDER_TECMA_DOCKER_SERVICE_ID se diverso.

set -euo pipefail

SERVICE_ID="${RENDER_TECMA_DOCKER_SERVICE_ID:-srv-d6srl7f5gffc738pmmvg}"

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo "Imposta RENDER_API_KEY (Bearer token da Render Dashboard → API keys)." >&2
  exit 1
fi

echo "PATCH autoDeploy=no su service $SERVICE_ID ..."
curl -sS -X PATCH "https://api.render.com/v1/services/${SERVICE_ID}" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"autoDeploy": "no"}' | tee /dev/stderr

echo
echo "Fatto. Verifica: Dashboard → servizio → Settings → Auto-Deploy = No."
