# Performance test (k6)

- **Script:** `basic.js` — poche richieste, soglia latenza p95 < 500ms.
- **Comando:** `npm run test:performance` (dalla root del progetto).

**Requisito:** [k6](https://k6.io/docs/get-started/installation/) deve essere installato (es. `brew install k6`). Il backend deve essere avviato (`npm run dev:be`) prima di eseguire il test.

Variabile opzionale: `BASE_URL` (default `http://localhost:8080`).
