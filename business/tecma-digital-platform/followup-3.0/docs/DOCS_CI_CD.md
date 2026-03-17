# CI/CD – Tre ambienti (dev, demo, prod)

- **Repo monorepo (root = tecma)**: un solo workflow in root: [.github/workflows/followup-3.0-ci-cd.yml](../../.github/workflows/followup-3.0-ci-cd.yml). Path che scatenano la pipeline: `business/tecma-digital-platform/followup-3.0/fe-followup-v3/**`, `business/tecma-digital-platform/followup-3.0/be-followup-v3/**`, `business/tecma-digital-platform/design-system/**`.
- **Cosa fa la pipeline:** build + test del **frontend** (FE, include design-system come dipendenza) e del **backend** (BE); se tutto passa, deploy di **FE e BE** su Vercel (dev/demo su push, prod solo manuale). Un solo workflow, niente duplicazioni.
- **Repo solo followup-3.0**: usa [docs/ci-cd-workflow.example.yml](ci-cd-workflow.example.yml) copiato in `.github/workflows/ci-cd.yml` (path senza prefisso `business/tecma-digital-platform/followup-3.0/`).

## Branch e comportamenti

| Branch   | Build + test FE + BE | Deploy FE + BE   | Quando                    |
|----------|----------------------|------------------|---------------------------|
| develop  | Sì                   | Dev (auto)       | Ogni push                 |
| demo     | Sì                   | Demo (auto)      | Ogni push                 |
| main     | Sì                   | No (auto)        | Ogni push                 |
| main     | Sì                   | Prod (manuale)   | Solo "Run workflow"       |

- **develop** → deploy automatico di FE e BE su ambiente **dev** (Vercel Preview).
- **demo** → deploy automatico di FE e BE su ambiente **demo** (Vercel Preview).
- **main** → nessun deploy automatico; rilascio **prod** (FE + BE) solo tramite **Actions → Followup 3.0 CI/CD → Run workflow** (e approvazione ambiente `production` se configurata).

## Secret GitHub obbligatori

In **Settings → Secrets and variables → Actions** aggiungi:

| Secret                  | Descrizione |
|-------------------------|-------------|
| `VERCEL_TOKEN`          | Token Vercel (Account Settings → Tokens). |
| `VERCEL_ORG_ID`         | Da Project Settings su Vercel (uguale per FE e BE). |
| `VERCEL_PROJECT_ID_FE`  | Id progetto Vercel **frontend** (Root Directory = .../fe-followup-v3). |
| `VERCEL_PROJECT_ID_BE`  | Id progetto Vercel **backend** (Root Directory = .../be-followup-v3). |

Se avevi già `VERCEL_PROJECT_ID` (solo FE), rinominalo o duplica in `VERCEL_PROJECT_ID_FE` e aggiungi `VERCEL_PROJECT_ID_BE` per il progetto backend. Org ID e Project ID: Vercel → progetto → Settings → General, oppure `vercel link` in locale nella cartella FE o BE e leggi `.vercel/project.json`.

## Ambiente GitHub "production" (opzionale)

Per richiedere un **approval** prima del deploy prod:

1. **Settings → Environments** → New environment → nome `production`.
2. Seleziona **Required reviewers** e aggiungi uno o più reviewer.
3. Nel workflow il job `deploy-prod` usa già `environment: production`, quindi il deploy parte solo dopo l’approvazione.

## Branch (modello standard)

Branch utilizzati: `main` (default, deploy prod manuale), `develop` (deploy dev automatico), `demo` (deploy demo automatico). Feature branch si mergiano in `develop`; hotfix in `main`. Il branch `master` non è più usato.

## Se il progetto non è ancora su GitHub e Vercel

1. **Crea il repo su GitHub**  
   Vai su [github.com/new](https://github.com/new), nome es. `followup-3.0` o `tecma` (se monorepo). Non inizializzare con README se il codice è già in locale.

2. **Aggiungi remote e push** (dalla root del repo, es. `tecma`):
   ```bash
   cd /path/to/tecma
   git remote add origin https://github.com/TUO_USERNAME/NOME_REPO.git
   git push -u origin main
   git push -u origin develop
   git push -u origin demo
   ```

3. **Vercel**  
   [vercel.com](https://vercel.com) → Add New Project → Import il repo GitHub. Imposta **Root Directory** (vedi sezione Vercel sotto). Aggiungi i **Secret** nel repo GitHub (Settings → Secrets → Actions) per la pipeline.

4. **Secret GitHub**  
   Dopo il primo deploy da Vercel (o dopo `vercel link` in locale), prendi Org ID e i due Project ID (FE e BE) e crea il token Vercel; poi in GitHub → Settings → Secrets and variables → Actions aggiungi `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_FE`, `VERCEL_PROJECT_ID_BE`.

## Primo push su GitHub (repo già creato)

Dalla **root del repo** (cartella `tecma`):

```bash
cd /path/to/tecma
git remote add origin https://github.com/TUO_USERNAME/tecma.git
git push -u origin main
git push -u origin develop
git push -u origin demo
```

Se il repo è solo followup-3.0 (repo dedicato), i path nel workflow in root devono usare `fe-followup-v3/` (vedi `docs/ci-cd-workflow.example.yml`).

## Vercel

1. Collega il repo GitHub a Vercel (Import Project) **due volte**: un progetto per il FE, uno per il BE.
2. **Root Directory** (monorepo): progetto FE = `business/tecma-digital-platform/followup-3.0/fe-followup-v3`, progetto BE = `business/tecma-digital-platform/followup-3.0/be-followup-v3`. Repo solo followup-3.0: `fe-followup-v3` / `be-followup-v3` o `.` se la root è già la cartella del progetto.
3. FE: la build usa `vercel.json` in quella cartella (framework Vite, SPA rewrites). BE: Build = `npm run build`, Install = `npm ci`, nessun output directory (API/serverless).
4. Disattiva i deploy automatici da Vercel se vuoi usare solo GitHub Actions per il deploy.

### Variabili d'ambiente Vercel

Impostale in **Project Settings → Environment Variables** (Production / Preview / Development). Non mettere secret in `vercel.json`.

| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `VITE_API_BASE_URL` | Base URL API backend | `https://api-demo.example.com/v1` (preview), `https://api.example.com/v1` (prod) |
| `VITE_APP_VERSION` | Versione app (opzionale, iniettata da CI) | `1.2.3` |
| `VITE_USE_BSS_AUTH` | Usa auth BSS gateway | `true` / `false` |
| `VITE_BUCKET_BASEURL` | Base URL bucket (es. file) | `https://bucket.example.com` |
| `VITE_BUSINESSPLATFORM_LOGIN` | URL login Business Platform | `https://.../login` |
| `VITE_FORGOT_CREDENTIALS_URL` | URL recupero credenziali | `#` o URL |
| `VITE_DATA_MODE` | Modalità dati (mock/real) | `real` in prod |
| `VITE_GITHUB_RELEASES_REPO` | Repo GitHub per release notes (pagina Release) | `owner/repo` |

Per sviluppatori locali: `vercel env pull` nella cartella del progetto (dopo `vercel link`) per scaricare le variabili.

## RabbitMQ / Grafana

Non sono richiesti per questa pipeline. Si aggiungono in seguito solo se servono code di messaggi (RabbitMQ) o dashboard/alerting (Grafana).
