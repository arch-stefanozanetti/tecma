# Runbook operativo — Keycloak OIDC (Followup 3.0 FE)

Riferimento di progetto: spec [2026-03-24-keycloak-oidc-design.md](../../../../../docs/superpowers/specs/2026-03-24-keycloak-oidc-design.md), piano [2026-03-24-keycloak-implementation-plan.md](./plans/2026-03-24-keycloak-implementation-plan.md).

## Variabili FE (build-time, prefisso `VITE_`)

| Variabile | Ruolo |
|-----------|--------|
| `VITE_KEYCLOAK_URL` | Base URL Keycloak (es. `https://<host>/auth`), senza slash finale. |
| `VITE_KEYCLOAK_REALM` | Realm. |
| `VITE_KEYCLOAK_CLIENT_ID` | Client pubblico (PKCE, nessun secret nel browser). |
| `VITE_KEYCLOAK_REDIRECT_PATH` | Path assoluto sulla stessa origine del FE per la callback (default `/login/keycloak-callback`). Deve essere tra **Valid Redirect URIs** del client in Keycloak. |
| `VITE_KEYCLOAK_SCOPE` | Opzionale (default `openid email profile`). |

Se una tra URL/realm/client manca, `isKeycloakOidcConfigured()` è falso e la callback mostra che Keycloak non è configurato.

## Keycloak Admin — client FE

1. **Client type**: pubblico; **Standard flow** abilitato; **Direct access grants** disabilitati se non servono.
2. **Valid redirect URIs**: per ogni ambiente, includere l’origine completa + path callback, es. `https://<dev1>/app/<canale>/login/keycloak-callback` se la SPA è sotto `base` Vite.
3. **Web origins** (se CORS): aggiungere le origini del FE.
4. Rotazione o problemi: revocare session client-side non basta; in incidente **disabilitare il client** o **ruotare il client_id** e aggiornare la build FE.

## Flusso runtime

1. Login avvia `startKeycloakOidcLogin(backTo)` → PKCE in `sessionStorage`, redirect a Keycloak.
2. Callback route (`KeycloakCallbackPage`) → `exchangeKeycloakAuthorizationCode` (token endpoint Keycloak) → `id_token`.
3. POST backend `sso-exchange` con `id_token` → JWT applicativi (`setTokens`).

## Verifiche rapide

- **Locale**: `pnpm run dev` senza `VITE_KEYCLOAK_*` → aprire `/login/keycloak-callback` → messaggio “non configurato” (comportamento atteso).
- **Unit test**: `pnpm exec vitest run src/auth/keycloakOidc.test.ts src/core/auth/KeycloakCallbackPage.test.tsx`.
- **E2E (senza IdP)**: `pnpm run test:e2e -- e2e/core/keycloak-callback.spec.ts` (con dev server raggiungibile).

## Incidenti tipici

| Sintomo | Azione |
|---------|--------|
| `Sessione SSO scaduta o non valida` | Utente deve ripartire dal login; verificare che non ci siano due tab che consumano lo stesso `state`. |
| `redirect_uri mismatch` | Allineare `VITE_KEYCLOAK_REDIRECT_PATH` + `base` Vite con gli URI registrati in Keycloak. |
| Token senza `id_token` | Verificare scope `openid` e risposta token endpoint. |
| `sso-exchange` 401/403 | JWKS/issuer/audience lato backend e realm Keycloak. |

## Sicurezza

- Nessun client secret nel FE; solo PKCE.
- Evitare open redirect: `backTo` e redirect post-login passano da `postAuthRedirectHref` / path interni (vedi `spaPath.ts`).
