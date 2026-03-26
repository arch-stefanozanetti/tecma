# Delta report per progetto (legacy vs test-zanetti)

- Run target: `pilot-live-extended-2026-03-26`
- Workspace target: `69c4f0fe68f2a2ffcd978b5d` (`Migration Pilot`)
- Scope: 2 progetti abilitati nel mapping

## Riconciliazione per entità

| Progetto | clients | apartments | requests | quotes | users_by_project |
|---|---:|---:|---:|---:|---:|
| `arborea` (`5eea2b9cc432923ea39f03ae`) | 54/54 (100.0%) | 50/50 (100.0%) | 92/92 (100.0%) | 678/678 (100.0%) | 38/37 (102.7%) |
| `parco-vittoria` (`5fda1944b80b079c8ef380c0`) | 107/107 (100.0%) | 67/67 (100.0%) | 518/518 (100.0%) | 435/435 (100.0%) | 121/121 (100.0%) |

## Interpretazione

- `clients`, `apartments`, `requests`, `quotes`: copertura 100% sul perimetro migrato.
- `users_by_project` su `arborea` mostra 38/37 (102.7%): c'era almeno un'assegnazione preesistente in `tz_workspace_user_projects` oltre al run corrente.
- Nessun gap quantitativo bloccante per le 4 entità core CRM nel pilot esteso.

## Query usate (sintesi)

- Legacy: group by `project_id` su `client.clients`, `asset.apartments_view`, `client.requests`, `asset.quotes`; users da `user.users` con `$unwind project_ids`.
- Target: group by `projectId` su `tz_clients`, `tz_apartments`, `tz_requests`, `tz_quotes` filtrando `migration.runId=pilot-live-extended-2026-03-26`; users da `tz_workspace_user_projects` per workspace.
