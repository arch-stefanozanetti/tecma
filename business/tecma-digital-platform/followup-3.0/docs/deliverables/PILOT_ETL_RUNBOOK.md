# Runbook — ETL pilota (idempotente) verso `test-zanetti` / DB operativo

**Scopo:** primo carico controllato su **un workspace pilota**, con **ripetibilità** (stesso script due volte → stesso risultato logico) e **report di validazione**.

**Prerequisiti:** [LEGACY_MONGO_INVENTORY.md](./LEGACY_MONGO_INVENTORY.md), [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md), [RBAC_LEGACY_TO_WORKSPACE_MAPPING.md](./RBAC_LEGACY_TO_WORKSPACE_MAPPING.md), [GDPR_CONSENT_SCOPE_SPIKE.md](./GDPR_CONSENT_SCOPE_SPIKE.md) (se applicabile).

---

## Variabili d’ambiente (esempio)

| Variabile | Significato |
|-----------|-------------|
| `MONGO_URI` | URI con permessi di **scrittura** sul DB operativo |
| `MONGO_DB_NAME` | Es. `test-zanetti` |
| `SOURCE_MONGO_URI` | URI **read-only** al legacy (opzionale se si importa da CSV) |
| `SOURCE_MONGO_DB_NAME` | DB legacy |
| `PILOT_WORKSPACE_ID` | ID workspace destinazione |
| `PILOT_RUN_ID` | Stringa per tracciare il run (`2026-03-26-pilot-1`) |
| `LEGACY_PROJECT_MAPPING_FILE` | JSON mapping progetto→workspace (default: `docs/deliverables/legacy-project-workspace-mapping.json`) |
| `GDPR_MODE` | `require_any_consent` (default), `require_trattamento`, `all` |
| `DRY_RUN` | `true`/`false` (default `true`) |

**Non** committare segreti; usare `.env` locale o CI.

---

## Ordine di caricamento (vincolante)

1. Workspace e progetti (`tz_workspaces`, `tz_workspace_projects`, …) se non già presenti.
2. Utenti e membership (`user.workspaces`, `tz_users`, `tz_workspace_user_projects`) — [README](../../README.md) per clone utenti.
3. Clienti `tz_clients` (dopo filtri GDPR).
4. Appartamenti `tz_apartments` (+ catalogo se necessario).
5. Trattative `tz_requests` + transizioni + eventuali `tz_quotes`.
6. Associazioni e tabelle satellite (`tz_apartment_client_associations`, …).

---

## Idempotenza

- Chiave univoca logica consigliata: **`legacySourceDb` + `legacyCollection` + `legacyId`** (stringa ObjectId) in `metadata` o campo dedicato sul documento `tz_*`.
- **Upsert** su quella chiave invece di `insertMany` cieco.
- Per clienti: rispettare vincolo **(workspaceId, email)** — normalizzare email in lower case prima dell’upsert.

---

## Validazione post-run

| Controllo | Come |
|-----------|------|
| Conteggi | `countDocuments` per tipo entità con `workspaceId = PILOT` |
| Diff campione | Confronto N record campionati campo per campo con export legacy |
| Integrità | Nessun `projectId` orfano; `workspaceId` coerente |
| Report | Markdown o CSV generato in CI artefatto |

---

## Riferimento codice

- Template TypeScript: [`scripts/migration/pilot-etl-idempotency.example.ts`](../../be-followup-v3/scripts/migration/pilot-etl-idempotency.example.ts) (esempio commentato, non eseguito in CI di default).
- Script operativo: [`scripts/migration/migrate-legacy-pilot.ts`](../../be-followup-v3/scripts/migration/migrate-legacy-pilot.ts) (`npm run migrate:legacy-pilot`).
- Script storico unificazione DB: [`unifyMainDb.ts`](../../be-followup-v3/src/utils/unifyMainDb.ts) (elenco collection `tz_*`).

### Esecuzione consigliata (pilot)

```bash
cd be-followup-v3
PILOT_RUN_ID=pilot-2026-03-26 DRY_RUN=true npm run migrate:legacy-pilot
PILOT_RUN_ID=pilot-2026-03-26 DRY_RUN=false CLIENT_LIMIT=1000 APARTMENT_LIMIT=1000 REQUEST_LIMIT=1000 npm run migrate:legacy-pilot
```

---

## Rollback

- Preferire **backup** snapshot Atlas (`test-zanetti`) prima del pilota.
- In alternativa, cancellare solo documenti con `metadata.pilotRunId = PILOT_RUN_ID` se il run li ha marcati.
