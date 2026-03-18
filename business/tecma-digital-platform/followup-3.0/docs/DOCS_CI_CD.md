# CI/CD FollowUp 3.0

- **Repo monorepo (root = tecma):** workflow [.github/workflows/followup-3.0-ci-cd.yml](../../../../.github/workflows/followup-3.0-ci-cd.yml).  
  Path che scatenano la pipeline: `fe-followup-v3/**`, `be-followup-v3/**`, `design-system/**`, `render.yaml`, il file workflow stesso.

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
