# Design: suggerimenti Cockpit aggregati (max N) + dettaglio espandibile

**Data:** 2026-03-19  
**Stato:** approvato (brainstorming)  
**Contesto:** le card “Priorità operative” risultano troppo generiche e duplicate perché la logica rule-based crea una riga per ogni associazione che matcha la stessa regola; il LLM può riscrivere varianti simili; più batch GET/POST accumulano pending.

## Obiettivi

1. Mostrare **al massimo N macro-suggerimenti** (default Cockpit **N = 8**), non una card per ogni entità che scatta la stessa regola.
2. Ogni macro-card ha **titolo/motivo/azione** sul **gruppo**, con **dettaglio espandibile** (lista fino a K righe, es. K=10, poi “… e altre M”).
3. Alla **rigenerazione**, evitare di **moltiplicare** pending equivalenti (strategia batch o delete per famiglia).
4. **Esecuzione “Esegui con AI”:** resta **in-process** nel `be-followup-v3` (stessa semantica tool di `mcp-followup`). Eventuale bridge HTTP MCP = **fase 2 opzionale** (feature flag), non parte di questo design.

## Backend

### Aggregazione rule-based

- Raggruppare le entità che attivano la **stessa “famiglia” di regola** (es. `stale_proposal_7d`, `inactive_client_20d`, `available_unit`, …) in un unico candidato.
- Ogni gruppo espone:
  - `aggregatedKind` (stringa stabile per dedup/refresh),
  - `items[]`: `{ associationId | clientId | apartmentId, labelBreve }` (campo dedicato in documento Mongo, non solo testo libero),
  - `risk` / `score` del gruppo: es. severità massima o funzione di count + risk.
- Ordinare i **gruppi** prima di applicare il **cap N** (es. `high` prima, poi score decrescente).

### LLM

- Input al modello: **riepilogo per gruppo** (conteggio + sample di label), non elenco di 20 card quasi uguali.
- Output: al più **una card raffinata per gruppo** (allineato allo schema Zod esistente + estensione `items` / `aggregatedKind`).

### Persistenza (`tz_ai_suggestions`)

- Estendere documento con campi opzionali, es.:
  - `aggregatedKind: string`
  - `aggregatedItems: Array<{ … }>` (limite serializzazione ragionevole)
- `llmRefined` invariato per hint GET.

### Refresh (POST) vs duplicati

- Prima di `insertMany` del nuovo batch: una delle strategie (sceglierne **una** in implementazione):
  - **A)** `deleteMany` su pending con stesso `workspaceId` + stesso set `projectIds` + stesso `aggregatedKind` dei gruppi che stiamo per reinserire; oppure
  - **B)** `batchId` (ObjectId/time) su ogni insert; **GET** restituisce solo l’ultimo `batchId` per `(workspaceId, projectIds)`.
- Raccomandazione: **B** se serve storico audit; **A** se si vuole DB più snello e semantica “sostituisci insight corrente”.

### GET pending

- Invariato concettualmente: legge pending filtrati; i documenti sono già **macro**; `limit` applicato al numero di **gruppi**.

## Frontend (`CockpitPage` / `PrioritySuggestionsList`)

- **Max 8** macro-card in vista principale (allineato a `MAX_PRIORITY_TILES` o rinomina in `MAX_PRIORITY_GROUPS`).
- Per ogni item con `aggregatedItems?.length`:
  - pulsante **“Mostra dettagli (k)”** / accordion;
  - elenco max **K=10** righe; oltre testo “… e altre M”.
  - dove possibile, link a `/clients/:id` o navigazione a trattative con state/query (se esiste contratto API/UI).
- Copy: titoli che includono **conteggio** (“4 proposte ferme…”) per ridurre percezione di genericità.

## Esecuzione e MCP

- **Oggi:** agente nel BE con tool in-process; **non** si chiama il server `mcp-followup` dalla Cockpit.
- **Futuro opzionale:** `AI_EXECUTE_VIA_MCP=true` + URL + credenziali → thin client nel BE che invoca gli stessi tool via HTTP; stesso audit e stessi vincoli workspace.

## Test

- Unit: raggruppamento (N associazioni stessa regola → 1 gruppo); cap N=8; ordinamento.
- Unit/integration: dopo POST refresh, non compaiono **duplicati** stesso `aggregatedKind` tra pending visibili (secondo strategia A o B).
- FE: espansione dettagli, testo overflow “+ M”.

## Prossimo passo (processo)

- Creare piano di implementazione task-per-task (skill **writing-plans** / issue tracker) a partire da questo documento.
