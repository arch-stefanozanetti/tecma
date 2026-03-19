# Followup 3.0

Nuovo CRM multi-progetto creato da zero.

**Documentazione:** [docs/README.md](docs/README.md) (indice) · **Piano di riferimento unico (visione e wave):** [docs/FOLLOWUP_3_MASTER.md](docs/FOLLOWUP_3_MASTER.md) · **Modello Request/Deal (Wave 4):** [docs/REQUESTS_MODEL.md](docs/REQUESTS_MODEL.md)

## Componenti
- `be-followup-v3` REST API modulare (solo MongoDB; Supabase rimosso)
- `fe-followup-v3` frontend React/TypeScript

## Design system (Wave 2)
- **Token condivisi (riusabili da più app):** [tecma-digital-platform/design-system](../design-system) — `@tecma/design-system-tokens` con typography, color, radius da DS Figma (Tecma Software Suite).
- **Integrazione attiva in followup-3.0:** `fe-followup-v3` dipende da `@tecma/design-system-tokens`, importa i CSS token in `src/styles.css` e estende `tailwind.config.js` con il tema del pacchetto. Dettagli: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). Piano wave per l’import delle **componenti** Figma: [docs/DESIGN_SYSTEM_COMPONENTS_WAVES.md](docs/DESIGN_SYSTEM_COMPONENTS_WAVES.md).
- **Token/tema locali:** `fe-followup-v3/src/styles.css` (`:root` per override/app-specific) e `tailwind.config.js` (colori, backgroundImage, boxShadow).
- **Regole Figma e convenzioni:** `fe-followup-v3/.cursor/rules/figma-design-system.mdc` (componenti `src/components/ui/`, flusso get_design_context + get_screenshot).

## Sorgenti UX/UI usate
- UX/UI e pattern calendario: `fe-tecma-itd` (stile `PageTemplate`, `SimplePage`, `Calendario`, `GenericTable`)
- Nota: nel workspace corrente `fe-tecma-followup-enterprise` contiene solo README, quindi il riferimento ITD operativo è stato preso da `fe-tecma-itd`.

## Login
- **Accesso:** sulla pagina di login si inseriscono **email e password**; è disponibile il link "Hai dimenticato le credenziali?" (URL configurabile con `VITE_FORGOT_CREDENTIALS_URL`, altrimenti placeholder) e in fondo alla card l’opzione **"Accedi con SSO aziendale"** per il redirect al BusinessPlatform.
- Dopo il login l’utente viene portato alla schermata di **selezione ambiente e progetti**: si sceglie l’ambiente (dev-1 solo per admin, altrimenti demo/prod) e i progetti con cui lavorare; conferma → ingresso in Followup 3.0.
- La sessione è valida se presente token in sessionStorage o cookie `jwt` (SSO). Configura l’URL di login BusinessPlatform con `VITE_BUSINESSPLATFORM_LOGIN`.
- Il flusso è sempre: pagina di login (email/password) → selezione ambiente e progetti → ingresso in Followup 3.0.

**Ambienti (base URL API):** dev-1 → `biz-tecma-dev1`, demo → `biz-tecma-demo-prod`, prod → `biz-tecma-prod` (vedi commenti in `ProjectAccessPage.tsx` per i riferimenti completi).

## Cosa include ora
- Calendario aggregato multi-progetto con UX calendario stile ITD
- Lista clienti avanzata (ispirata Followup)
- Motore lista condiviso replicato su appartamenti
- Prezzi rent+sell normalizzati in un unico dominio (`normalizedPrice`)

## Backend (be-followup-v3)
- **DB**: solo MongoDB (`MONGO_URI`, `MONGO_DB_NAME`). Per ambiente dev-1 usare l’URI del cluster Atlas dev-1.
- **DB operativo (dev):** usare **`MONGO_DB_NAME=test-zanetti`** (o l’equivalente per l’ambiente). I dati dell’app vivono in `client.db(MONGO_DB_NAME)`, non necessariamente nel path dopo l’host nell’URI (es. `...mongodb.net/test` può essere solo default auth DB). Se in passato era impostato `MONGO_DB_NAME=test`, gli utenti potevano finire nel database Atlas **`test`**: per allinearsi, migrare le collection necessarie verso `test-zanetti` (Atlas, `mongodump`/`mongorestore`, o script storico `be-followup-v3/src/utils/unifyMainDb.ts`) e non usare più `test` per Followup finché la migrazione non è verificata.
- **Utenti in `tz_users`:** lo script `cloneUserFromSourceDb` inserisce un utente solo se l’email **esiste già** nella collection utenti del DB sorgente (`SOURCE_MONGO_DB_NAME`). Se un utente non compare in `test-zanetti.tz_users`, controllare anche `test.tz_users` (DB legacy) o invitarlo con **POST /v1/users** / dalla pagina Utenti (**Invita via email**).
- **Email — due contesti:** (1) **Inviti / auth (pagina Utenti):** **`EMAIL_TRANSPORT=smtp`**, **`SES_SMTP_USER`** / **`SES_SMTP_PASS`**, **`EMAIL_FROM`** verificato in SES. Il link “Imposta password” usa **l’URL del browser** da cui inviti (`Origin` o `appPublicUrl` dal FE): in locale → `http://localhost:5177`, su Render → il tuo `*.onrender.com`. **`APP_PUBLIC_URL`** è solo **fallback**. Domini custom: **`INVITE_LINK_ALLOWED_HOSTS`**. Senza SMTP, `POST /v1/users` → **503**. Dev senza SES: **`INVITE_ALLOW_MOCK_EMAIL=true`** + **`EMAIL_TRANSPORT=mock`**. (2) **Comunicazioni CRM** (template/regole comunicazione): **`SMTP_HOST`** + **`SMTP_FROM`** (`src/core/communications/email.service.ts`); opzionali `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. **WhatsApp (Twilio)** si configura per workspace da UI Integrazioni → Comunicazioni; test invio (solo admin): `POST /v1/workspaces/:workspaceId/connectors/whatsapp/test` con body `{ "to": "+39...", "body": "..." }`.
- **Regole comunicazione (es. `client.created` → WhatsApp):** per destinatario **cliente** servono **telefono** (`phone`, formato E.164 consigliato) e/o **email** sul record cliente. L’evento `client.created` porta l’id in `entityId`: il backend lo usa come id cliente per risolvere destinatario e variabili template (`{{client_name}}`, ecc.).
- **Env**: `APP_ENV` opzionale (default `dev-1`), usato per log/label. Deploy = stesso codice, variabili diverse per ambiente.
- **Auth (Wave 6):** JWT access + refresh. Refresh in `tz_authSessions` come **hash SHA-256** (sessioni vecchie con token in chiaro restano valide fino a scadenza). **`/auth/sso-exchange`:** JWT verificato con **`SSO_JWKS_URI`** (IdP) oppure **`SSO_JWT_HS256_SECRET`** (gateway); claim opzionali **`SSO_JWT_ISSUER`**, **`SSO_JWT_AUDIENCE`**. Senza configurazione SSO → 503. **Produzione/staging:** `AUTH_JWT_SECRET` minimo 32 caratteri (fallimento avvio se default debole). CORS: `APP_PUBLIC_URL` + **`CORS_ORIGINS`**. In prod/staging errori 5xx e Zod restituiscono messaggi generici al client.
- **Auth (dettaglio):** Eventi in `tz_authEvents`; [docs/AUTH_AUDIT_POLICY.md](docs/AUTH_AUDIT_POLICY.md). **BSS** (`VITE_USE_BSS_AUTH=true`): login/me/refresh verso gateway, non be-followup-v3.
- **API Gateway**: le API sono pensate per essere esposte come path generici in **TECMA-BSS** (aws-api-gateway). Addizioni OpenAPI da mergiare nello spec BSS: [docs/openapi-tecma-bss-additions.yaml](docs/openapi-tecma-bss-additions.yaml) (integrazione `http://${stageVariables.url}/v1/...`). Piano di unificazione con aws-api-gateway (test, Postman, doc, FE): [docs/archive/plans-2025-2026/2025-03-07-unificazione-api-aws-gateway-followup.md](docs/archive/plans-2025-2026/2025-03-07-unificazione-api-aws-gateway-followup.md).
- **Qualità e test**: DRY (handler centralizzati `handleAsync`/`sendError`), errori HTTP con `HttpError`. Test con Vitest (`npm run test`); ogni nuova logica deve avere test.
- **Job schedulati (worker)**: I job (comunicazioni programmate, marketing automation, retention privacy, riconciliazione MLS) **non** girano nel processo API. Per evitarli su ogni replica, avviare un **worker** separato: `npm run start:worker` (oppure `node dist/job-runner.js`) con le stesse variabili d’ambiente (DB, ecc.). Su Render: servizio **Background Worker** con build come il BE e start command `node dist/job-runner.js`; una sola istanza worker. L’API resta `node dist/server.js`.

## Integrazione con gateway (BSS)

Se l’app è servita con **VITE_API_BASE_URL** verso il gateway (es. `https://api.tecmasolutions.com/biz-tecma-dev1/v1`) si possono usare le API TECMA-BSS. Per l’auth con **single sign-on** sulla piattaforma impostare **VITE_USE_BSS_AUTH=true** nel frontend: il login userà `POST /login` (con project_id), "me" `POST /v1/users/getUserByJWT` e il refresh `POST /v1/auth/refresh-token` del gateway. Dettagli e criteri di scelta: [docs/BSS_INTEGRATION.md](docs/BSS_INTEGRATION.md).

## Avvio 100% in locale

Tutto gira in locale: **nessun gateway né API remote**. Il frontend usa il proxy Vite che inoltra le chiamate `/v1` al backend su `localhost:8080`. **Non serve impostare `VITE_API_BASE_URL`** (il default `/v1` è corretto).

1. **Backend** (terminale 1):
   ```bash
   cd be-followup-v3
   cp .env.example .env
   # Imposta MONGO_URI (es. cluster dev-1 o mongodb://localhost:27017)
   npm install && npm run dev
   ```
2. **Frontend** (terminale 2):
   ```bash
   cd fe-followup-v3
   cp .env.example .env
   corepack enable && corepack prepare pnpm@9.15.9 --activate
   pnpm install && pnpm run dev
   ```
3. **Verifica:**  
   - `curl http://localhost:8080/v1/health` → risposta OK.  
   - Apri **http://localhost:5177** (il FE è in ascolto sulla porta 5177).  
   - Login con le credenziali dell’ambiente (dev-1); la selezione progetti userà il backend locale.

**Oppure un solo comando** dalla root `followup-3.0`:
```bash
npm install
npm run dev
```
(avvia backend e frontend insieme. Prima volta: copia `.env` in `be-followup-v3` e `fe-followup-v3` e esegui `npm install` in entrambe le cartelle.)

### Se backend o frontend non partono

- **Prima volta:** dalla root esegui `npm install`, poi `cd be-followup-v3 && cp .env.example .env && npm install` e `cd fe-followup-v3 && cp .env.example .env && npm install`. Poi dalla root `npm run dev`.
- **Backend non si avvia:** il backend ha bisogno di **MongoDB**. Se in `.env` hai `MONGO_URI=mongodb://localhost:27017`, avvia MongoDB in locale (es. `brew services start mongodb-community` su macOS) oppure usa l’URI di un cluster Atlas (dev-1). Se vedi errori di connessione, controlla che `MONGO_URI` e `MONGO_DB_NAME` in `be-followup-v3/.env` siano corretti.
- **Porte occupate:** backend usa la **8080**, frontend la **5177**. Se qualcosa è già in ascolto, libera la porta o cambia `PORT` nel backend e, se serve, la porta del server in `fe-followup-v3/vite.config.ts`.
- **Verifica:** `curl http://localhost:8080/v1/health` deve rispondere OK; il frontend è su **http://localhost:5177**.

### Backend (dettaglio)
- Test: `cd be-followup-v3 && npm run test` (Vitest). Watch: `npm run test:watch`.
- **API (supertest, senza server):** `npm run test:api` (route `/v1/*` con mock dei servizi).
- **API su AWS API Gateway (smoke):** in produzione/staging le API sono esposte tramite **aws-api-gateway** (TECMA-BSS). Per validare il gateway: `API_GATEWAY_BASE_URL=https://api.tecmasolutions.com/biz-tecma-dev1/v1 npm run test:api:gateway` (dalla root: `npm run test:api:gateway` con la variabile impostata). Se `API_GATEWAY_BASE_URL` non è impostata i test vengono saltati.
- **Integrazioni (DB reale in-memory):** `npm run test:integration` (MongoDB in-memory, servizi clients/requests senza mock).
- Variabili obbligatorie in `.env`: `MONGO_URI` (e i nomi DB se diversi da example). Opzionale: `APP_ENV=dev-1`, `PORT=8080`, `AUTH_JWT_SECRET`, `AUTH_JWT_EXPIRES_IN` (es. `15m`), `AUTH_REFRESH_EXPIRES_DAYS` (default 7).

### Frontend (dettaglio)
- In locale **non** impostare `VITE_API_BASE_URL`: il proxy inoltra `/v1` al backend.
- Per usare le API tramite **API Gateway** (non locale), imposta `VITE_API_BASE_URL` nel `.env` (es. `https://api.tecmasolutions.com/biz-tecma-dev1/v1`). Vedi `.env.example`.
- Test: `cd fe-followup-v3 && npm run test` (watch), `npm run test:run`, `npm run test:coverage`.

## Frontend (fe-followup-v3)
- **Pagina Utenti (admin):** nel foglio **Aggiungi utente a workspace** sono disponibili **Invita via email** (crea utente in `tz_users`, invio mail set-password, poi membership al workspace; serve almeno un progetto nel workspace) e **Già registrato** (solo aggiunta al workspace per chi esiste già in `tz_users`).
- **Architettura e “come aggiungere una feature”:** vedi [fe-followup-v3/ARCHITECTURE.md](fe-followup-v3/ARCHITECTURE.md) — struttura cartelle, dove mettere pagine/API/componenti, uso di **usePaginatedList** (liste paginate) e **useAsync** (azioni async singole) per ridurre duplicazione.
- **Qualità e test:** componenti UI in `src/components/ui/` (Button, Input, PasswordInput, PhoneInput, ButtonGroup, Select, Dialog, ecc.); classi DS condivise in `src/lib/ds-form-classes.ts` (DRY per select/textarea nativi). Test con Vitest + React Testing Library: `npm run test`, `npm run test:run`, `npm run test:coverage`. Ogni nuovo componente UI dovrebbe avere test in `*.test.tsx`/`*.spec.tsx`.
- **CI:** workflow [.github/workflows/ci-fe.yml](.github/workflows/ci-fe.yml) esegue test e build su push/PR che modificano `fe-followup-v3/`.

## API: core CRM vs riusabili

- **Core CRM** — uso dall’app Followup: auth, session, calendar, clienti (completi), appartamenti (CRUD completo), associations, workflows, templates, AI, requests. Queste API servono il flusso operativo del CRM.
- **Riusabili** — adatte a integrazioni esterne (siti web, preventivatori, connettori): **listings** (`POST /v1/apartments/query`, elenco appartamenti con filtri e paginazione) e **lista light clienti** (`POST /v1/clients/lite/query`, per dropdown/integrazioni). Contratto stabile e documentato.
- Dettaglio endpoint riusabili, contratti ed esempi: [docs/API_RIUSABILI.md](docs/API_RIUSABILI.md). Spec OpenAPI: `GET /v1/openapi.json` (con backend avviato); gli endpoint riusabili sono taggati "Riusabili".

## Endpoint principali
- `GET /v1/health`
- `POST /v1/session/projects-by-email`, `GET|POST /v1/session/preferences`
- `POST /v1/auth/login`, `POST /v1/auth/sso-exchange`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, `GET /v1/auth/me`
- `POST /v1/calendar/events/query`
- `POST /v1/clients/query`, `POST /v1/clients/lite/query`
- `POST /v1/requests/query`, `GET /v1/requests/:id` (trattative/richieste unificate rent+sell)
- `POST /v1/apartments/query`, `POST /v1/apartments`, `GET|PATCH /v1/apartments/:id`
- `POST /v1/requests/query`, `GET /v1/requests/:id` (richieste/trattative rent+sell unificate)
- `POST /v1/hc/apartments/query`, `POST|GET|PATCH /v1/hc/apartments`, `/v1/hc/apartments/:apartmentId`
- `POST /v1/associations/apartment-client`, `POST /v1/associations/query`, `DELETE /v1/associations/:id`
- `POST /v1/workflows/complete-flow/preview`, `POST /v1/workflows/complete-flow/execute`
- `POST|PATCH|DELETE /v1/hc-master/:entity`, `/v1/hc-master/:entity/query`, `/v1/hc-master/:entity/:id`
- `GET /v1/templates/configuration`, `PUT /v1/templates/configuration/:projectId`, `POST .../validate`
- `POST /v1/ai/suggestions`, `POST /v1/ai/approvals`, `POST /v1/ai/actions/drafts`, `/query`, `/:id/decision` — **Flussi AI (suggerimenti in Cockpit vs bozze in Approvals):** [docs/AI_FLOWS.md](docs/AI_FLOWS.md)

Payload base per query (session, calendar, clients, apartments, requests, associations, ecc.):
```json
{
  "workspaceId": "dev-1",
  "projectIds": ["project-sell-01", "project-rent-01"],
  "page": 1,
  "perPage": 25,
  "searchText": "",
  "sort": { "field": "updatedAt", "direction": -1 },
  "filters": {}
}
```

OpenAPI locale: `GET /v1/openapi.json` quando il backend è in esecuzione.
