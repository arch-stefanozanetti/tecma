# Test E2E (Playwright)

Test end-to-end che aprono un browser reale e verificano che l’app non mostri pagina bianca e che login/redirect funzionino.

## Comandi

- **Esegui tutti i test:** `npm run test:e2e`
- **Interfaccia UI (debug):** `npm run test:e2e:ui`

Se il dev server non è già in esecuzione, Playwright lo avvia in automatico (porta 5177).

## Cosa coprono i test

- **auth.spec.ts:** pagina login visibile, form con email e pulsante Accedi, redirect da `/` a `/login` senza token.
- **smoke.spec.ts:** smoke per evitare pagina bianca (contenuto visibile dopo il load).

## Estendere i test

Per testare il flusso dopo il login (es. selezione progetti, cockpit) serve un backend avviato e credenziali di test (o mock). Puoi aggiungere nuovi file `*.spec.ts` in `e2e/`.
