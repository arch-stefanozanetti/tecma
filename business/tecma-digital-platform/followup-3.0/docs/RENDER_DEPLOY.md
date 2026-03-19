# FollowUp 3.0 su Render

Deploy FollowUp 3.0 su **Render**: backend **Web Service** (Node), frontend **Static Site** (Vite). MongoDB su **Atlas** (stesse variabili del BE).

---

## 1. Render MCP in Cursor

1. Crea un’**API key** in [Render → Account Settings → API keys](https://dashboard.render.com/settings#api-keys).
2. In **`~/.cursor/mcp.json`**, nel server `render`, sostituisci **`REPLACE_WITH_RENDER_API_KEY`** con la tua chiave (dopo `Bearer ` deve esserci solo il token, senza spazi extra).
3. **Riavvia Cursor**.
4. In chat: *Set my Render workspace to [nome workspace]* (o chiedi di elencare i workspace). Senza workspace attivo molti tool MCP non funzionano.

**Cosa puoi fare via MCP:** elencare servizi, log, metriche, creare risorse (web, static, Postgres, …), aggiornare **solo** le variabili d’ambiente di un servizio. **Non** si possono da MCP: trigger deploy, scale, eliminazione servizi (tranne env).

---

## 2. Servizio Docker "tecma" (root)

Se su Render hai un **Web Service** di tipo **Docker** collegato alla root del repo (es. servizio "tecma"), Render si aspetta un **Dockerfile nella root**. In repo è presente **`Dockerfile`** in root che builda il backend FollowUp 3.0 (`be-followup-v3`). Dopo push su `main`, il deploy Docker può completare senza errore *Dockerfile: no such file or directory*.

**Alternativa senza Dockerfile in root:** in Dashboard → servizio → **Settings** → **Build & Deploy** impostare **Root Directory** su `business/tecma-digital-platform/followup-3.0/be-followup-v3`. Render userà il Dockerfile in quella cartella.

---

## 3. Blueprint (`render.yaml` in root repo)

Nel repo **tecma**, alla root, è presente [`render.yaml`](../../../../render.yaml) con due servizi:

| Servizio        | Tipo        | Root Directory |
|-----------------|-------------|----------------|
| `followup-3-be` | Web (Node)  | `business/tecma-digital-platform/followup-3.0/be-followup-v3` |
| `followup-3-fe` | Static site | `business/tecma-digital-platform/followup-3.0/fe-followup-v3` |

**Chi deve fare il Blueprint (non automatizzabile dall’agent):**  
Collegare il repo e il primo deploy richiedono **login su render.com**, **autorizzazione GitHub** e **inserimento dei segreti** (`MONGO_URI`, `AUTH_JWT_SECRET`, …). Nessun tool può farlo al posto tuo senza esporre quei segreti. Con **Render MCP** (API key già in Cursor) puoi invece, *dopo* che i servizi esistono, chiedere in chat di aggiornare env (es. `VITE_API_BASE_URL`) o leggere log — non sostituisce il wizard Blueprint iniziale.

**Primo deploy (tu, ~2 minuti):**

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
2. Collega il repo GitHub `arch-stefanozanetti/tecma` (branch desiderato).
3. Render legge `render.yaml`. Compila le variabili **sync: false** (obbligatorie prima del build):
   - **BE:** `MONGO_URI`, `MONGO_DB_NAME`, `AUTH_JWT_SECRET`
   - **FE:** `VITE_API_BASE_URL` = `https://<nome-be>.onrender.com/v1` (dopo che il BE è live).
4. Ordine: deploy **BE**, poi imposta `VITE_API_BASE_URL` sul **FE** e ridistribuisci il FE se serve.

**Build FE su Render:** prima si compila **design-system** (`npm ci && npm run build` in `../../design-system`), poi nel FE: pnpm install + build. Vedi `buildCommand` completo in `render.yaml`.

**Publish directory (static site):** con `rootDir` = cartella FE, **`staticPublishPath` deve essere `dist`** (solo il nome della cartella, relativo al rootDir). Se imposti il path completo dal root del repo (`business/.../fe-followup-v3/dist`), Render fallisce con *Publish directory … does not exist* perché risolve il path sotto il rootDir, non sotto la root del repo. In **Dashboard → followup-3-fe → Settings** verifica **Publish Directory** = `dist` se dopo un sync Blueprint restasse il valore errato.

Il **backend Node** usa **`plan: starter`** (e opz. `region: frankfurt`). Il **frontend static** nel Blueprint **non** ha `region` né `plan`: Render non li supporta su `runtime: static` (CDN globale).

---

## 4. Variabili d’ambiente (BE)

Allineate a [env.ts](../be-followup-v3/src/config/env.ts):

| Variabile | Obbligatorio |
|-----------|--------------|
| `MONGO_URI` | Sì |
| `MONGO_DB_NAME` | Sì |
| `AUTH_JWT_SECRET` | Sì |
| `AUTH_JWT_EXPIRES_IN` | Default in Blueprint |
| `AUTH_REFRESH_EXPIRES_DAYS` | Default in Blueprint |

`PORT` è impostata da Render; non serve sovrascriverla.

### 3.1 Storage S3 (asset e branding workspace)

Per **upload logo/email header** (branding workspace), **immagini progetto**, **planimetrie** e **documenti cliente** il BE genera URL presigned e scrive su S3. Senza bucket configurato, le chiamate a `GET /workspaces/:id/assets/upload-url` e `POST .../assets` falliscono con *Storage non configurato*.

| Variabile | Obbligatorio | Note |
|-----------|--------------|------|
| `ASSETS_S3_BUCKET` | Per asset/branding | Nome bucket S3. Se assente, il BE usa `EMAIL_FLOW_S3_BUCKET` (stesso bucket degli allegati email). |
| `EMAIL_FLOW_S3_BUCKET` | Alternativa | Usato anche per upload immagini nell'editor email; se impostato, può fare da fallback per asset workspace. |
| `AWS_REGION` | No | Default `eu-west-1`. Impostare se il bucket è in un'altra region. |
| Credenziali AWS | Per upload reali | `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`, oppure IAM role se il servizio gira su AWS. Su Render: **Environment** → aggiungi le variabili (o usa Secret Files). |

**Cosa fare:** in Render → **followup-3-be** → **Environment** aggiungere almeno `ASSETS_S3_BUCKET` (nome del bucket) e le credenziali AWS. Il bucket deve esistere e la policy IAM deve consentire `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` sulla risorsa.

---

## 5. CORS

Il BE usa `cors()` senza restrizioni di origine ([server.ts](../be-followup-v3/src/server.ts)): il FE su un altro dominio (es. `*.onrender.com`) può chiamare l’API senza ulteriori modifiche.

---

## 6. CI GitHub (senza deploy)

La pipeline [.github/workflows/followup-3.0-ci-cd.yml](../../../../.github/workflows/followup-3.0-ci-cd.yml) esegue solo **build + test** (FE con **pnpm**, BE con **npm**). Il deploy è su **Render** (push sul branch collegato al Blueprint).

Opzionale: [Deploy Hook](https://render.com/docs/deploy-hooks) Render + `curl` da Actions se vuoi trigger espliciti oltre all’auto-deploy da Git.

---

## 7. Troubleshooting

- **FE bianco su refresh su route profonde:** verifica che le rewrite SPA in `render.yaml` (`/*` → `/index.html`) siano applicate.
- **401 / rete dal FE:** controlla `VITE_API_BASE_URL` (URL del BE, HTTPS).
- **BE cold start (free):** primo request dopo idle può essere lento.
- **`Cannot find module @rollup/rollup-linux-x64-gnu`:** assicurarsi build FE con pnpm + comando sopra; verificare che `.npmrc` non contenga `optional=false` o `omit=optional`. Se **corepack** su Render fallisse, sostituire nella build con `npm install -g pnpm@9.15.9` prima di `pnpm install`.
- **Build Vite OK ma *Publish directory … does not exist*:** imposta **Publish Directory** su **`dist`** (Dashboard o `staticPublishPath: dist` in `render.yaml`), non il path assoluto dal root del monorepo.
