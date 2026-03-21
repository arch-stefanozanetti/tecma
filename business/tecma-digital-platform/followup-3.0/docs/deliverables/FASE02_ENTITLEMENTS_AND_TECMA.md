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

**Prossimi passi:** UI vetrina (non-Tecma) + console Tecma; enforcement su altre route (es. creazione chiavi platform solo se `publicApi`); `mailchimp` / `activecampaign` quando esistono le integrazioni.
