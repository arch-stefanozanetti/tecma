# CI/CD FollowUp 3.0

- **Repo monorepo (root = tecma):** workflow [.github/workflows/followup-3.0-ci-cd.yml](../../../../.github/workflows/followup-3.0-ci-cd.yml).  
  Path che scatenano la pipeline: `fe-followup-v3/**`, `be-followup-v3/**`, `design-system/**`, `render.yaml`, il file workflow stesso.

- **Checklist comandi prima del merge** (locale, allineata a BE/FE/E2E): [README.md § Checklist prima del merge](../README.md#checklist-prima-del-merge).

- **CI nel package `followup-3.0`** (path-filter su cartelle):  
  - Backend: [.github/workflows/ci-be.yml](../.github/workflows/ci-be.yml)  
  - Frontend + E2E Playwright: [.github/workflows/ci-fe.yml](../.github/workflows/ci-fe.yml)  
  Indice workflow: [.github/workflows/README.md](../.github/workflows/README.md).

- **Smoke manuale su staging** (entitlement / Tecma): [STAGING_ENTITLEMENTS_SMOKE.md](STAGING_ENTITLEMENTS_SMOKE.md).

## Cosa fa la pipeline

Solo **integrazione continua**: build + test **frontend** (pnpm) e **backend** (npm). **Nessun deploy** da GitHub Actions.

## Deploy in produzione / staging

**Render** (Blueprint + `render.yaml` in root repo): [RENDER_DEPLOY.md](RENDER_DEPLOY.md).

Push su `main` (o branch collegato al Blueprint) → Render esegue deploy dei servizi definiti nel Blueprint.

## Branch

| Branch   | CI (build + test) |
|----------|-------------------|
| develop  | Ogni push / PR    |
| demo     | Ogni push / PR    |
| main     | Ogni push / PR    |

## Secret GitHub

**Nessun secret obbligatorio** per la pipeline CI attuale.

### Opzionali — smoke API E2E (403 entitlement)

Se nel repository sono definiti questi **repository secrets**, il job `fe-e2e-core` li espone al processo Playwright e il test opzionale in `e2e/entitlements.spec.ts` viene eseguito (altrimenti resta *skipped*):

| Secret | Descrizione |
|--------|-------------|
| `E2E_API_BASE_URL` | Base URL API con suffisso `/v1` (es. `https://api.example.com/biz-tecma-dev1/v1`). |
| `E2E_JWT` | Bearer JWT utente con permesso coerente per la chiamata report usata nel test. |
| `E2E_ENTITLEMENTS_TEST_WORKSPACE_ID` | Workspace in cui i report risultano **non** abilitati a entitlement → atteso `403` + `FEATURE_NOT_ENTITLED`. |

Dettagli: [fe-followup-v3/e2e/README.md](../fe-followup-v3/e2e/README.md). **Fork PR:** GitHub non inietta i secret del repo base nei workflow delle PR da fork; lo smoke API resta saltato in quel caso (comportamento previsto).

## Repo solo followup-3.0 (senza monorepo tecma)

Adatta i path nel workflow (es. `fe-followup-v3/` invece del prefisso lungo) oppure usa [ci-cd-workflow.example.yml](ci-cd-workflow.example.yml) come base.

## Primo push su GitHub

Dalla root del repo:

```bash
git remote add origin https://github.com/TUO_USERNAME/tecma.git
git push -u origin main
```

## Variabili ambiente (deploy)

Per **Render**, vedi [RENDER_DEPLOY.md](RENDER_DEPLOY.md) e `.env.example` di FE/BE.

Riferimento variabili Vite (FE): `VITE_API_BASE_URL`, `VITE_APP_VERSION`, `VITE_USE_BSS_AUTH`, `VITE_BUCKET_BASEURL`, `VITE_BUSINESSPLATFORM_LOGIN`, `VITE_FORGOT_CREDENTIALS_URL`, `VITE_DATA_MODE`, `VITE_GITHUB_RELEASES_REPO`.

## RabbitMQ / Grafana

Non usati da questa pipeline.

## OpenAPI / API Gateway (TECMA-BSS)

Se modificate i contratti esposti tramite **aws-api-gateway** (monorepo TECMA), allineate lo spec nel repo gateway e rispettate il lint **Spectral** (`yarn lint:domain …`) prima del merge, come da policy del team. Il backend Followup implementa il contratto pubblicato, non il contrario.
