# Acceptance Gates (Final)

## Scope

Gate finali bloccanti per considerare una release pronta in ottica enterprise:

- quality gates CI hard-fail (BE/FE)
- journey E2E core stabili
- verifica operativa post-release su ambiente target

## 1) CI Hard Gates

### Build deploy (Render parity)

Pipeline: `.github/workflows/followup-3.0-ci-cd.yml` (root repo tecma)

Gate bloccanti per allineamento deploy:

- **Run deploy build (FE):** esecuzione di `scripts/render-build-fe.sh` (design-system + fe-followup-v3).
- **Run deploy build (BE):** esecuzione di `scripts/render-build-be.sh` (be-followup-v3).

Se questi step passano in CI, la build su Render (followup-3-fe, followup-3-be) usa la stessa sequenza e non fallisce per build. Modifiche agli script o ai path vanno verificate con la CI prima del merge.

### Backend (`be-followup-v3`)

Pipeline principale monorepo: `.github/workflows/followup-3.0-ci-cd.yml` (job **BE Quality Gate**).  
Riferimento unico gate obbligatori/opzionali: [CI_AND_TEST_GATES.md](CI_AND_TEST_GATES.md).

Gate bloccanti nel job BE (sintesi):

1. `npm run test` (unit)
2. `npm run test:integration`
3. `vitest.core.config.ts --coverage` + soglie `check-core-coverage.mjs`
4. `bash scripts/render-build-be.sh`

Pipeline legacy/addizionale (se presente nel repo): `.github/workflows/ci-be.yml` può includere lint OpenAPI, route-guards, `check:no-legacy-runtime` — allineare i branch protection ai check effettivamente richiesti.

Coverage threshold (core):

- `lines >= 85`
- `statements >= 85`
- `functions >= 95`
- `branches >= 55`

Config: `be-followup-v3/vitest.core.config.ts`

### Frontend (`fe-followup-v3`)

Pipeline principale: `.github/workflows/followup-3.0-ci-cd.yml` (job **FE Quality Gate** + **FE E2E smoke**).  
Dettaglio: [CI_AND_TEST_GATES.md](CI_AND_TEST_GATES.md).

Gate bloccanti (sintesi):

1. `pnpm run test:coverage:core`
2. `pnpm run test:run:ci` (suite unit completa)
3. `bash scripts/render-build-fe.sh`
4. E2E: `pnpm run test:e2e:smoke` (job separato)

Legacy / opzionale — pipeline `ci-fe.yml` se usata:

Gate bloccanti:

1. `pnpm run check:panels`
2. `pnpm run test:panels`
3. `pnpm run test:lint:core`
4. `pnpm run build`
5. `pnpm run test:coverage:core`
6. `pnpm exec playwright test e2e/core --project=chromium`

Coverage threshold (core, allineate a `vitest.core.config.ts`; include esteso a api, auth, clients, apartments, requests, projects, calendar, releases, customer-portal, workflows, settings, prices, integrations, product-discovery, customer360):

- `lines >= 46`
- `statements >= 46`
- `functions >= 24`
- `branches >= 55`

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
