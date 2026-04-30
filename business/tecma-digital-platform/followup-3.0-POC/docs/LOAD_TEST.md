# Load test (k6)

## Script disponibili

- **load/load.js** — Health check only (10 VU, 30s). Nessuna auth.
- **load/stress.js** — Ramping su health (20→50 VU). Nessuna auth.
- **performance/basic.js** — 2 VU, 5s, health. Nessuna auth.
- **load/load-core.js** — Endpoint core autenticati: `POST /v1/clients/query`, `POST /v1/requests/query`, `POST /v1/apartments/query`. Richiede `AUTH_BEARER`. SLO: p95 query < 700ms, error rate < 1% (allineato a `docs/OBSERVABILITY_SLO.md`).

## Esecuzione su staging

1. Ottenere un token JWT valido per l’ambiente (login su FE o chiamata a `/v1/auth/login`).
2. Esportare le variabili:
   - `BASE_URL` — URL API backend (es. `https://api-staging.example.com`)
   - `AUTH_BEARER` — Token (es. `Bearer <accessToken>` oppure solo `<accessToken>`)
   - `WORKSPACE_ID`, `PROJECT_ID` — (opzionali) workspace e progetto per le query; default `ws1`, `p1`.
3. Eseguire:
   ```bash
   k6 run load/load-core.js
   ```
   oppure dalla root del repo (se esiste): `npm run test:load:core` (da configurare in `package.json` se necessario).

## Metriche e report

- L’output di k6 mostra `http_req_duration` (incl. p95), `http_req_failed`, e i threshold configurati.
- Per report HTML: `k6 run --out json=results.json load/load-core.js` e poi strumenti di analisi k6 (es. k6-reporter) o import in Grafana.
- Su staging, con Prometheus/Observability attiva, confrontare le metriche backend (`followup_http_server_request_duration_ms`, `followup_http_server_requests_total`) con l’output k6 per validare gli SLO (vedi `docs/OBSERVABILITY_SLO.md`).

## Riesecuzione e CI

- I test di load non sono attualmente in CI; vanno eseguiti manualmente su ambiente target (staging) prima di release o su richiesta.
- Per riesecuzione ripetibile: usare gli stessi `WORKSPACE_ID` e `PROJECT_ID` e uno script di setup che ottiene il token (es. login via API e export di `AUTH_BEARER`).
