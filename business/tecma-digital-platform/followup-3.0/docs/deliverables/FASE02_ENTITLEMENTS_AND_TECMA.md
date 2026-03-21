# Fase 0.2 — Entitlement commerciale, vetrina connettori, console Tecma

Spec in [PIANO_GLOBALE_FOLLOWUP_3.md](../PIANO_GLOBALE_FOLLOWUP_3.md) §5.

## Regola unica

`canUseFeature = isEntitled(workspace, feature) AND hasPermission(user, action)`.

## Tecma Admin (codice)

`system_role === "tecma_admin"` **oppure** `isTecmaAdmin === true` — riusare `requireTecmaAdmin` / stesso check in FE.

## Modello dati (suggerito)

`tz_workspace_entitlements` o blocco su workspace: capability (`twilio`, `publicApi`, …), stato (`inactive` | `pending_approval` | `active` | `suspended`), `billingMode: manual_invoice`, note, audit.

## UX non Tecma (checklist `connectors-showcase-ux`)

- Vetrina: benefici, casi d’uso, CTA “Richiedi attivazione / Contatta Tecma”.
- Nessuna attivazione autonoma; niente superfici API operative.

## UX Tecma Admin (checklist `tecma-activation-audit`)

- Console attivazione/disattivazione capability.
- Audit: chi, quando, prima/dopo, motivazione.
- Note fatturazione manuale.

## Rollout

1. `twilio` + `publicApi`
2. Poi email marketing (`mailchimp`, `activecampaign`)
3. Feature flag per rollback

## Stato repo (implementazione incrementale)

| Data | Cosa |
|------|------|
| 2026-03-21 | Collection **`tz_workspace_entitlements`** (indice unico `workspaceId`+`feature`). Servizio `workspace-entitlements.service`: assenza riga ⇒ **entitled** (compatibilità). `GET /workspaces/:id/entitlements` (`settings.read` + accesso workspace) restituisce elenco effettivo; `PATCH .../entitlements/:feature` (**solo Tecma admin**) + audit `workspace.entitlement.updated`. Enforcement: **`/v1/platform/*`** dopo API key verifica **`publicApi`**; invio **Twilio** (gateway + `sendWhatsAppMessage`) verifica **`twilio`**. OpenAPI + `followupApi.getWorkspaceEntitlements` / `patchWorkspaceEntitlement`. |
| 2026-03-21 | **Enforcement aggiuntivo:** `createPlatformApiKey` / `rotatePlatformApiKey` richiedono entitlement **`publicApi`**; **`saveWhatsAppConfig`** (Twilio) richiede **`twilio`**. **FE Integrazioni:** `IntegrationsPage` carica entitlement; tab **API** banner + disabilita crea/ruota se `publicApi` assente; drawer **Twilio** alert + disabilita salva/prova se `twilio` assente (revoca consentita). |
| 2026-03-21 | **Console Tecma (FE):** sezione `tecmaEntitlements` (`/tecma/entitlements`), visibile solo se `isTecmaAdmin` nel JWT; `GET`/`PATCH` entitlement sul workspace header. **Vetrina:** alert su Integrazioni + footnote su card connettori (Twilio, Mailchimp, ActiveCampaign, Looker) se modulo non attivo. **Marketing automation (BE):** creazione workflow, enqueue ed esecuzione step rispettano entitlement **mailchimp | activecampaign** (almeno uno). Persistenza `isTecmaAdmin` in `projectScope` + sync da `/auth/me`. |
| 2026-03-21 | **Catalogo** `workspace-feature-catalog.ts` (default per assenza riga + inclusione in `GET /workspaces/:id` → `features`). Chiavi UI: `aiApprovals`, `reports`, `integrations`. Enforcement route intelligence (report/AI), connettori, automazioni, comunicazioni, webhook. `GET /workspaces` elenco completo per Tecma admin; `GET .../entitlements` con `requirePermissionOrTecmaAdmin`. Console Tecma: selettore workspace + wiring `isTecmaAdmin` in `App`/`PageTemplate`/`CommandPalette`. Runbook deploy: `docs/plans/DEPLOY_ENVIRONMENTS.md`. |

**Prossimi passi:** affinare copy/CRM link su “contatta Tecma”; eventuale lettura **note** entitlement lato GET per Tecma admin; altre route da gate-are se compaiono integrazioni reali Mailchimp/AC.

## Matrice route ↔ feature e checklist release

- Matrice centralizzata (chiavi, default, UI, API, note sicurezza): [WORKSPACE_ENTITLEMENTS_MATRIX.md](../plans/WORKSPACE_ENTITLEMENTS_MATRIX.md)
- Checklist pre-release (test, console Tecma, smoke API): sezione *Checklist pre-release* nello stesso file.

## Test automatici (hardening)

- Middleware entitlement: `be-followup-v3/src/routes/workspaceEntitlementMiddleware.test.ts`
- HTTP stack JWT + permessi + 403 (report / integrazioni): `be-followup-v3/src/routes/v1/entitlement-routes.http.test.ts`
- HTTP accesso console API entitlement (`GET`/`PATCH` `/workspaces/:id/entitlements`): `be-followup-v3/src/routes/v1/workspaces-entitlements-access.http.test.ts`
- HTTP filtro elenco workspace (no leak lista globale a utente membership): `be-followup-v3/src/routes/v1/workspaces-list-filter.http.test.ts`
- HTTP creazione workspace (`POST /workspaces`, solo admin): `be-followup-v3/src/routes/v1/workspaces-create.http.test.ts`
- Regressione opt-in catalogo (`defaultEntitledWhenNoRow: false` simulato): `be-followup-v3/src/core/workspaces/workspace-entitlements.optin-catalog.test.ts`
- E2E Playwright (console / accesso negato / smoke API opzionale): `fe-followup-v3/e2e/entitlements.spec.ts`
