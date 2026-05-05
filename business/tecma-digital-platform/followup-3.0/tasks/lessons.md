# Lessons (agent / team)

## 2026-05-05 — POC-plus delivery a 3 milestone sequenziali

- **Correzione utente:** consegnare RBAC users / Workspaces avanzati / Project Detail in **3
  milestone sequenziali**, ogni branch corto, merge in `main` e cleanup prima della prossima.
  Non aprire branch in parallelo con scope misti.
- **Pattern:** `feat/<area>-poc-plus` -> full pyramid (unit + integration + contract + e2e + security)
  -> OpenAPI `pnpm openapi:generate` -> aggiornare `tests/contract/openapi-routes.contract.test.ts`
  con il nuovo `operationCount` -> merge `main` -> `git branch -d <branch>` -> ADR/docs se
  introduce decisioni architetturali.

## 2026-05-05 — Fastify DELETE senza body NON deve avere `content-type: application/json`

- **Sintomo:** integration test con DELETE che includono `content-type: application/json` e body
  vuoto restituiscono 500 con `FST_ERR_CTP_EMPTY_JSON_BODY`.
- **Pattern:** introdurre `authHeadersNoBody(token)` che omette `content-type` ed usarlo per le
  DELETE inject. Vale anche per inject di test con body assente in `assets`/`workspaces` advanced.

## 2026-05-05 — `MongoRepository` typing vs id come stringa

- **Sintomo:** repository M3 con `_id: string` vs `MongoRepository<Record<string, unknown>>`
  che inferisce `_id: ObjectId` -> errori `TS2322 Condition<ObjectId>` su `findOne`/`updateOne`.
- **Pattern:** quando l'`_id` è gestito come UUID stringa per le sezioni Project Detail, fare
  cast esplicito `as any` sul filter (`{ _id: id } as any`) o tipizzare il repo con `unknown` e
  documentare nel modulo. Non re-introdurre `ObjectId` "cosmetico" su collection POC-style.

## 2026-05-05 — Branch lifecycle obbligatorio (no branch backlog)

- **Correzione utente:** se una lavorazione è finita, deve andare subito su `main` e il branch funzionale va chiuso (delete locale/remoto o archive esplicito), senza accumulo di branch vecchi.
- **Pattern operativo fisso:** branch corto -> test/gate -> merge `main` -> cleanup immediato branch. Non aspettare reminder utente.

## 2026-05-05 — Branch cleanup: scope chiuso, push frequente, delete dopo merge

- **Sintomo:** un singolo branch `chore/baseline-cleanup-and-workspace-fix` con 8 aree mescolate (RBAC, audit, error contract, mail, support UI, repo di dominio, shared-types, OpenAPI) e 4 commit non pushati su `main`. Branch laterali `develop`/`demo` morti (172/182 commit dietro). 8+ branch funzionali vecchi non mergeati. Caos di review e rischi di drift.
- **Pattern:** un branch tocca **una sola area** alla volta; pushare almeno 1×/giorno; dopo merge **eliminare** locale + tutti i remote subito (con tag `archive/<branch>-<YYYY-MM-DD>` se il branch ha commit unici). Long-lived `prod/demo/dev` vanno **resettati o tenuti vivi via deploy reali**, non lasciati alla deriva. Vedi [`docs/branching-policy.md`](../docs/branching-policy.md) e [`docs/branches-parking-2026-05-05.md`](../docs/branches-parking-2026-05-05.md).
- **Automation:** mantenere un job periodico CI su GitLab per segnalare branch >30gg e imporre cleanup post-merge nel flusso operativo.
- **Doppio remote:** GitLab `main` può avere branch protection che blocca force push; usare un branch sync `sync/from-main-<YYYY-MM-DD>` come canale operativo o sbloccare la protection da UI.

## 2026-04-30 — Greenfield strict: niente codice legacy in repo attivo

- **Correzione utente:** followup-3.0 deve contenere solo stack greenfield (`apps/web`, `services/api`, `packages/*`) senza copie operative del backend/frontend legacy o cartelle POC spillover.
- **Pattern:** se emergono directory legacy o riferimenti runtime a vecchi moduli fuori scope, fermarsi e fare pulizia strutturale prima di nuove feature.

## 2026-04-30 — Post-login: /auth/me richiede x-api-key, POST login no

- **Problema:** dopo login OK l’utente non vedeva la pagina workspace perché `GET /auth/me` falliva (senza `VITE_API_KEY`) → `authStatus=fail` → redirect al login.
- **Pattern:** passare `user` dal body di POST login come `initialProfile` per mostrare subito ProjectAccessPage; se `/auth/me` fallisce solo per api key, non invalidare sessione — banner + istruzioni env.

## 2026-04-30 — Login locale: niente “utenza demo” come default reale

- **Correzione:** non presentare `demo@tecma.test` / password da seed come credenziali di lavoro: sono solo default dello **script di seed** e dei **test Vitest**. In chat e in README va chiarito che il login usa **`tz_users` del Mongo reale** (`MONGO_DB_NAME`).
- **Pattern:** README + `dev-servers.mdc` + header `seed-dev-user.mjs` esplicitano “utenti reali nel DB”; seed opzionale solo per DB vuoto.

## 2026-04-30 — `followup-3.0/` vs `followup-3.0-POC/`: due progetti, non “promozione”

- **Correzione:** non descrivere un flusso obbligato “porta la feature da `followup-3.0/` alla POC”. Sono **codebase distinti** nello stesso monorepo; Render punta alla POC per **config dei servizi**, non come destinazione del lavoro sull’altro albero.
- **Pattern:** documentare in `FOLLOWUP_MONOREPO_LAYOUT.md`; non suggerire merge/cherry-pick verso POC salvo richiesta esplicita.

## 2026-04-30 — Login dev: CORS porta FE e font Tailwind preflight

- **Problema:** `CORS_ORIGINS` di default elencava solo `http://localhost:5177` mentre Vite girava su altra porta (es. 5179); con `VITE_API_BASE_URL=http://localhost:8080/v1` il browser bloccava il preflight → `TypeError: Failed to fetch` (non un bug di `fetch` nel TS).
- **Pattern:** in `NODE_ENV=development` consentire qualsiasi `http://localhost/*` (e 127.0.0.1) in CORS; in alternativa usare `VITE_API_BASE_URL=/v1` e il proxy Vite (stesso origin, niente CORS). Documentare in `.env.example`.
- **Font:** Tailwind preflight usava lo stack `sans` di default (`ui-sans-serif`); sovrascrivere `theme.extend.fontFamily.sans` con `var(--body-font)` + Lato e `html { @apply font-sans; }` così tutta la pagina non cade sul sistema.

## 2026-04-08 — Priorità prodotto solo nel repo Followup

- **Problema:** suggerire Jira/etichette esterne per A/B/C non risponde al bisogno di tracciare e implementare tutto _dentro_ `followup-3.0`.
- **Pattern:** backlog e stato in issue tracker del team o board interna; link dalla documentazione in `docs/` dove serve tracciabilità.

## 2026-04-08 — Matching score non costante

- **Problema:** `matching.service.ts` usava `DEFAULT_SCORE = 80` per ogni candidato; la UI mostrava sempre 80.
- **Pattern:** calcolare score 0–100 da segnali reali (stesso progetto, interesse esplicito, budget vs `rawPrice`, stato immobile, prossimità mq alla mediana del progetto) e test unitari sulle funzioni pure in `matching-score.util.ts`.

## 2026-03-21 — Test HTTP Vitest / supertest

- **Problema:** `request(app)` con supertest può causare `ECONNRESET` sotto esecuzione parallela dei file di test.
- **Pattern:** un solo `app.listen(0, '127.0.0.1')` per suite (`beforeAll` / `afterAll`) e richieste con `request(origin)` — helper server stabile localizzato nel package API canonico.

## 2026-03-21 — CI dependency audit

- **Runtime:** gate bloccante su advisory high+ (`npm audit --omit=dev` BE, `pnpm audit --prod` FE).
- **DevDependencies:** step audit completo in CI con `continue-on-error: true` per visibilità senza bloccare la PR; tracciare eccezioni nel runbook o in issue.

## 2026-03-26 — Workflow CRUD completeness

- **Problema:** implementata CRUD parziale del workflow engine (stati/transizioni) senza `DELETE` del workflow root.
- **Pattern:** quando si espone CRUD per graph/state machine, verificare sempre i 4 livelli: root workflow, states, transitions, bindings/overrides; aggiungere checklist di completezza prima di chiudere task.

## 2026-03-27 — Legacy config UX (no JSON)

- **Problema:** sezioni legacy complesse rese modificabili ma ancora esposte come textarea JSON, non adatte a utenti non tecnici.
- **Pattern:** per configurazioni business/admin usare sempre form strutturati + editor visuale annidato; per campi HTML usare WYSIWYG riusabile (stile `EmailRichEditor`) invece di input raw.
