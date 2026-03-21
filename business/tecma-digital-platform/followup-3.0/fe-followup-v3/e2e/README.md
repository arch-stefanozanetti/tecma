# Test E2E (Playwright)

Test end-to-end che aprono un browser reale e verificano che l’app non mostri pagina bianca e che login/redirect funzionino.

## Comandi

- **Esegui tutti i test:** `npm run test:e2e`
- **Interfaccia UI (debug):** `npm run test:e2e:ui`

Se il dev server non è già in esecuzione, Playwright lo avvia in automatico (porta 5177), salvo che `CI=true` **senza** `PLAYWRIGHT_USE_WEBSERVER=true` (in quel caso avvia il FE manualmente o imposta `PLAYWRIGHT_USE_WEBSERVER=true` nel job).

Su GitHub Actions, il job **fe-e2e-core** esegue `pnpm run test:e2e:ci` = `e2e/core` (include enterprise/detail/core) **più** `e2e/entitlements.spec.ts` in **un’unica** sessione Playwright (un solo avvio del dev server).

### Repository secrets (opzionale, smoke API)

Se nel repo GitHub sono impostati **tutti** i secret `E2E_API_BASE_URL`, `E2E_JWT`, `E2E_ENTITLEMENTS_TEST_WORKSPACE_ID`, il workflow [.github/workflows/ci-fe.yml](../../.github/workflows/ci-fe.yml) li passa al job E2E e lo smoke su backend reale in `entitlements.spec.ts` **non** viene saltato. Se mancano, il test resta *skipped* e la CI resta verde. Sulle PR da **fork** i secret del repo base non sono disponibili → smoke saltato (normale). Documentazione: [docs/DOCS_CI_CD.md](../../docs/DOCS_CI_CD.md).

## Cosa coprono i test

- **auth.spec.ts:** pagina login visibile, form con email e pulsante Accedi, redirect da `/` a `/login` senza token.
- **smoke.spec.ts:** smoke per evitare pagina bianca (contenuto visibile dopo il load).
- **entitlements.spec.ts:** console Tecma `/tecma/entitlements` con API mockate (tabella moduli + cambio workspace); utente non Tecma vede accesso negato; smoke opzionale su API reale.

## Variabili ambiente (E2E)

| Variabile | Uso |
|-----------|-----|
| `PLAYWRIGHT_BASE_URL` | Base URL del FE (default `http://localhost:5177`). |
| `PLAYWRIGHT_USE_WEBSERVER` | `true` / assente: avvio automatico `npm run dev`. In CI spesso `false` se il server è già su. |
| `E2E_API_BASE_URL` | Base API già con prefisso `/v1` (es. `https://staging.example.com/v1`). Solo per lo smoke API in `entitlements.spec.ts`. |
| `E2E_JWT` | Bearer token utente con `reports.read` per lo smoke API. |
| `E2E_ENTITLEMENTS_TEST_WORKSPACE_ID` | Workspace su cui i report sono **disabilitati** a livello entitlement così ci si aspetta `403` + `FEATURE_NOT_ENTITLED`. |

Lo smoke API è **opzionale**: se una delle tre variabili manca, il test viene saltato (non blocca CI). In CI, valorizza i tre **repository secret** omonimi per eseguirlo automaticamente.

## Estendere i test

Per testare il flusso dopo il login (es. selezione progetti, cockpit) serve un backend avviato e credenziali di test (o mock). Puoi aggiungere nuovi file `*.spec.ts` in `e2e/`.
