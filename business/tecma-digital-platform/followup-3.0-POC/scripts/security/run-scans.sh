#!/usr/bin/env bash
# Esegue Semgrep, OSV Scanner e Trivy dalla root del monorepo FollowUp 3.0, poi l'aggregatore.
# Prerequisiti: semgrep, osv-scanner, trivy nel PATH; Node 20+ per l'aggregatore.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
mkdir -p security-reports

echo "==> Semgrep (p/ci)"
semgrep scan --config p/ci --metrics off --json -o security-reports/semgrep-report.json . || {
  echo '{"results":[]}' > security-reports/semgrep-report.json
}

echo "==> OSV Scanner v2 (scan source, recursive)"
# Copre lockfile sotto la root (BE npm, FE pnpm, ecc.).
set +e
osv-scanner scan source -r . --format json --output security-reports/osv-report.json
OSV_EC=$?
set -e
if [[ ! -s security-reports/osv-report.json ]]; then
  echo '{"results":[]}' > security-reports/osv-report.json
fi
# Exit code 1 = vulnerabilità trovate (output JSON comunque valido)
if [[ "$OSV_EC" -gt 1 ]]; then
  echo "osv-scanner exited with $OSV_EC" >&2
  exit "$OSV_EC"
fi

echo "==> Trivy fs (vuln + misconfig)"
trivy fs --scanners vuln,misconfig --exit-code 0 --format json \
  --skip-dirs node_modules --skip-dirs "**/node_modules" \
  -o security-reports/trivy-report.json .

echo "==> Aggregatore"
(
  cd security-aggregator
  npm ci
  npm run build
)
node security-aggregator/dist/cli.js aggregate \
  --out-dir security-reports \
  --semgrep security-reports/semgrep-report.json \
  --osv security-reports/osv-report.json \
  --trivy security-reports/trivy-report.json \
  --soft-fail

node security-aggregator/dist/cli.js dashboard \
  --report security-reports/unified-report.json \
  --out security-reports/security-dashboard.html

node security-aggregator/dist/cli.js gate --summary security-reports/summary.json

echo "OK — unified-report.json e security-dashboard.html in security-reports/"
