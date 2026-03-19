#!/usr/bin/env bash
# Aggiorna i servizi followup-3-be e followup-3-fe su Render con il buildCommand
# che usa gli script (stessa build della CI). Richiede RENDER_API_KEY.
set -euo pipefail

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo "Errore: imposta RENDER_API_KEY (es. da https://dashboard.render.com/settings#api-keys)"
  exit 1
fi

BE_SERVICE_ID="srv-d6t6dtshg0os73fk0rn0"
FE_SERVICE_ID="srv-d6t6dtshg0os73fk0rng"
FE_BUILD_CMD="bash ../../../../scripts/render-build-fe.sh"
BE_BUILD_CMD="bash ../../../../scripts/render-build-be.sh"
API_BASE="https://api.render.com/v1"

# Web service: buildCommand in serviceDetails.envSpecificDetails
# Static site: buildCommand in serviceDetails
patch_service() {
  local id="$1"
  local name="$2"
  local json_body="$3"
  echo "==> Updating $name ($id)..."
  local res
  res=$(curl -sS -w "\n%{http_code}" -X PATCH "$API_BASE/services/$id" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$json_body")
  local body code
  code=$(echo "$res" | tail -n 1)
  body=$(echo "$res" | sed '$d')
  if [[ "$code" -ge 200 && "$code" -lt 300 ]]; then
    echo "    OK (HTTP $code)"
  else
    echo "    FAILED HTTP $code: $body"
    return 1
  fi
}

# BE = web_service → envSpecificDetails.buildCommand
patch_service "$BE_SERVICE_ID" "followup-3-be" \
  "{\"serviceDetails\": {\"envSpecificDetails\": {\"buildCommand\": \"$BE_BUILD_CMD\"}}}"
# FE = static_site → serviceDetails.buildCommand
patch_service "$FE_SERVICE_ID" "followup-3-fe" \
  "{\"serviceDetails\": {\"buildCommand\": \"$FE_BUILD_CMD\"}}"
echo "==> Done. Prossimo deploy userà gli script di build."
