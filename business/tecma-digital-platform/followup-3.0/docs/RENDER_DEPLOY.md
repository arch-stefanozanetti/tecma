# FollowUp 3.0 su Render

Deploy alternativo/complementare a Vercel: backend come **Web Service** (Node), frontend come **Static Site** (Vite). MongoDB resta su **Atlas** (stesse variabili del BE).

---

## 1. Render MCP in Cursor

1. Crea un’**API key** in [Render → Account Settings → API keys](https://dashboard.render.com/settings#api-keys).
2. In **`~/.cursor/mcp.json`**, nel server `render`, sostituisci **`REPLACE_WITH_RENDER_API_KEY`** con la tua chiave (dopo `Bearer ` deve esserci solo il token, senza spazi extra).
3. **Riavvia Cursor**.
4. In chat: *Set my Render workspace to [nome workspace]* (o chiedi di elencare i workspace). Senza workspace attivo molti tool MCP non funzionano.

**Cosa puoi fare via MCP:** elencare servizi, log, metriche, creare risorse (web, static, Postgres, …), aggiornare **solo** le variabili d’ambiente di un servizio. **Non** si possono da MCP: trigger deploy, scale, eliminazione servizi (tranne env).

---

## 2. Blueprint (`render.yaml` in root repo)

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
   - **FE:** lockfile **`pnpm-lock.yaml`**. Build Render: `rm -rf node_modules && corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm install --frozen-lockfile && pnpm run build`. In locale: `pnpm install` / `pnpm run build`. Publish `dist`, rewrite SPA. In `.npmrc` non usare `optional=false` né `omit=optional`.

Il **backend Node** usa **`plan: starter`** (e opz. `region: frankfurt`). Il **frontend static** nel Blueprint **non** ha `region` né `plan`: Render non li supporta su `runtime: static` (CDN globale).

---

## 3. Variabili d’ambiente (BE)

Allineate a [env.ts](../be-followup-v3/src/config/env.ts):

| Variabile | Obbligatorio |
|-----------|--------------|
| `MONGO_URI` | Sì |
| `MONGO_DB_NAME` | Sì |
| `AUTH_JWT_SECRET` | Sì |
| `AUTH_JWT_EXPIRES_IN` | Default in Blueprint |
| `AUTH_REFRESH_EXPIRES_DAYS` | Default in Blueprint |

`PORT` è impostata da Render; non serve sovrascriverla.

---

## 4. CORS

Il BE usa `cors()` senza restrizioni di origine ([server.ts](../be-followup-v3/src/server.ts)): il FE su un altro dominio (es. `*.onrender.com`) può chiamare l’API senza ulteriori modifiche.

---

## 5. Coesistenza con Vercel e CI

La pipeline [.github/workflows/followup-3.0-ci-cd.yml](../../../../.github/workflows/followup-3.0-ci-cd.yml) usa **pnpm** per il FE (`pnpm-lock.yaml`) e **npm** per il BE; deploy su **Vercel** se i secret sono configurati.

- **Solo Render:** disattiva i job deploy Vercel o rimuovi i secret; usa auto-deploy Git su Render (push sul branch collegato).
- **Entrambi:** lascia Vercel per prod e Render per staging, oppure viceversa.
- **Deploy Render da GitHub senza MCP:** [Deploy Hook](https://render.com/docs/deploy-hooks) + `curl` in un job Actions (il Render MCP **non** avvia deploy).

---

## 6. Troubleshooting

- **FE bianco su refresh su route profonde:** verifica che le rewrite SPA in `render.yaml` (`/*` → `/index.html`) siano applicate.
- **401 / rete dal FE:** controlla `VITE_API_BASE_URL` (URL del BE, HTTPS).
- **BE cold start (free):** primo request dopo idle può essere lento.
- **`Cannot find module @rollup/rollup-linux-x64-gnu`:** assicurarsi build FE con pnpm + comando sopra; verificare che `.npmrc` non contenga `optional=false` o `omit=optional`. Se **corepack** su Render fallisse, sostituire nella build con `npm install -g pnpm@9.15.9` prima di `pnpm install`.
