# Piano di implementazione: Keycloak OIDC Followup 3.0

**Riferimenti:** spec [2026-03-24-keycloak-oidc-design.md](../../../../../docs/superpowers/specs/2026-03-24-keycloak-oidc-design.md), branch `origin/cursor/keycloak-identity-provider-b16b`.

## Fase 0 — Decisioni

- [ ] PO: perimetro Keycloak-only (Enterprise only / tutti / nuovi tenant prima).
- [ ] Piattaforma: piano sostituzione BSS per Followup e allineamento gateway.
- [ ] Keycloak: realm, client pubblico FE, redirect URI dev-1/staging/prod.

## Fase 1 — Integrare codice FE (branch)

- [ ] Allineare `feature/keycloak-migration` a `origin/cursor/keycloak-identity-provider-b16b` (fast-forward se possibile).
- [ ] Risolvere conflitti con `main` se il branch diverge dopo merge parziali.
- [ ] `pnpm run typecheck` e `pnpm run test:run` su `fe-followup-v3`.
- [ ] Verificare route `/login/keycloak-callback` con `base` Vite default e con `base` sotto `/app/<canale>/`.

## Fase 2 — Backend e configurazione

- [ ] Popolare `.env` / Render: `SSO_JWKS_URI`, issuer, audience coerenti con Keycloak.
- [ ] Verificare mapping email/sub da id_token Keycloak → `findLegacyUserByEmail` / provisioning utente se necessario.
- [ ] Test manuale: `sso-exchange` con token reale da dev-1.

## Fase 3 — Dev-1 canali

- [ ] Pipeline: build multipla con `VITE_*` e `base` per canale; pubblicazione sotto `/app/<id>/`.
- [ ] Pubblicare `channels.json` (da esempio [channels.manifest.example.json](../channels.manifest.example.json)).
- [ ] UI tendina (shell o integrazione dev-only) — vedi [DEV1_CHANNEL_DEPLOY.md](../DEV1_CHANNEL_DEPLOY.md).

## Fase 4 — QA e sicurezza

- [ ] e2e: flusso login Keycloak felice + errori (config mancante, token invalido).
- [ ] Review PKCE/state; nessun open redirect.
- [ ] Documentare runbook incidenti (revoca client, rotazione realm).

## Fase 5 — Cutover produzione

- [ ] Rimuovere progressivamente `VITE_USE_BSS_AUTH` e login password **solo dopo** decisione prodotto e migrazione utenti.
- [ ] PR finali su `main`; delete branch feature dopo merge ([GIT_WORKFLOW_BRANCHES.md](../GIT_WORKFLOW_BRANCHES.md)).
