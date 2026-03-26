# Migrazione legacy → workspace Progedil (nota tecnica)

**Data:** 2026-03-26  
**Workspace:** `progedil` (`69b4251c1638eb7ef78bc988`)  
**Mapping:** [`../legacy-progedil-workspace-mapping.json`](../legacy-progedil-workspace-mapping.json)  
**ETL:** `be-followup-v3/scripts/migration/migrate-legacy-pilot.ts`  
**Policy GDPR clienti:** `GDPR_MODE=require_any_consent` (nessun cliente saltato nel run live)

## Inventario pre-migrazione

File CSV: [`progedil-inventory-pre-migration.csv`](progedil-inventory-pre-migration.csv)

Confronto legacy (`asset.apartments_view`, `client.clients`, `asset.quotes`, `client.requests`) vs `test-zanetti` (`tz_*` con `workspaceId` Progedil e stessi `projectId`): **totali già allineati** prima del run (delta appartamenti 0 a livello aggregato). L’esecuzione ETL resta necessaria per **upsert** coerente di progetti, policy/branding, utenti workspace e ricalcolo chiavi di migrazione.

## Run ETL

| Fase | runId | dryRun |
|------|-------|--------|
| Dry-run | `progedil-etl-dry-1774556072` | true |
| Live | `progedil-etl-live-1774556090` | false |

Report JSON: [`progedil-etl-dry-1774556072.json`](progedil-etl-dry-1774556072.json), [`progedil-etl-live-1774556090.json`](progedil-etl-live-1774556090.json)

### Contatori run live (estratto)

- Progetti: 22  
- Utenti legacy collegati: 71 upsert  
- Clienti: 951 (0 saltati GDPR)  
- Appartamenti: 1976  
- Preventivi: 44  
- Richieste/trattative: 32  

### Verifica post-migrazione (DB `test-zanetti`, filtro 22 `projectId` Progedil)

| Collezione     | Count |
|----------------|-------|
| `tz_apartments` | 1976 |
| `tz_clients`    | 951  |
| `tz_quotes`     | 44   |
| `tz_requests`   | 32   |

## UI

Le liste usano `workspaceId` + `projectId ∈ selectedProjectIds`. Se in topbar non risultano tutti i progetti selezionati, le liste possono apparire vuote anche con dati presenti. Dopo il reset scope al cambio workspace (frontend), selezionare **All projects** o verificare `followup3.projectScope` in storage.

## Limiti env usati

`PROJECT_LIMIT=50`, `APARTMENT_LIMIT=8000`, `CLIENT_LIMIT=8000`, `QUOTE_LIMIT=8000`, `REQUEST_LIMIT=8000`, `USER_LIMIT=3000`
