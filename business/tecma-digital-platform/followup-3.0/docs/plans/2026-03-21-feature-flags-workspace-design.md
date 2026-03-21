# Design: ambienti + feature per workspace (Followup 3.0)

## Catalogo chiavi (`workspace-feature-catalog.ts`)

| Chiave | default se nessuna riga DB | In `GET /workspaces/:id` → `features[]` | Note |
|--------|----------------------------|----------------------------------------|------|
| publicApi | consentito | no | Enforcement su platform API keys |
| twilio | consentito | no | Enforcement invio WhatsApp / gateway |
| mailchimp | consentito | no | Futuro |
| activecampaign | consentito | no | Futuro |
| aiApprovals | consentito | sì | Nav + route intelligence `/ai/*` |
| reports | consentito | sì | Nav + `POST /reports/:reportType` |
| integrations | consentito | sì | Nav + connettori / automazioni / comunicazioni |

**Opt-in commerciale “strict”:** per una nuova chiave, impostare `defaultEntitledWhenNoRow: false` nel catalogo e migrare i workspace esistenti con righe `active` dove serve.

## Regola effettiva

`canUseFeature = isEntitled(workspace, feature) AND hasPermission(user, action)`.

## Runbook deploy

Vedi [DEPLOY_ENVIRONMENTS.md](./DEPLOY_ENVIRONMENTS.md) (promozione dev1 → demo → prod).

## Matrice operativa e sicurezza

Tabella aggiornata feature ↔ UI ↔ API, checklist pre-release e paragrafo su Tecma-only / IDOR: [WORKSPACE_ENTITLEMENTS_MATRIX.md](./WORKSPACE_ENTITLEMENTS_MATRIX.md).
