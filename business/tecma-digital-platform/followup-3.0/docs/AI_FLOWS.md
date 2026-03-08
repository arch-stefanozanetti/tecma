# Flussi AI: Suggerimenti e Azioni

Questo documento chiarisce come vengono usati i due flussi AI nell’app: **suggerimenti** (Cockpit) e **bozze azioni** (Approvals).

## 1. Suggerimenti → Cockpit

- **Origine:** il backend genera suggerimenti con `POST /v1/ai/suggestions` (`generateAiSuggestions`).
- **UI:** le card nella **Cockpit** (Home) mostrano questi suggerimenti mappati in azioni (titolo, contesto, azione consigliata).
- **Decisione utente:** quando l’utente clicca **Fatto** (Done) o **Salta** (Skip) su una card che proviene da un suggerimento AI, il frontend chiama **`decideAiSuggestion`** per registrare la decisione nel backend:
  - **Fatto** → `decideAiSuggestion(suggestionId, "approved", actorEmail)`
  - **Salta** → `decideAiSuggestion(suggestionId, "rejected", actorEmail)`
- **Backend:** `POST /v1/ai/approvals` aggiorna lo stato del suggerimento (es. `pending` → `approved` / `rejected`). La chiamata è fire-and-forget: in caso di errore l’UI non si blocca e la card viene comunque rimossa dalla coda.

Le card mock (INITIAL_ACTIONS) non hanno `suggestionId`, quindi su di esse Done/Skip aggiornano solo la coda locale, senza chiamate API.

## 2. Bozze azioni → Approvals

- **Origine:** le bozze azioni possono essere create a partire da un suggerimento (o manualmente) e sono gestite con `POST /v1/ai/actions/drafts`, `POST /v1/ai/actions/drafts/query`, ecc.
- **UI:** la pagina **Approvals** (AI Approval Queue) mostra solo le **bozze azioni** (`queryAiActionDrafts`) e permette di approvare/rifiutare con **`decideAiActionDraft`**.
- **Backend:** la decisione su una bozza azione viene registrata con `POST /v1/ai/actions/drafts/:id/decision`.

## Riepilogo

| Flusso            | Dove          | API decisione              | Endpoint backend              |
|-------------------|---------------|----------------------------|-------------------------------|
| Suggerimenti AI   | Cockpit       | `decideAiSuggestion`       | `POST /v1/ai/approvals`       |
| Bozze azioni      | Approvals     | `decideAiActionDraft`      | `POST /v1/ai/actions/drafts/:id/decision` |

Entrambi i flussi sono attivi: i suggerimenti vengono approvati/rifiutati dalla Cockpit; le bozze azioni dalla pagina Approvals.
