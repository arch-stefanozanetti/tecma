# Load e stress test (k6)

- **load.js** — 10 VU per 30s (`npm run test:load`).
- **stress.js** — ramping VU per stress test (`npm run test:stress`).

**Requisito:** [k6](https://k6.io/docs/get-started/installation/) installato. Avviare il backend prima (`npm run dev:be`).

Variabile opzionale: `BASE_URL` (default `http://localhost:5060`).
