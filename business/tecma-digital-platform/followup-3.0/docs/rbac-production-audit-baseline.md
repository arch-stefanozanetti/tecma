# RBAC / workspaces — baseline POC vs produzione

**POC di riferimento:** `followup-3.0-POC` (sibling del monorepo; es. `be-followup-v3`, `fe-followup-v3`).  
**Target produzione:** monorepo `followup-3.0` (`services/api`, `apps/web`).

La produzione deve **superare** il POC su completezza funzionale, edge case, sicurezza e test — non parity 1:1.

## Inventario gap (sintesi)

| Area                               | POC / intent                        | Prod oggi                                             | Gap qualità / funzionale / edge                                                                                       |
| ---------------------------------- | ----------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Workspace admin                    | Flussi invito/membri                | Route membri usavano `users.write` (non nel JWT base) | **Risolto in prod:** `requireWorkspaceAdminOrOwner` su mutazioni membri/assegnazioni.                                 |
| Creazione progetto                 | Owner/admin crea nel workspace      | `projects.write` bloccava prima del check membership  | **Risolto:** `projects.read` + verifica ruolo owner/admin sul workspace.                                              |
| Lista progetti senza `workspaceId` | Non esporre tutto il DB             | `findMany({})` per non-Tecma                          | **Risolto:** solo progetti accessibili (assegnazioni + membership workspace + grant).                                 |
| Grant cross-workspace              | Accesso progetto ad altro workspace | `tz_project_access` non in liste/enforce              | **Risolto:** fetch lista + `requireCanAccessProject` considerano grant.                                               |
| Invito atomico + mail              | POC/email service                   | POST `/users` globale                                 | **Endpoint** `POST /v1/workspaces/:workspaceId/invitations` + `MailService` (log/SMTP opzionale) + transazione Mongo. |
| Clienti / unità                    | Apartments, liste filtrate          | Non modellato                                         | **Scaffolding:** `GET …/clients` (lista per workspace) come base per ACL future.                                      |
| SSO / audit                        | Claims coerenti                     | Parziale                                              | Test integrazione estesi su `GET /v1/projects` senza workspaceId e matrix permessi.                                   |

## Edge case da coprire in test (prioritari)

- Ultimo Tecma admin (già in PATCH user).
- Doppia assegnazione progetto → 409.
- Viewer workspace: lettura progetto via membership workspace; **no** PATCH se solo viewer.
- Grant duplicato / revoca.
- `GET /v1/projects` senza `workspaceId` come utente normale → mai elenco globale.

## Aggiornamento M1 — RBAC matrix + permission overrides

- `PERMISSIONS` esteso al catalogo POC su 13 moduli (`users`, `workspaces`, `projects`, `clients`,
  `apartments`, `quotes`, `calendar`, `marketing`, `settings`, `integrations`, `automation`,
  `audit`, `tecma`).
- `tz_users.permissionsOverride` aggiunto come `string[]` (camelCase). La wildcard `*` resta
  riservata a `tecma_admin`. Il merge runtime (`effective = rolePermissions ∪ override`) avviene
  nel plugin permission e nei JWT claims.
- Nuovi endpoint `GET /v1/rbac/permission-catalog`, `GET /v1/rbac/roles/:roleKey/effective-permissions`,
  `GET /v1/workspace-roles`. Il `PATCH /v1/users/:userId` accetta `permissionsOverride` con
  validazione contro `ALL_PERMISSION_IDS`.

## Aggiornamento M2 — Workspaces avanzati

- Nuove collection `tz_workspace_entitlements`, `tz_workspace_branding`, `tz_workspace_ai_config`,
  `tz_additional_infos`, `tz_assets` con indici dedicati.
- Permission required: `workspaces.write` per branding/AI/additional infos, `workspaces.admin`
  per entitlements; cross-workspace bloccato (403 lookup membership).
- AI key: persistita in chiaro lato Mongo, sempre **mascherata** in lettura via API
  (`maskApiKey`). Mai esposta nei logs.
- Asset module (`tz_assets`) introdotto come prerequisito condiviso per branding workspace e
  progetto. Feature flag `ENABLE_ASSET_UPLOADS` controlla signed URL vs fallback inline base64.

## Aggiornamento M3 — Project Detail POC-plus (11 sezioni)

| Sezione                  | Permission scrittura       | Permission lettura |
| ------------------------ | -------------------------- | ------------------ |
| Identity (PATCH project) | `projects.write` + project access `write` | project access `read` |
| Contacts (PATCH project) | come Identity              | project access `read` |
| Branding                 | project access `admin`     | project access `read` |
| Policies                 | project access `admin`     | project access `read` |
| Marketing settings       | project access `admin`     | project access `read` |
| Workflow settings        | project access `admin`     | project access `read` |
| Email config             | project access `admin`     | project access `read` (smtpPassword sempre mascherata) |
| Email templates CRUD     | project access `admin`     | project access `read` (unique projectId+name) |
| PDF templates CRUD       | project access `admin`     | project access `read` (unique projectId+templateKey) |
| Legacy overrides         | project access `admin`     | project access `read` |
| Connectors discovery     | tutti i membri workspace   | (lookup, stub feature-flagged) |

Audit: ogni mutazione invoca `withAudit` per tracciare `actorUserId`, `projectId`, e patch.
