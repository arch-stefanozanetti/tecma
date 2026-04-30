# CI e test gate — Followup 3.0

Documento di riferimento **unico** per cosa blocca il merge su `main` e cosa resta periodico o manuale.  
Workflow principale: [`.github/workflows/followup-3.0-ci-cd.yml`](../../../../.github/workflows/followup-3.0-ci-cd.yml) (repo root `tecma`).

---

## Cosa blocca il merge (obbligatorio su PR/main)

| Area | Step CI | Comando / nota |
|------|---------|------------------|
| **FE — kernel** | `Run core coverage gate (FE)` | `pnpm run test:coverage:core` — coverage 100% su file kernel in [`vitest.core.config.ts`](../fe-followup-v3/vitest.core.config.ts) (intenzionalmente ristretto: lib/auth scope). |
| **FE — unit estesa** | `Run full unit suite (FE)` | `pnpm run test:run:ci` — tutti i test sotto `src/**/*.{test,spec}.{ts,tsx}` con pool `forks` per stabilità in CI. |
| **FE — build** | `Run deploy build (FE)` | `scripts/render-build-fe.sh` (parità con Render). |
| **BE — unit** | `Run tests (BE)` | `npm run test` con `MONGO_URI` / `MONGO_DB_NAME` di test. |
| **BE — integrazione** | `Run integration tests (BE)` | `npm run test:integration` — ogni file usa **MongoDB in-memory** (`mongodb-memory-server`); **nessun** container Mongo in CI; `NODE_OPTIONS=--max-old-space-size=4096` per stabilità. |
| **BE — coverage core** | `Run core coverage gate (BE)` + soglie | `vitest.core.config.ts --coverage` + `check-core-coverage.mjs`. |
| **BE — build** | `Run deploy build (BE)` | `scripts/render-build-be.sh`. |
| **E2E (smoke)** | Job `FE E2E smoke (Playwright)` | [`e2e/smoke.spec.ts`](../fe-followup-v3/e2e/smoke.spec.ts) + [`e2e/integrations-oauth-popup-drawer-webhook.smoke.spec.ts`](../fe-followup-v3/e2e/integrations-oauth-popup-drawer-webhook.smoke.spec.ts), Chromium; avvio dev server via `PLAYWRIGHT_USE_WEBSERVER=true`. |

Se uno di questi step fallisce, la PR non va considerata “verde” per followup 3.0.

---

## Gate paralleli (stesso repo, altri path)

| Workflow | Scopo |
|----------|--------|
| [`followup-3.0-security.yml`](../../../../.github/workflows/followup-3.0-security.yml) | Semgrep, OSV, Trivy, aggregazione — **DevSecOps** (non sostituisce pentest). |
| [`followup-3.0-production-verify.yml`](../../../../.github/workflows/followup-3.0-production-verify.yml) | Dopo merge su `main`: smoke HTTP su BE/FE Render + controlli leggeri (vedi sotto). |

---

## Non bloccanti su ogni PR (periodici o on-demand)

| Attività | Quando | Riferimento |
|----------|--------|-------------|
| **Mutation testing (Stryker)** | Manuale / release | `be-followup-v3`: `npm run test:mutation:critical` |
| **E2E estesi** (core, enterprise, visual, a11y) | Locale o job dedicato | `fe-followup-v3`: `test:e2e`, `test:e2e:core`, `test:visual`, `test:a11y` |
| **Pentest** | Ciclo annuale / major release | [PENTEST_EXECUTION.md](PENTEST_EXECUTION.md), [PENTEST_VENDOR_HANDOFF.md](PENTEST_VENDOR_HANDOFF.md) |
| **Load test** | Staging, prima di scale | [LOAD_TEST.md](LOAD_TEST.md) |
| **Lighthouse PWA / bundle budget** | Manuale o cron | `check:bundle-budget`, `check:lighthouse-pwa` |

---

## Post-deploy produzione (automatico)

Il workflow **Production Verify** (dopo push su path followup):

1. Attende il rollout Render.
2. **BE:** `GET .../v1/health` → HTTP 200 e JSON con `"ok": true`.
3. **FE:** `GET` home → HTTP 200.
4. **API auth:** `GET .../v1/auth/me` senza header → HTTP **401** (verifica che l’API risponda e rifiuti richieste non autenticate).

Opzionale (secret `FOLLOWUP_SMOKE_BEARER_TOKEN`): se configurato, si può estendere in futuro con una chiamata autenticata — non è richiesto per il gate minimo.

---

## Allineamento con altri documenti

- [ACCEPTANCE_GATES.md](ACCEPTANCE_GATES.md) — visione “release enterprise”; aggiornare i riferimenti ai workflow se i path `ci-be` / `ci-fe` differiscono dal workflow unificato `followup-3.0-ci-cd.yml`.
- [DOCS_CI_CD.md](DOCS_CI_CD.md) — panoramica monorepo e deploy Render.

---

## Note FE: kernel vs suite intera

Il gate **`test:coverage:core`** copre solo i file kernel elencati in `vitest.core.config.ts` (pochi file, secondi).  
Il gate **`test:run:ci`** esegue **tutta** la suite Vitest nel frontend: è il complemento necessario per considerare coperta la logica UI/test oltre il kernel.

## Note BE: voce ZEUS

Per i webhook voce sono inclusi test unitari/route mirati:

- `src/core/zeus/twilio-signature.util.test.ts`
- `src/core/zeus/twilio-voice-ingress.service.test.ts`
- `src/routes/zeus-webhook.routes.test.ts`
