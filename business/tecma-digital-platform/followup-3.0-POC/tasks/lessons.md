# Lessons (agent / team)

## 2026-04-30 — Render FE «tutto rotto» + Dockerfile che puntava all’altro progetto

- **Sintomo:** app statica 200 ma login/API no: spesso `VITE_API_BASE_URL` mancante al **build** → default `"/v1"` in `fe-followup-v3/src/api/http.ts` fa chiamare il dominio del FE, non il BE.
- **CORS:** `APP_PUBLIC_URL` sul BE deve includere l’URL del sito statico. Vedi `docs/RENDER_FOLLOWUP_ENV.md`.
- **Docker:** `fe-followup-v3/Dockerfile` e `docker-compose.yml` usavano path `followup-3.0/fe-followup-v3` (monorepo altro progetto) invece di `followup-3.0-POC/...` — build immagine localmente poteva mixare o fallire. Render static usa `scripts/render-build-fe.sh`, non quel Dockerfile, ma in locale andava corretto.

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
