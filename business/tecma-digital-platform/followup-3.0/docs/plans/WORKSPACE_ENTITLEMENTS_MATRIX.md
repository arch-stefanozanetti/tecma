# Matrice entitlement workspace (Followup 3.0)

Fonte di verità codice: `be-followup-v3/src/core/workspaces/workspace-feature-catalog.ts`, middleware `workspaceEntitlementMiddleware.ts`, route sotto `be-followup-v3/src/routes/v1/`.

| `featureKey` | `defaultIfNoRow` (catalogo) | In `GET /workspaces/:id` → `features[]` | UI (sezione / note FE) | API / file route principali | Note |
|----------------|----------------------------|----------------------------------------|-------------------------|----------------------------|------|
| `publicApi` | consentito (`true`) | no | Integrazioni → tab API (`ApiTab`) | Platform API keys: `workspaces.routes.ts` (crea/ruota/revoca chiavi); `/v1/platform/*` | Enforcement anche a livello servizio gateway |
| `twilio` | consentito | no | Integrazioni → Twilio | `saveWhatsAppConfig`, invio WhatsApp / gateway | |
| `mailchimp` | consentito | no | Integrazioni / marketing | `connectors.routes.ts` (route con `entitledMailchimpForParam`) | |
| `activecampaign` | consentito | no | Integrazioni / marketing | `connectors.routes.ts` (route con `entitledActiveCampaignForParam`) | |
| `aiApprovals` | consentito | sì | Sezione `aiApprovals` (`App.tsx`), nav da `features[]` | `intelligence.routes.ts` — POST/GET su coda AI, suggerimenti, draft | `workspaceIdFromBodyOrQuery` |
| `reports` | consentito | sì | Sezione `reports` | `intelligence.routes.ts` — `POST /reports/:reportType` | Test HTTP: `entitlement-routes.http.test.ts` |
| `integrations` | consentito | sì | Sezione `integrations` | `connectors.routes.ts`, `automation-rules.routes.ts`, `communications.routes.ts`, `webhook-configs.routes.ts` | Param `:workspaceId` o `requireWorkspaceEntitledIfWorkspaceId` (Outlook) |

Console Tecma: `GET/PATCH /workspaces/:id/entitlements` — FE `TecmaEntitlementsPage.tsx`, path `/tecma/entitlements`.

## Checklist pre-release (dev1 → demo → prod)

- [ ] `npm test` backend: tutti verdi (inclusi `workspaceEntitlementMiddleware.test.ts`, `entitlement-routes.http.test.ts`, `workspaces-entitlements-access.http.test.ts`, `workspaces-list-filter.http.test.ts`, `workspaces-create.http.test.ts`, `workspace-entitlements.optin-catalog.test.ts`).
- [ ] Smoke manuale console Tecma: `/tecma/entitlements`, cambio workspace dal select, tabella moduli e stato “Uso consentito” coerente con DB.
- [ ] Utente non Tecma: navigazione diretta a `/tecma/entitlements` → messaggio accesso negato (nessuna modifica entitlement).
- [ ] Smoke API (ambiente reale o staging): `POST /v1/reports/:type` con JWT e `workspaceId` su workspace **senza** entitlement reports attivo → `403` e `code: FEATURE_NOT_ENTITLED` (se si testa disattivazione reale).
- [ ] Verifica runbook variabili: `docs/plans/DEPLOY_ENVIRONMENTS.md`.

## Sicurezza (Tecma-only, accesso workspace, IDOR)

**PATCH `/workspaces/:id/entitlements/:feature`** è protetto da `requireTecmaAdmin`: un admin di workspace senza ruolo Tecma riceve 403; non può alterare righe `tz_workspace_entitlements` altrui. Copertura automatica: `workspaces-entitlements-access.http.test.ts`.

**GET `/workspaces/:id/entitlements`** usa `requirePermissionOrTecmaAdmin(SETTINGS_READ)` e **`requireCanAccessWorkspace("id")`**: il bypass Tecma sul permesso non salta il controllo di accesso al workspace (`canAccess`). Un utente non autorizzato al workspace non ottiene l’elenco entitlement per quell’id (mitigazione IDOR sul parametro `:id`). Stesso file di test verifica 403 senza `settings.read`, bypass Tecma senza permesso, e 403 se `canAccess` è negato.

**GET `/workspaces` (elenco)** in `workspaces.routes.ts`: per utenti con email e **non** `isAdmin` / **non** Tecma, la risposta è filtrata con `listWorkspaceIdsForUser(email)` — niente elenco globale ai soli collaborator. Copertura: `workspaces-list-filter.http.test.ts`.

**Enforcement “report / integrazioni”**: il client deve inviare `workspaceId` (body/query) o `:workspaceId` coerente con il contesto; il backend risolve l’entitlement su quell’id dopo auth e permessi. Non introdurre endpoint che accettano un workspace arbitrario senza `canAccess` + entitlement.

Aggiornare questa matrice quando si aggiunge una nuova riga al catalogo o una nuova route gate-ata.

## Riferimenti

- Design: [2026-03-21-feature-flags-workspace-design.md](./2026-03-21-feature-flags-workspace-design.md)
- Fase consegna: [../deliverables/FASE02_ENTITLEMENTS_AND_TECMA.md](../deliverables/FASE02_ENTITLEMENTS_AND_TECMA.md)
- Smoke staging (manuale): [../STAGING_ENTITLEMENTS_SMOKE.md](../STAGING_ENTITLEMENTS_SMOKE.md)
- E2E: [fe-followup-v3/e2e/README.md](../../fe-followup-v3/e2e/README.md) (Entitlement / variabili opzionali API)
