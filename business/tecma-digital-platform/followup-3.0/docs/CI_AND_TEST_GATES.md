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

## Pipeline in repo

- `.gitlab-ci.yml` — entrypoint pipeline GitLab
- `.gitlab/ci/governance.yml` — branch, MR e commit governance
- `.gitlab/ci/test.yml` — lint, typecheck, test e integration test
- `.gitlab/ci/security.yml` — hardening security
- `.gitlab/ci/openapi.yml` — lint contratti OpenAPI
- `.gitlab/ci/build.yml` e `.gitlab/ci/deploy-*.yml` — build e deploy ambienti

## Definition of done

Una modifica è completata solo con evidenza di:

1. test pertinenti superati (unit/integration/e2e in base al perimetro),
2. typecheck/lint verdi per i package toccati,
3. assenza di riferimenti operativi a path legacy nel codice canonico.
