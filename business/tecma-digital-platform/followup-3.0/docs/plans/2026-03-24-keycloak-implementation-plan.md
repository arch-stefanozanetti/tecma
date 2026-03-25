# Piano di implementazione: Keycloak OIDC Followup 3.0

**Riferimenti:** spec [2026-03-24-keycloak-oidc-design.md](../../../../../docs/superpowers/specs/2026-03-24-keycloak-oidc-design.md), branch `origin/cursor/keycloak-identity-provider-b16b`.

## Fase 0 — Decisioni

- [x] PO: perimetro Keycloak-only (Enterprise only / tutti / nuovi tenant prima). _(confermato in spec: obiettivo Keycloak-first, senza doppio flusso permanente)_
- [ ] Piattaforma: piano sostituzione BSS per Followup e allineamento gateway. _(dipendenza organizzativa/backlog cross-team)_
- [ ] Keycloak: realm, client pubblico FE, redirect URI dev-1/staging/prod. _(dipendenza Keycloak Admin)_

## Fase 1 — Integrare codice FE (branch)

- [x] Allineare `feature/keycloak-migration` a `origin/cursor/keycloak-identity-provider-b16b` (fast-forward se possibile).
- [x] Risolvere conflitti con `main` se il branch diverge dopo merge parziali.
- [x] `pnpm run typecheck` su `fe-followup-v3` (verde).
- [x] Verificare test Keycloak FE (`keycloakOidc.test.ts`, `KeycloakCallbackPage.test.tsx`) (14/14 verdi).
- [x] Verificare route `/login/keycloak-callback` con `base` Vite default e con `base` sotto `/app/<canale>/` (redirect/login allineato a `spaAbsolutePath` + test callback/e2e).

## Fase 2 — Backend e configurazione

- [ ] Popolare `.env` / Render: `SSO_JWKS_URI`, issuer, audience coerenti con Keycloak.
- [ ] Verificare mapping email/sub da id_token Keycloak → `findLegacyUserByEmail` / provisioning utente se necessario.
- [ ] Test manuale: `sso-exchange` con token reale da dev-1.

## Fase 3 — Dev-1 canali

- [x] Pipeline: build multipla con `VITE_*` e `base` per canale; pubblicazione sotto `/app/<id>/`. _(documentata in [DEV1_CHANNEL_DEPLOY.md](../DEV1_CHANNEL_DEPLOY.md); esecuzione CI/deploy resta in carico a OPS)_
- [x] Pubblicare `channels.json` (da esempio [channels.manifest.example.json](../channels.manifest.example.json)). _(manifest di esempio e istruzioni in doc; file su host = step di rilascio)_
- [x] UI tendina (shell o integrazione dev-only) — vedi [DEV1_CHANNEL_DEPLOY.md](../DEV1_CHANNEL_DEPLOY.md). _(implementata: `DevChannelPicker` + `VITE_SHOW_DEV_CHANNEL_PICKER`)_

## Fase 4 — QA e sicurezza

- [x] e2e: caso callback con config mancante (`e2e/core/keycloak-callback.spec.ts`) + unit per errori OAuth/state/token exchange.
- [x] Review PKCE/state; nessun open redirect (guardie su `state`, `postAuthRedirectHref` e test dedicati).
- [x] Documentare runbook incidenti (revoca client, rotazione realm): `docs/KEYCLOAK_RUNBOOK.md`.

## Fase 5 — Cutover produzione

- [ ] Rimuovere progressivamente `VITE_USE_BSS_AUTH` e login password **solo dopo** decisione prodotto e migrazione utenti.
- [ ] PR finali su `main`; delete branch feature dopo merge ([GIT_WORKFLOW_BRANCHES.md](../GIT_WORKFLOW_BRANCHES.md)).

## Stato di chiusura tecnica (aggiornato)

- Implementazione FE Keycloak (OIDC + PKCE + callback + `sso-exchange`) completata.
- Verifiche eseguite: `pnpm run typecheck`, unit Keycloak, e2e callback (config assente).
- Residuo non-codice: provisioning Keycloak Admin, allineamento backend/env e decisioni di cutover produzione.
