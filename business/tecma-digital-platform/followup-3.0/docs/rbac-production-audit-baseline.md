# RBAC / workspaces — baseline POC vs produzione

**POC di riferimento:** `followup-3.0-POC` (sibling del monorepo; es. `be-followup-v3`, `fe-followup-v3`).  
**Target produzione:** monorepo `followup-3.0` (`services/api`, `apps/web`).

La produzione deve **superare** il POC su completezza funzionale, edge case, sicurezza e test — non parity 1:1.

## Inventario gap (sintesi)

| Area | POC / intent | Prod oggi | Gap qualità / funzionale / edge |
|------|----------------|-----------|-----------------------------------|
| Workspace admin | Flussi invito/membri | Route membri usavano `users.write` (non nel JWT base) | **Risolto in prod:** `requireWorkspaceAdminOrOwner` su mutazioni membri/assegnazioni. |
| Creazione progetto | Owner/admin crea nel workspace | `projects.write` bloccava prima del check membership | **Risolto:** `projects.read` + verifica ruolo owner/admin sul workspace. |
| Lista progetti senza `workspaceId` | Non esporre tutto il DB | `findMany({})` per non-Tecma | **Risolto:** solo progetti accessibili (assegnazioni + membership workspace + grant). |
| Grant cross-workspace | Accesso progetto ad altro workspace | `tz_project_access` non in liste/enforce | **Risolto:** fetch lista + `requireCanAccessProject` considerano grant. |
| Invito atomico + mail | POC/email service | POST `/users` globale | **Endpoint** `POST /v1/workspaces/:workspaceId/invitations` + `MailService` (log/SMTP opzionale) + transazione Mongo. |
| Clienti / unità | Apartments, liste filtrate | Non modellato | **Scaffolding:** `GET …/clients` (lista per workspace) come base per ACL future. |
| SSO / audit | Claims coerenti | Parziale | Test integrazione estesi su `GET /v1/projects` senza workspaceId e matrix permessi. |

## Edge case da coprire in test (prioritari)

- Ultimo Tecma admin (già in PATCH user).
- Doppia assegnazione progetto → 409.
- Viewer workspace: lettura progetto via membership workspace; **no** PATCH se solo viewer.
- Grant duplicato / revoca.
- `GET /v1/projects` senza `workspaceId` come utente normale → mai elenco globale.
