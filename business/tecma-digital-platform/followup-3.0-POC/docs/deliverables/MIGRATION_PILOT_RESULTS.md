# Risultati pilot migrazione legacy -> test-zanetti

Run operativo iniziale verificato: `pilot-live-2026-03-26b`.

Run esteso verificato: `pilot-live-extended-2026-03-26`.

Run di allineamento progetto verificato: `project-alignment-live-2026-03-26`.

## Esito

- Script: `npm run migrate:legacy-pilot`
- Modalita: `DRY_RUN=false`
- Scope limitato: `PROJECT_LIMIT=2`, `USER_LIMIT=5`, `CLIENT_LIMIT=10`, `APARTMENT_LIMIT=10`, `QUOTE_LIMIT=5`, `REQUEST_LIMIT=10`
- Workspace pilot: `69c4f0fe68f2a2ffcd978b5d` (`Migration Pilot`)

## Conteggi scritti su target (query per `migration.runId`)

- `tz_users`: 5
- `tz_clients`: 10
- `tz_apartments`: 10
- `tz_quotes`: 5
- `tz_requests`: 10

### Conteggi run esteso (`pilot-live-extended-2026-03-26`)

- `tz_projects`: 2
- `tz_users`: 148
- `tz_clients`: 161
- `tz_apartments`: 117
- `tz_quotes`: 1113
- `tz_requests`: 610

### Conteggi run allineamento progetto (`project-alignment-live-2026-03-26`)

- `tz_projects`: 2
- `tz_users`: 152
- `tz_clients`: 161
- `tz_apartments`: 117
- `tz_quotes`: 1113
- `tz_requests`: 610

Conteggi correlati workspace:

- `tz_workspace_projects` su workspace pilot: 2
- `tz_workspace_user_projects` su workspace pilot: 6

## Artefatti

- Report JSON: `docs/deliverables/reports/pilot-live-2026-03-26b.json`
- Report markdown: `docs/deliverables/reports/pilot-live-2026-03-26b.md`
- Report JSON (esteso): `docs/deliverables/reports/pilot-live-extended-2026-03-26.json`
- Report markdown (esteso): `docs/deliverables/reports/pilot-live-extended-2026-03-26.md`
- Report JSON (project alignment): `docs/deliverables/reports/project-alignment-live-2026-03-26.json`
- Report markdown (project alignment): `docs/deliverables/reports/project-alignment-live-2026-03-26.md`
- Dry run precedente: `pilot-smoke-2026-03-26b`

## Note tecniche

- Bug intercettato e corretto durante il live pilot: mapping `tz_workspace_user_projects` su `userId` (non `userEmail`) per rispettare indice unico `(workspaceId, userId, projectId)`.
- Allineamento progetto: estesa l'upsert `tz_projects` con campi identita/contatti/tecnici e aggiunto backfill su `tz_project_policies`/`tz_project_branding` quando presenti in legacy.
