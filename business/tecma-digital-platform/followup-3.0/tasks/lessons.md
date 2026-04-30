# Lessons (agent / team)

## 2026-04-30 — `followup-3.0/` vs `followup-3.0-POC/`: due progetti, non “promozione”

- **Correzione:** non descrivere un flusso obbligato “porta la feature da `followup-3.0/` alla POC”. Sono **codebase distinti** nello stesso monorepo; Render punta alla POC per **config dei servizi**, non come destinazione del lavoro sull’altro albero.
- **Pattern:** documentare in `FOLLOWUP_MONOREPO_LAYOUT.md`; non suggerire merge/cherry-pick verso POC salvo richiesta esplicita.

## 2026-04-30 — Login dev: CORS porta FE e font Tailwind preflight

- **Problema:** `CORS_ORIGINS` di default elencava solo `http://localhost:5177` mentre Vite girava su altra porta (es. 5179); con `VITE_API_BASE_URL=http://localhost:8080/v1` il browser bloccava il preflight → `TypeError: Failed to fetch` (non un bug di `fetch` nel TS).
- **Pattern:** in `NODE_ENV=development` consentire qualsiasi `http://localhost/*` (e 127.0.0.1) in CORS; in alternativa usare `VITE_API_BASE_URL=/v1` e il proxy Vite (stesso origin, niente CORS). Documentare in `.env.example`.
- **Font:** Tailwind preflight usava lo stack `sans` di default (`ui-sans-serif`); sovrascrivere `theme.extend.fontFamily.sans` con `var(--body-font)` + Lato e `html { @apply font-sans; }` così tutta la pagina non cade sul sistema.

## 2026-04-08 — Priorità prodotto solo nel repo Followup

- **Problema:** suggerire Jira/etichette esterne per A/B/C non risponde al bisogno di tracciare e implementare tutto *dentro* `followup-3.0`.
- **Pattern:** stato e checkbox in `tasks/IMPLEMENTATION_TRACKER.md` + link da `docs/plans/`; nessun tool esterno obbligatorio.

## 2026-04-08 — Matching score non costante

- **Problema:** `matching.service.ts` usava `DEFAULT_SCORE = 80` per ogni candidato; la UI mostrava sempre 80.
- **Pattern:** calcolare score 0–100 da segnali reali (stesso progetto, interesse esplicito, budget vs `rawPrice`, stato immobile, prossimità mq alla mediana del progetto) e test unitari sulle funzioni pure in `matching-score.util.ts`.

## 2026-03-21 — Test HTTP Vitest / supertest

- **Problema:** `request(app)` con supertest può causare `ECONNRESET` sotto esecuzione parallela dei file di test.
- **Pattern:** un solo `app.listen(0, '127.0.0.1')` per suite (`beforeAll` / `afterAll`) e richieste con `request(origin)` — helper `be-followup-v3/src/test/stableHttpServer.ts` (`listenStable`, `closeStable`, `stableRequest`).

## 2026-03-21 — CI dependency audit

- **Runtime:** gate bloccante su advisory high+ (`npm audit --omit=dev` BE, `pnpm audit --prod` FE).
- **DevDependencies:** step audit completo in CI con `continue-on-error: true` per visibilità senza bloccare la PR; tracciare eccezioni nel runbook o in issue.

## 2026-03-26 — Workflow CRUD completeness

- **Problema:** implementata CRUD parziale del workflow engine (stati/transizioni) senza `DELETE` del workflow root.
- **Pattern:** quando si espone CRUD per graph/state machine, verificare sempre i 4 livelli: root workflow, states, transitions, bindings/overrides; aggiungere checklist di completezza prima di chiudere task.

## 2026-03-27 — Legacy config UX (no JSON)

- **Problema:** sezioni legacy complesse rese modificabili ma ancora esposte come textarea JSON, non adatte a utenti non tecnici.
- **Pattern:** per configurazioni business/admin usare sempre form strutturati + editor visuale annidato; per campi HTML usare WYSIWYG riusabile (stile `EmailRichEditor`) invece di input raw.
