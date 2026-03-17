# Deploy Followup 3.0 su Vercel

Guida per avere **frontend** e **backend** funzionanti su Vercel (due progetti separati sullo stesso repo). La pipeline CI/CD (GitHub Actions) builda e testa FE + BE e deploya entrambi; vedi [DOCS_CI_CD.md](./DOCS_CI_CD.md) per branch e secret.

---

## Checklist "da zero" (setup iniziale)

1. **Due progetti Vercel** (stesso repo GitHub):
   - **Progetto FE:** Add New Project → Import repo → **Root Directory** = `business/tecma-digital-platform/followup-3.0/fe-followup-v3` → env `VITE_API_BASE_URL` = URL del BE (es. `https://be-followup-v3.vercel.app`) → Deploy.
   - **Progetto BE:** Add New Project → stesso repo → **Root Directory** = `business/tecma-digital-platform/followup-3.0/be-followup-v3` → env obbligatorie (MONGO_URI, MONGO_DB_NAME, AUTH_JWT_SECRET, ecc.) → Deploy.
2. **Secret GitHub** (Settings → Secrets and variables → Actions): `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_FE`, `VERCEL_PROJECT_ID_BE`. Org ID e Project ID da Vercel → progetto → Settings → General (o `vercel link` in locale → `.vercel/project.json`).
3. **Branch:** develop → deploy dev (Preview), demo → deploy demo (Preview), main → deploy prod solo con "Run workflow" (workflow_dispatch). La pipeline fa build + test FE (incluso design-system) e BE, poi deploy di FE e BE.
4. Verifica: `https://<progetto-be>.vercel.app/v1/health` e login/chiamate API dal FE.

---

## 1. Frontend (fe-followup-v3)

### Configurazione progetto Vercel

- **Root Directory:** `business/tecma-digital-platform/followup-3.0/fe-followup-v3`
- **Framework Preset:** Vite (rilevato da `vercel.json`)
- **Build Command:** `npm run build` (da `vercel.json`)
- **Install Command:** `npm ci` (da `vercel.json`)
- **Output Directory:** `dist`

### Variabili d’ambiente

Impostare in Vercel (Settings → Environment Variables) le variabili usate dal frontend, ad esempio:

- `VITE_API_BASE_URL` → URL del backend (es. `https://be-followup-xxx.vercel.app`). Se non impostata, il frontend usa `/v1` (stessa origine); con FE e BE su progetti Vercel separati **va impostata** con l’URL del progetto backend.

### Se il build fallisce con `EBADPLATFORM` / `@rollup/rollup-darwin-arm64`

Su Vercel il deploy può usare **Install Command** dalla dashboard invece che da `vercel.json`. In quel caso:

1. Vai su **Vercel** → progetto → **Settings** → **General** → **Build & Development Settings**.
2. **Install Command:** lascialo **vuoto** (così viene usato `vercel.json`: `npm ci --omit=optional`) oppure imposta esplicitamente: `npm ci --omit=optional`.
3. Salva e rifai il deploy (Redeploy).

In repo sono già presenti: lockfile senza pacchetti darwin, `.npmrc` con `optional=false`, e `config.optional=false` in `package.json` per compatibilità.

### Note

- La dipendenza `file:../../design-system` richiede che il **Root Directory** sia proprio `fe-followup-v3`: in build il repo è completo, quindi `../../design-system` risolve a `tecma-digital-platform/design-system`.
- Dopo il deploy l’app è disponibile su `https://<progetto-fe>.vercel.app`.

---

## 2. Backend (be-followup-v3)

### Configurazione progetto Vercel

- **Root Directory:** `business/tecma-digital-platform/followup-3.0/be-followup-v3`
- **Build Command:** `npm run build`
- **Install Command:** `npm ci`
- Nessun output directory (è un progetto “API” con serverless function in `api/`).

### Variabili d’ambiente (obbligatorie)

Impostare in Vercel tutte le variabili lette da `config/env.ts`:

- `MONGO_URI`
- `MONGO_DB_NAME`
- `MONGO_CLIENT_DB_NAME` (default: `client`)
- `MONGO_USER_DB_NAME` (default: `user`)
- `MONGO_PROJECT_DB_NAME` (default: `project`)
- `AUTH_JWT_SECRET`
- `AUTH_JWT_EXPIRES_IN` (default: `15m`)
- `AUTH_REFRESH_EXPIRES_DAYS` (default: `7`)

Opzionale: `APP_ENV`.

### Comportamento

- Le richieste sono riscritte verso `/api`; l’handler in `api/index.ts` carica l’app Express (da `dist/`) e la invoca.
- L’API è esposta su `https://<progetto-be>.vercel.app/v1/...`.

### Collegare frontend e backend

- Nel progetto **frontend** su Vercel impostare la variabile che definisce la base URL dell’API (es. `VITE_API_BASE_URL`) con l’URL del progetto backend, es. `https://<progetto-be>.vercel.app`.

---

## Riepilogo passi

1. **Frontend:** nuovo progetto Vercel → collega repo → Root Directory = `business/tecma-digital-platform/followup-3.0/fe-followup-v3` → aggiungi env (inclusa URL API quando il backend è pronto) → Deploy.
2. **Backend:** altro progetto Vercel → stesso repo → Root Directory = `business/tecma-digital-platform/followup-3.0/be-followup-v3` → aggiungi tutte le env (MongoDB, JWT, ecc.) → Deploy.
3. Aggiornare nel frontend l’URL del backend con l’URL reale del progetto backend e fare un nuovo deploy del frontend.

Documentazione dettagliata backend: [BACKEND_VERCEL.md](./BACKEND_VERCEL.md).
