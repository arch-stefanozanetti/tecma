#!/usr/bin/env bash
# Genera SBOM CycloneDX (JSON) per BE e FE con Trivy (stesso tooling della CI).
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

echo "== SBOM backend (be-followup-v3) =="
trivy fs --format cyclonedx \
  --skip-dirs node_modules \
  --output "${OUT}/sbom-be.cdx.json" \
  "${ROOT}/be-followup-v3"

echo "== SBOM frontend (fe-followup-v3) =="
trivy fs --format cyclonedx \
  --skip-dirs node_modules \
  --output "${OUT}/sbom-fe.cdx.json" \
  "${ROOT}/fe-followup-v3"

echo "OK: ${OUT}/sbom-be.cdx.json ${OUT}/sbom-fe.cdx.json"
