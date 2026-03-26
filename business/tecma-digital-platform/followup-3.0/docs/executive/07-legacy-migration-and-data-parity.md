# Migrazione dati e parità con il legacy

**Ultimo aggiornamento:** 2026-03-26  
**Pubblico:** CTO, CEO, Product  
**Indice:** [README.md](README.md)

---

## In 30 secondi

FollowUp 3.0 **non replica il monolite** legacy, ma può **migrare i dati** in modo **tracciato** verso le collection **`tz_*`** (scrittura operativa su DB dedicato, es. `test-zanetti` in dev). Il gap si colma con **due obiettivi distinti**: **A — nessuna perdita di dati rilevanti**; **B — parità funzionale** dove il business la richiede (roadmap a fasi). La narrativa “greenfield” resta valida per **architettura**; per **dati** vale il metodo inventario → mapping → ETL → validazione.

---

## Obiettivo A vs B

| | **A — Dati** | **B — Prodotto** |
|---|----------------|------------------|
| **Cosa** | Ogni campo utile ha destinazione (`tz_*`, `extraInfo`, metadata) | Stessi flussi/report/stati dove richiesto |
| **Come si dimostra** | Conteggi, diff, pilota | Milestone [PIANO_GLOBALE_FOLLOWUP_3.md](../PIANO_GLOBALE_FOLLOWUP_3.md) FASE1–7 |

Dettaglio: [CLARIFY_MIGRATION_OBJECTIVES.md](../deliverables/CLARIFY_MIGRATION_OBJECTIVES.md).

---

## Metodo (cinque passi)

1. **Inventario** su Mongo read-only — [LEGACY_MONGO_INVENTORY.md](../deliverables/LEGACY_MONGO_INVENTORY.md).
2. **Matrice di mapping** — [FASE1_CSV_MAPPING.md](../deliverables/FASE1_CSV_MAPPING.md).
3. **ETL idempotente** — [PILOT_ETL_RUNBOOK.md](../deliverables/PILOT_ETL_RUNBOOK.md); esempio codice `be-followup-v3/scripts/migration/pilot-etl-idempotency.example.ts`.
4. **Validazione** conteggi e campioni.
5. **Decisioni legali/prodotto** (GDPR) — [GDPR_CONSENT_SCOPE_SPIKE.md](../deliverables/GDPR_CONSENT_SCOPE_SPIKE.md).

---

## Evidenze quantitative già raccolte

Snapshot reale da cluster legacy (MCP, 2026-03-26):

- `asset.apartments_view`: **22952** documenti
- `asset.plans`: **17582** documenti
- `client.clients`: **15694** documenti
- `client.requests`: **4762** documenti
- `user.users`: **2091** documenti
- `status-automata.request_status`: **4149** documenti
- `asset.quotes`: **6057** documenti

Dettaglio completo: [LEGACY_MONGO_INVENTORY.md](../deliverables/LEGACY_MONGO_INVENTORY.md).

Inoltre, è stata avviata la **field coverage analysis** con schema reale su collection chiave (appartamenti, piani, clienti, richieste, utenti, quote), riportata in [FASE1_CSV_MAPPING.md](../deliverables/FASE1_CSV_MAPPING.md).

---

## Aree di mapping dedicate

| Tema | Documento |
|------|-----------|
| Ruoli legacy → workspace / progetti | [RBAC_LEGACY_TO_WORKSPACE_MAPPING.md](../deliverables/RBAC_LEGACY_TO_WORKSPACE_MAPPING.md) |
| Stati SELL (preventivo, riserva, …) | [WORKFLOW_SELL_STATE_MAPPING.md](../deliverables/WORKFLOW_SELL_STATE_MAPPING.md) |

---

## Policy runtime e “no confusione”

- I servizi core **non** leggono il legacy a runtime — [LEGACY_RUNTIME_POLICY.md](../LEGACY_RUNTIME_POLICY.md).
- **Confusione DB/ambienti** resta un rischio operativo: usare runbook Atlas e nomi espliciti (`MONGO_DB_NAME`).

---

## Diagramma (tab Panoramica visiva)

È disponibile la mappa **“Migrazione dati”** (`migration-data-flow`) nella sezione **Panoramica visiva** dell’app (`/executive`).

---

## Collegamenti

- Piano unico: [PIANO_GLOBALE_FOLLOWUP_3.md](../PIANO_GLOBALE_FOLLOWUP_3.md) §6 (Fase 1 data_first).  
- Rischi: [06-risks-open-decisions.md](06-risks-open-decisions.md) (cutover vs convivenza, parità legacy).  
- Executive summary: [01-executive-summary.md](01-executive-summary.md).
