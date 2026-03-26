# Stati SELL legacy → workflow e snapshot FollowUp 3.0

**Scopo:** mappare stati “forzati” del legacy (preventivo, riserva, proposta, contratto, rogito, …) sul modello attuale: **`tz_workflow_configs`**, stati **`WorkflowState`**, trattative **`tz_requests`** + eventuali **snapshot** (`tz_quotes`, allegati) come da [PIANO_GLOBALE_FOLLOWUP_3.md](../PIANO_GLOBALE_FOLLOWUP_3.md) Fase 2 (preventivo digitale).

**Policy:** niente fallback runtime a **`automata_configurations`** legacy — vedi [LEGACY_RUNTIME_POLICY.md](../LEGACY_RUNTIME_POLICY.md).

---

## Due livelli (non mescolare)

| Livello | Cosa modella | Esempio |
|---------|----------------|---------|
| **Macchina a stati** | Transizioni consentite, reversibilità, `workflowStateId` | `draft` → `negotiation` → `won` |
| **Milestone di dominio** | Fatto irreversibile o documento emesso | “Preventivo inviato” con ID legacy, PDF in storage |

Se il legacy aveva uno **stato preventivo** con **ID proprio** usato come entry point:

- **Mappare** lo stato legacy su uno **stato** del workflow attuale (`code` coerente con `getStateByCode` in [`requests.service.ts`](../../be-followup-v3/src/core/requests/requests.service.ts)).
- **Persistere** l’ID legacy come **`legacyQuoteId`** / metadata su `tz_requests` o `tz_quotes` per tracciabilità e report.

---

## Tabella mapping (template)

| Stato / label legacy | ID legacy (se presente) | Stato nuovo (`code`) | `workflowId` / note | Side-effect (quote, lock, calendar) |
|----------------------|-------------------------|----------------------|----------------------|--------------------------------------|
| preventivo | | | | creare/aggiornare riga `tz_quotes` |
| riserva | | | | [`apartment-lock`](../../be-followup-v3/src/core/workflow/apartment-lock.service.ts) se applicabile |
| proposta | | | | |
| contratto | | | | |
| rogito | | | | evento dominio / task |

---

## Evidenza reale stati legacy (snapshot 2026-03-26)

### `status-automata.request_status` (top)

- `ok` (3192)
- `cancellato` (430)
- `INIT` (250)
- `invalido` (63)
- `EXPIRED` (31)
- `APPLICATION_COMPLETED` (30)

### `client.requests.status` (top)

- `ok` (3191)
- `INIT` (861)
- `cancellato` (430)
- `invalido` (63)
- `EXPIRED` (31)
- `APPLICATION_COMPLETED` (30)

Nota: coesistono status legacy in italiano/inglese e varianti (`INVALID`, `DECLINED`, `CANCELLED`, `RENTED`), oltre a `null`.

## Mapping operativo suggerito (base)

| Stato legacy | Classe | Stato nuovo suggerito | Note |
|--------------|--------|------------------------|------|
| `INIT` | pre-negoziazione | `draft` / `new` | entry point trattativa |
| `ok` | attiva | `negotiation` | da dettagliare per SELL/RENT |
| `APPLICATION_COMPLETED`, `ACCEPTED`, `RENT_COMPLETED` | positiva | `won` / `completed` | distinguere per business line |
| `cancellato`, `CANCELLED`, `DECLINED`, `invalido`, `INVALID` | negativa | `lost` / `cancelled` | mantenere reason in metadata |
| `EXPIRED*`, `TIME_*`, `SUSPENDED*` | sospesa/scaduta | `expired` / `on_hold` | possibili transizioni automatiche |

Per SELL, gli stati dominio (`preventivo`, `riserva`, `proposta`, `contratto`, `rogito`) restano da mappare come **workflow + milestone** usando anche `quote_id`/`asset.quotes`.

---

## Casi limite

- **Trattative aperte al cutover:** congelare stato legacy nel campo metadata + applicare transizione iniziale consentita nel nuovo workflow.
- **Stati non reversibili:** allineare flag `reversible` sullo stato in `tz_workflow_configs`.

---

## Deliverable

Tabella firmata + aggiornamento seed/config workflow per workspace pilota; test su `requests.service` / workflow engine dove esistono già test di transizione.
