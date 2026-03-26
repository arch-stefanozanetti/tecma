# Inventario Mongo legacy (read-only) → FollowUp 3.0

**Scopo:** elenco **database** e **collection** sui cluster in **sola lettura** (tutti tranne il DB operativo di scrittura dell’app, tipicamente `test-zanetti` in dev), come base per mapping e ETL.  
**Policy runtime:** i servizi core non leggono il legacy a runtime; vedi [LEGACY_RUNTIME_POLICY.md](../LEGACY_RUNTIME_POLICY.md).

---

## Ruoli dei database (convenzione monorepo)

| Ruolo | Nome esempio (dev) | Note |
|-------|-------------------|------|
| **Operativo FollowUp 3** | `test-zanetti` | Scrittura `tz_*`, utenti invitati, JWT. Vedi [README.md](../../README.md) §backend. |
| **Legacy / snapshot** | `test`, altri su Atlas | Lettura per migrazione, confronti, estrazione CSV. **Non** usare come `MONGO_DB_NAME` per l’app in produzione dopo cutover dati. |

Aggiornare i nomi reali per staging/prod nella tabella sotto quando disponibili.

---

## Procedura (mongosh)

**Prerequisiti:** URI di lettura (solo permessi read), VPN se richiesta.

1. Elencare i database:
   ```javascript
   show dbs
   ```
2. Per ogni database legacy candidato:
   ```javascript
   use <nome_db>
   show collections
   ```
3. Per ogni collection rilevante: conteggio documenti e campione (senza dumpare PII in log pubblici):
   ```javascript
   db.<collection>.estimatedDocumentCount()
   db.<collection>.findOne()
   ```
4. Opzionale — schema inferito (MongoDB Compass o `mongodb` MCP `collection-schema` se connesso).

---

## Snapshot reale (MCP `user-mongodb-dev`)

Rilevazione eseguita il **2026-03-26** su cluster dev-1 con sessione MCP connessa.  
Perimetro legacy: **tutti i DB tranne `test-zanetti`**.

### Database rilevati (legacy + tecnici)

| Database | Size (bytes) | Note |
|----------|--------------:|------|
| `local` | 2436640768 | tecnico Mongo (`oplog.rs`) |
| `asset` | 526430208 | dominio immobili / unità / quote |
| `client` | 462098432 | clienti, richieste, documenti |
| `int-analytics` | 201535488 | analytics storico |
| `project` | 106610688 | progetti e policy |
| `home-configuration` | 89010176 | configurazioni HC |
| `survey` | 63913984 | survey/answers |
| `user` | 24027136 | utenti legacy / token |
| `spaces` | 12726272 | availability/booking |
| `notification-exception-mngr` | 11014144 | eccezioni email |
| `byp` | 11653120 | catalog/config BYP |
| altri (`notification`, `status-automata`, `pdf`, `prices`, ecc.) | < 10 MB ciascuno | supporto / integrazioni |

### Collection chiave per migrazione (con conteggi)

| Database | Collection | Stima doc | Note / dominio | Collegamento mapping |
|----------|------------|----------:|----------------|----------------------|
| `asset` | `apartments_view` | 22952 | unità legacy principali | [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md) |
| `asset` | `appartments` | 22952 | versione legacy unità (naming storico) | [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md) |
| `asset` | `plans` | 17582 | piani / attributi estesi | [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md) |
| `asset` | `typologies` | 963 | tipologie immobile | [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md) |
| `asset` | `quotes` | 6057 | preventivi/quote legacy | [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md) |
| `client` | `clients` | 15694 | clienti | [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md) |
| `client` | `requests` | 4762 | trattative | [WORKFLOW_SELL_STATE_MAPPING.md](./WORKFLOW_SELL_STATE_MAPPING.md) |
| `client` | `client_documents` | 294 | documenti cliente | [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md) |
| `client` | `calendars` | 1869 | eventi legacy | [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md) |
| `project` | `projects` | 346 | base progetto→workspace | [RBAC_LEGACY_TO_WORKSPACE_MAPPING.md](./RBAC_LEGACY_TO_WORKSPACE_MAPPING.md) |
| `user` | `users` | 2091 | utenti legacy | [RBAC_LEGACY_TO_WORKSPACE_MAPPING.md](./RBAC_LEGACY_TO_WORKSPACE_MAPPING.md) |
| `status-automata` | `request_status` | 4149 | storico stati trattativa | [WORKFLOW_SELL_STATE_MAPPING.md](./WORKFLOW_SELL_STATE_MAPPING.md) |
| `status-automata` | `automata_configurations` | 2 | configurazioni macchina stati | [WORKFLOW_SELL_STATE_MAPPING.md](./WORKFLOW_SELL_STATE_MAPPING.md) |
| `home-configuration` | `hc_apartments` | 7983 | appartamenti home config | [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md) |
| `spaces` | `availabilities` | 6252 | disponibilità | [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md) |
| `spaces` | `bookings` | 47 | prenotazioni | [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md) |
| `int-analytics` | `google_analytics` | 122355 | dataset analytics storico | [FASE4_REPORTS_DASHBOARDS.md](./FASE4_REPORTS_DASHBOARDS.md) |
| `int-analytics` | `projects_analytics` | 239 | aggregati progetto | [FASE4_REPORTS_DASHBOARDS.md](./FASE4_REPORTS_DASHBOARDS.md) |
| `notification` | `email_templates` | 201 | template comunicazioni | [FASE6_CONNECTORS_UX.md](./FASE6_CONNECTORS_UX.md) |
| `pdf` | `pdf_templates` | 70 | template PDF legacy | [FASE2_DIGITAL_QUOTE.md](./FASE2_DIGITAL_QUOTE.md) |

| Database | Collection | Stima doc | Note / dominio | Collegamento mapping |
|----------|------------|-----------|----------------|----------------------|
| _esempio_ `test` | `user` | | utenti legacy login | [RBAC_LEGACY_TO_WORKSPACE_MAPPING.md](./RBAC_LEGACY_TO_WORKSPACE_MAPPING.md) |
| | `apartments` | | unità legacy | [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md) |
| | | | | |
| | | | | |

**Regola:** una riga per collection che **entra** in migrazione o che **alimenta** una decisione (anche “esclusa”).

---

## Output atteso

- File aggiornato (MR) o export CSV allegato alla PR di migrazione.
- Allineamento con [unifyMainDb.ts](../../be-followup-v3/src/utils/unifyMainDb.ts) per l’elenco delle **collection `tz_*`** già previste nel target.

---

## Stato

| Campo | Valore |
|-------|--------|
| Ultimo aggiornamento | 2026-03-26 (snapshot reale via MCP `user-mongodb-dev`) |
| Cluster / URI | _non inserire segreti in repo_ |
