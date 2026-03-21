# Lessons (agent / team)

## 2026-03-21 — Test HTTP Vitest / supertest

- **Problema:** `request(app)` con supertest può causare `ECONNRESET` sotto esecuzione parallela dei file di test.
- **Pattern:** un solo `app.listen(0, '127.0.0.1')` per suite (`beforeAll` / `afterAll`) e richieste con `request(origin)` — helper `be-followup-v3/src/test/stableHttpServer.ts` (`listenStable`, `closeStable`, `stableRequest`).

## 2026-03-21 — CI dependency audit

- **Runtime:** gate bloccante su advisory high+ (`npm audit --omit=dev` BE, `pnpm audit --prod` FE).
- **DevDependencies:** step audit completo in CI con `continue-on-error: true` per visibilità senza bloccare la PR; tracciare eccezioni nel runbook o in issue.
