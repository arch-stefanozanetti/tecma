# Test E2E (Playwright)

Test end-to-end che aprono un browser reale e verificano che l’app non mostri pagina bianca e che login/redirect funzionino.

## Comandi

- **Esegui tutti i test:** `npm run test:e2e`
- **Interfaccia UI (debug):** `npm run test:e2e:ui`

Se il dev server non è già in esecuzione, Playwright lo avvia in automatico (porta 5177).

## Cosa coprono i test

- **auth.spec.ts:** pagina login visibile, form con email e pulsante Accedi, redirect da `/` a `/login` senza token.
- **smoke.spec.ts:** smoke per evitare pagina bianca (contenuto visibile dopo il load).

## CI (GitHub Actions)

Il workflow **FollowUp 3.0 CI Gate** (`.github/workflows/followup-3.0-ci-cd.yml`) esegue il job **FE E2E smoke** dopo il quality gate FE:

- comando: `pnpm run test:e2e:smoke` (solo `e2e/smoke.spec.ts`, Chromium);
- variabili: `CI=true`, `PLAYWRIGHT_USE_WEBSERVER=true` (Playwright avvia il dev server Vite).

Test che richiedono **login reale** o segreti (utente di test, API) non sono nel gate minimo: configurare **GitHub Secrets** (es. `E2E_TEST_USER`, `E2E_TEST_PASSWORD`) solo se aggiungi spec dedicati e leggi le variabili da `process.env` in `playwright.config.ts` o nei test. Non committare credenziali.

## Estendere i test

Per testare il flusso dopo il login (es. selezione progetti, cockpit) serve un backend avviato e credenziali di test (o mock). Puoi aggiungere nuovi file `*.spec.ts` in `e2e/`.
