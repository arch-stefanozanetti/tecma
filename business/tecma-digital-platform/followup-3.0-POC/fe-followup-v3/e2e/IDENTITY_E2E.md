# E2E identity (login / set-password)

## Scelta: mock HTTP in Playwright (consigliato per regressione UI)

Non usiamo MSW nel bundle Vite per gli E2E: **Playwright `page.route()`** intercetta le chiamate verso l’API (stesso pattern di “network stub”).

- **Set-password da invito:** `POST .../auth/set-password-from-invite` → 200 con `accessToken`, `refreshToken`, `user` (vedi `e2e/identity-flow.spec.ts`).
- **Login step 1:** `POST .../auth/login` → 200 consente di arrivare allo step **“Scegli ambiente”** senza backend reale. Il flusso completo post-login (progetti, `/auth/me`, ecc.) richiederebbe ulteriori mock o **docker-compose / staging**.

## Alternative (piano)

| Opzione | Pro | Contro |
|--------|-----|--------|
| **A** Docker / `dev` BE+FE in CI | Contratto reale | Lento, manutenzione ambiente |
| **B** Route mock Playwright (attuale) | Veloce, stabile | Non valida il vero BE |
| **C** Staging + segreti CI | End-to-end reale | Fragile, lento |

Raccomandazione allineata al piano: **test di integrazione BE** (`be-followup-v3` `npm run test:integration`) per il contratto API + **E2E con route mock** per UI critica.
