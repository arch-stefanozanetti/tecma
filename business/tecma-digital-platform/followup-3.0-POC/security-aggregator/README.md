# @followup/security-aggregator

Normalizza in un unico JSON deterministico i report di **Semgrep**, **OSV Scanner** e **Trivy** (SAST / SCA / IaC / container su fs).

## Sviluppo

```bash
npm ci
npm test
npm run build
```

Dalla root del package **followup-3.0**: `npm run test:security-aggregator` (equivale a `npm ci`, build e test qui).

## CLI

```bash
node dist/cli.js aggregate \
  --out-dir ../security-reports \
  --semgrep ../security-reports/semgrep-report.json \
  --osv ../security-reports/osv-report.json \
  --trivy ../security-reports/trivy-report.json \
  [--pr-body-out ../security-reports/pr-body.md] \
  [--soft-fail]

node dist/cli.js gate --summary ../security-reports/summary.json
node dist/cli.js pr-body [--report ../security-reports/unified-report.json]
node dist/cli.js dashboard [--report ../security-reports/unified-report.json] [--out ../security-reports/security-dashboard.html]
```

**Gate:** variabili d’ambiente `FAIL_ON_CRITICAL_GT` e `FAIL_ON_HIGH_GT` (interi: la run fallisce se `critical` o `high` superano la soglia).

## Output

- `unified-report.json` — `{ generatedAt, summary, issues[] }`
- `summary.json` — conteggi per severità e tipo

**Dashboard HTML** (`dashboard`): pagina singola navigabile (filtri severità/tool, ricerca, stampa). Condivisibile scaricando il file o l’artifact CI `security-dashboard.html`.
Esempi statici: cartella `examples/`.

## Estendere

Implementare un adapter come in `src/parsers/*.ts` e registrarlo in `src/aggregate.ts`, oppure usare `postProcessors` in `aggregateIssues()`.

Documentazione di progetto: [docs/SECURITY_RUNBOOK.md](../docs/SECURITY_RUNBOOK.md) §8.
