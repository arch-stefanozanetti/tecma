#!/usr/bin/env bash
# Genera SBOM CycloneDX (JSON) per API e Web con Trivy (stesso tooling della CI).
# Prerequisito: https://aquasecurity.github.io/trivy/latest/getting-started/installation/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT="${ROOT}/security-reports"
mkdir -p "${OUT}"

if ! command -v trivy >/dev/null 2>&1; then
  echo "trivy non trovato nel PATH. Installazione: https://aquasecurity.github.io/trivy/latest/getting-started/installation/" >&2
  exit 1
fi

echo "== SBOM API (services/api) =="
trivy fs --format cyclonedx \
  --skip-dirs node_modules \
  --output "${OUT}/sbom-api.cdx.json" \
  "${ROOT}/services/api"

echo "== SBOM Web (apps/web) =="
trivy fs --format cyclonedx \
  --skip-dirs node_modules \
  --output "${OUT}/sbom-web.cdx.json" \
  "${ROOT}/apps/web"

echo "OK: ${OUT}/sbom-api.cdx.json ${OUT}/sbom-web.cdx.json"
