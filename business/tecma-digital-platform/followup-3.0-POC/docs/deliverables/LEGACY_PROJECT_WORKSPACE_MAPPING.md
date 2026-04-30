# Mapping legacy project -> workspace (pilota)

File macchina usato dallo script ETL: [legacy-project-workspace-mapping.json](./legacy-project-workspace-mapping.json)

## Regola ID adottata

- Strategia: `preserve_legacy_objectid_hex`
- Effetto: `tz_projects._id` nel target usa lo stesso hex string del legacy (`project.projects._id`) per ridurre complessita di join durante il pilota.
- Alternativa supportata: `map_to_new_id` (richiede `targetProjectId` esplicito per ogni riga).

## Workspace target

- Workspace pilota: `Migration Pilot`
- Se `targetWorkspaceId` e vuoto, lo script crea/riusa il workspace per nome.

## Scope iniziale

Sono precompilate righe candidate (incluse quelle a massima frequenza da `client.clients.project_id` e `user.users.project_ids`).
Mettere `enabled: true` solo sui progetti inclusi nel pilot corrente.

## Formato riga progetto

- `legacyProjectId`: ObjectId hex nel DB `project.projects`
- `targetProjectId`: id in `tz_projects`
- `enabled`: filtro pilot
