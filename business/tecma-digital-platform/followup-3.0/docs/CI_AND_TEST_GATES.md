# CI e test gate — Followup 3.0 (greenfield)

Questo documento definisce i gate attivi sul monorepo canonico (`apps/*`, `services/*`, `packages/*`).

## Gate bloccanti

### API (`services/api`)

- `pnpm --filter @followup/api lint`
- `pnpm --filter @followup/api typecheck`
- `pnpm --filter @followup/api build`
- `pnpm --filter @followup/api test`
- `pnpm --filter @followup/api test:integration`

### Web (`apps/web`)

- `pnpm --filter @followup/web lint`
- `pnpm --filter @followup/web typecheck`
- `pnpm --filter @followup/web build`
- `pnpm --filter @followup/web test`
- `pnpm --filter @followup/web test:e2e`

### Security hardening

- `pnpm run security:hardening`

## Workflow locali in repo

- `.github/workflows/ci-be.yml` — quality gate API greenfield
- `.github/workflows/ci-fe.yml` — quality gate Web greenfield + E2E
- `.github/workflows/post-release-acceptance.yml` — verifica manuale post-release

## Definition of done

Una modifica è completata solo con evidenza di:

1. test pertinenti superati (unit/integration/e2e in base al perimetro),
2. typecheck/lint verdi per i package toccati,
3. assenza di riferimenti operativi a path legacy nel codice canonico.
