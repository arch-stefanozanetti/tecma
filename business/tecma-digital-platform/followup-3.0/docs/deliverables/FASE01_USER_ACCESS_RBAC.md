# Fase 0.1 — Utenze e RBAC granulare

Spec completa in [PIANO_GLOBALE_FOLLOWUP_3.md](../PIANO_GLOBALE_FOLLOWUP_3.md) §4.

## Stato implementazione (repo)

| Data | Cosa |
|------|------|
| 2026-03-20 | Registry `PERMISSIONS` esteso (moduli × azioni); `permissions_override` applicato anche se l’utente ha `user.workspaces[]` / membership (JWT da `buildAccessPayloadFromUserDoc`). Test Vitest. |
| 2026-03-20 | `GET /rbac/permission-catalog` + `buildPermissionCatalog()`; mount `GET /workspace-roles` su v1; `followupApi.getPermissionCatalog()`. |
| 2026-03-20 | FE Utenti: matrice checkbox override + `patchAdminUser`; lista `/users` con `permissions_override`; wizard invito/esistente applica override se selezionati. |
| 2026-03-20 | BE: `requirePermission` su route clients/requests/calendar/apartments; builtin collaborator/viewer estesi; merge DB+builtin in `getPermissionsForRole`; `migrate:role-definitions:reconcile`. |
| 2026-03-20 | BE (slice 5+): `requirePermission` su communications, connectors, automation-rules, intelligence; route webhook-configs protette. |
| 2026-03-20 | FE (slice 5+): gate sezioni hub + `PermissionGated` su URL dettaglio cliente/appartamento; `SECTION_REQUIRED_PERMISSION` esteso. |
| 2026-03-20 | FE Integrazioni (slice 5+): CTA in sola lettura / disabilitate in assenza di permesso. |
| 2026-03-20 | Operativo: `yarn migrate:role-definitions:reconcile` per riconciliare ruoli in DB dopo estensioni permessi (ambiente repo; nessun claim di deploy produzione). |
| 2026-03-20 | BE (slice 6): `requirePermission` su `projects.routes` (settings read/update per config progetto), `notifications.routes` (requests read/update), `matching.routes` (clients/apartments read). |
| 2026-03-20 | FE (slice 6): CTA liste Clienti e Trattative (`ClientsPage` / `RequestsPage` + sezioni lista) gated con `hasPermission`. |
| 2026-03-20 | **Chiusura piano 0.1 (RBAC):** mount `assets.routes` + `client-documents.routes` su `v1.ts`; OpenAPI path asset/documenti; test `v1.test`. Sweep `requirePermission` / sessione / contratti / realtime; commenti su `future.routes` / `workflow.routes` non montati. |
| 2026-03-20 | `GET /rbac/roles/:roleKey/effective-permissions` (`users.read`); FE `followupApi.getRoleEffectivePermissions`; wizard Utenti a **4 passi** (workspace+tipo → progetti multi-select → email+ruolo → riepilogo + preset ruolo + matrice override); dopo membership `addWorkspaceUserProject` per ogni progetto selezionato. |
| 2026-03-20 | Audit `auditRecord` su membership workspace (create/update/remove) e su **aggiunta/rimozione** progetto utente (`workspace.user_project.added` / `workspace.user_project.removed`). |
| 2026-03-20 | Estensione piano: **OpenAPI** per `GET /workspace-roles`, `GET /rbac/permission-catalog`, `GET /rbac/roles/{roleKey}/effective-permissions` (tag `rbac`). Audit su **assign/unassign** entità (`workspace.entity.assigned` / `workspace.entity.unassigned`) in `tz_audit_log`. |
| 2026-03-20 | Audit su **platform API keys** (create/rotate/revoke), **PUT AI config** workspace (`workspace.ai_config.updated`, senza segreti in chiaro nel payload), **webhook outbound** (create/update/delete `workspace.webhook_config.*`). |

## Sintesi milestone

1. ~~Wizard creazione utente (workspace → progetti → email/ruolo → permessi).~~ **Fatto** (`UsersPage` + test).
2. ~~Template ruoli: anteprima permessi effettivi + pulsante “Applica preset ruolo agli override”.~~ **Fatto** (allineato a `tz_roleDefinitions` + `GET /workspace-roles`).
3. ~~Matrice modulo × azione~~ da `GET /rbac/permission-catalog` / `buildPermissionCatalog()` — **documentata in FE** (`PermissionOverrideMatrix`).
4. Persistenza additiva su utente; compatibilità `user.workspaces[]` e `tz_workspace_user_projects`.
5. Middleware BE + CTA FE; audit su membership e vincoli progetto-utente (estendibile ad altre mutazioni critiche).

## Definition of Done

Nessun accesso a funzioni non consentite da UI o API; permessi espliciti per azioni sensibili; integrazione FE↔BE per asset/documenti cliente; wizard amministrativo e catalogo permessi coerenti.
