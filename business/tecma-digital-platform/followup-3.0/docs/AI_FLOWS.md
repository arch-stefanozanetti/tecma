# Flussi AI: Suggerimenti, LLM, agente tool e Approvals

Questo documento descrive i flussi AI in Followup 3.0: **suggerimenti Cockpit** (con LLM opzionale), **esecuzione con agente a tool in-process**, e **bozze azioni** (Approvals).

## 1. Configurazione workspace

- **Provider + API key** per workspace: `GET/PUT /v1/workspaces/:id/ai-config` (admin). La chiave non viene mai restituita in chiaro.
- Senza config: `POST /v1/ai/suggestions` risponde con `data: []` e `aiConfigured: false` (Cockpit mostra messaggio per collegare un provider).

## 2. Suggerimenti → Cockpit

### Lettura (cache DB)

- **Endpoint:** `GET /v1/ai/suggestions?workspaceId=...&projectIds=...&projectIds=...&limit=20`  
  Query `projectIds` ripetibile o separata da virgola. Richiede JWT e `canAccess` sul workspace.
- **Comportamento:** legge da `tz_ai_suggestions` solo documenti **`status: pending`** con lo **stesso insieme** di `projectIds` (ordine irrilevante). **Nessuna** chiamata LLM, nessun insert.
- **Risposta:** come sotto, più `fromCache: true`. Campo `llmUsed`: `true` / `false` se tutti i documenti hanno `llmRefined` omogeneo, altrimenti `null` (batch misto o dati legacy).

### Rigenerazione (pulsante “Aggiorna”)

- **Endpoint:** `POST /v1/ai/suggestions` (`generateAiSuggestions`).
- **Pipeline (con config AI):**
  1. Caricamento dati da Mongo (clienti, immobili, associazioni nel workspace/progetti).
  2. Generazione candidati **rule-based aggregati per famiglia** (`stale_proposal_7d`, `inactive_client_20d`, `available_unit`, `no_critical_signal`): al più **8 gruppi** (cap allineato a `MAX_SUGGESTION_GROUPS`), ordinati per rischio e score. Ogni gruppo include `aggregatedKind`, `aggregatedItems[]` (tetto serializzazione lato server) e testo di sintesi.
  3. Se `AI_LLM_DISABLED` non è attivo e la API key è valida, chiamata **LLM** che **raffina** titolo/motivo/azione/risk/score **per ogni gruppo nello stesso ordine** (merge 1:1: `aggregatedKind` e `aggregatedItems` restano quelli rule-based). Se il modello restituisce un numero di righe diverso dall’atteso, si scarta l’output LLM e si usano solo i candidati rule-based.
  4. Se il LLM fallisce, si usano solo i suggerimenti rule-based.
  5. **Prima dell’insert:** `deleteMany` su suggerimenti **pending** con stesso `workspaceId`, stesso insieme di `projectIds` e stesso `aggregatedKind` tra quelli del batch in arrivo (evita duplicati macro-card tra rigenerazioni).
  6. **Insert** in `tz_ai_suggestions` con `llmRefined: true|false` su ogni riga (allineato a `llmUsed`).
- **Risposta:** `generatedAt`, `data[]` (con `aggregatedKind` / `aggregatedItems` quando presenti), `aiConfigured: true`, `llmUsed: true|false`, `fromCache: false`.

### Variabile d’ambiente

- **`AI_LLM_DISABLED`**: se `true` o `1`, nessuna chiamata al provider esterno: solo euristiche.

## 3. Cockpit UI

- All’apertura: **GET** suggerimenti pending (nessuna rigenerazione automatica). Pulsante **Aggiorna suggerimenti** → **POST** per ricalcolare; il backend sostituisce i pending con gli stessi `aggregatedKind` del nuovo batch (stesso workspace + stessi progetti).
- Card **Priorità operative**: al massimo **8 macro-suggerimenti**; se una card ha `aggregatedItems`, la UI offre **Mostra dettagli (k)** con elenco fino a **10** voci e testo **… e altre M** oltre la decima; link a `/clients/:id` quando è noto `clientId`.
- **Esegui con AI:** chiama `POST /v1/ai/suggestions/:suggestionId/execute` con `actorEmail`. Avvia un **agente** nel backend che usa tool in-process (vedi §4). In caso di successo, la Cockpit tenta `decideAiSuggestion(..., "approved", ...)` e rimuove la card.
- Pulsante di navigazione manuale (**azione consigliata**) resta disponibile (es. verso Calendario / Clienti).

## 4. Agente “Esegui con AI” (tool in-process)

- **Endpoint:** `POST /v1/ai/suggestions/:suggestionId/execute`  
  Body: `{ "actorEmail": "user@...", "note": "...", "maxSteps": 6 }` (maxSteps cappato lato server).
- **Auth:** JWT; accesso al **workspace** della suggestion verificato con `canAccess`.
- **Modello:** stessa API key / provider del workspace (`getWorkspaceAiConfigInternal`).
- **Loop:** il modello risponde con JSON `{"type":"tool_calls","calls":[...]}` oppure `{"type":"final","summary":"..."}`; massimo ~8 passaggi.
- **Tool** (stessa semantica del bridge HTTP `mcp-followup`, ma eseguiti **nel processo BE**):
  - `search_clients`, `search_apartments`, `list_associations`, `generate_workspace_report` (read)
  - `create_calendar_event`, `create_task_from_suggestion` (write, con `workspaceId` / `projectId` vincolati alla suggestion)
- **Audit:** evento dominio `ai.suggestion.agent_executed` in `tz_domain_events` (con `actor` utente).

## 5. Decisione su suggerimento (manuale / post-agente)

- **`decideAiSuggestion`:** `POST /v1/ai/approvals` — aggiorna lo stato del suggerimento (`approved` / `rejected`).

## 6. Bozze azioni → Approvals

- **Origine:** `POST /v1/ai/actions/drafts`, query con `POST /v1/ai/actions/drafts/query`.
- **UI:** pagina **Approvals** — approvazione/rifiuto con `POST /v1/ai/actions/drafts/:id/decision` (`decideAiActionDraft`), che può creare task o code reminder a seconda del tipo bozza.

## Riepilogo endpoint

| Flusso | Dove | Endpoint principale |
|--------|------|---------------------|
| Suggerimenti (lettura DB) | Cockpit | `GET /v1/ai/suggestions` |
| Suggerimenti (rigenera + LLM) | Cockpit | `POST /v1/ai/suggestions` |
| Esecuzione agente | Cockpit | `POST /v1/ai/suggestions/:id/execute` |
| Decisione suggerimento | Cockpit / post-agente | `POST /v1/ai/approvals` |
| Bozze azioni | Approvals | `POST /v1/ai/actions/drafts/...` |

## Bridge esterno MCP

- Il repo **`mcp-followup`** espone gli stessi concetti via HTTP (`x-api-key` + Bearer verso il BE). L’agente in-app **non** chiama quel processo: usa servizi interni per coerenza con auth e multi-tenant.
