# Acceptance Gates (Final)

## Scope

Gate finali bloccanti per considerare una release pronta in ottica enterprise:

- quality gates CI hard-fail (BE/FE)
- journey E2E core stabili
- verifica operativa post-release su ambiente target

## 1) CI Hard Gates

### Backend (`be-followup-v3`)

Pipeline: `.github/workflows/ci-be.yml`

Gate bloccanti:

1. `npm run test:lint:core`
2. `npm run check:no-legacy-runtime`
3. `npm run build`
4. `npm run test:coverage:core`

Coverage threshold (core):

- `lines >= 85`
- `statements >= 85`
- `functions >= 95`
- `branches >= 55`

Config: `be-followup-v3/vitest.core.config.ts`

### Frontend (`fe-followup-v3`)

Pipeline: `.github/workflows/ci-fe.yml`

Gate bloccanti:

1. `pnpm run check:panels`
2. `pnpm run test:panels`
3. `pnpm run test:lint:core`
4. `pnpm run build`
5. `pnpm run test:coverage:core`
6. `pnpm exec playwright test e2e/core --project=chromium`

Coverage threshold (core):

- `lines >= 60`
- `statements >= 60`
- `functions >= 34`
- `branches >= 60`

Config: `fe-followup-v3/vitest.core.config.ts`

## 2) E2E Core Journeys

Spec: `fe-followup-v3/e2e/core/core-journeys.spec.ts`

Journey coperti e stabilizzati con API mock:

1. `Clients` page core journey
2. `Apartments` page core journey
3. `Requests` list + switch a `Kanban`

Caratteristiche anti-flake:

- sessione/auth seedata in `addInitScript`
- API `/v1/**` mockate deterministicamente
- nessuna dipendenza da backend reale nei journey core

## 3) Post-release Operational Verification

Script operativo:

- `scripts/post-release-verify.sh`

Check eseguiti:

1. `GET {BE_URL}/v1/health`
2. `GET {BE_URL}/v1/openapi.json`
3. `GET {FE_URL}/login`
4. marker semantico pagina login (`Accedi|Followup|Tecma`)
5. auth behavior su `/v1/auth/me`:
- con bearer opzionale: atteso `200`
- senza bearer: atteso `401`
6. check non bloccante su `{BE_URL}/metrics`

Workflow manuale GitHub Actions:

- `.github/workflows/post-release-acceptance.yml`
- trigger: `workflow_dispatch`
- input: `be_url`, `fe_url`, `auth_bearer` (opzionale)

## 4) Local Commands

```bash
# FE core journeys
cd fe-followup-v3
pnpm run test:e2e:core

# Post-release verify (default localhost)
cd ..
npm run post-release:verify

# Post-release verify su ambiente target
BE_URL="https://api.example.com" FE_URL="https://app.example.com" AUTH_BEARER="<token>" npm run post-release:verify
```
