# Modello Request/Deal (Wave 4)

Modello unificato **rent + sell** per richieste e trattative: una singola entità rappresenta l’interesse o la trattativa di un cliente (affitto o vendita), collegata al cliente e opzionalmente a un appartamento.

## Collection MongoDB

- **Nome:** `tz_requests` (prefisso `tz_` per estensioni additive, come da master plan).

## Campi

| Campo        | Tipo     | Obbligatorio | Descrizione                                      |
|-------------|----------|--------------|--------------------------------------------------|
| `_id`       | ObjectId | sì           | Identificativo univoco                           |
| `projectId` | string   | sì           | Progetto di riferimento                          |
| `workspaceId` | string | sì           | Workspace (contesto)                             |
| `clientId`  | string   | sì           | Riferimento al cliente (collection client)       |
| `apartmentId` | string  | no           | Riferimento opzionale all’appartamento           |
| `type`      | string   | sì           | `"rent"` \| `"sell"`                             |
| `status`    | string   | sì           | Es.: `new`, `contacted`, `viewing`, `offer`, `won`, `lost` |
| `createdAt` | string   | sì           | Data/ora creazione (ISO)                         |
| `updatedAt` | string   | sì           | Data/ora ultimo aggiornamento (ISO)              |

Stati e transizioni possono essere estesi in seguito; l’importante è un unico flusso per rent e sell.

## API

- **POST /v1/requests/query** — Lista paginata con il contratto condiviso: `workspaceId`, `projectIds`, `page`, `perPage`, `searchText`, `sort`, `filters` (es. `filters.status`, `filters.type`). Risposta: `{ data: RequestRow[], pagination }`.
- **GET /v1/requests/:id** — Dettaglio singola richiesta/trattativa (404 se non trovata).
- **POST /v1/requests** — Crea nuova richiesta/trattativa.
- **PATCH /v1/requests/:id/status** — Transizione di stato. Body: `{ status: RequestStatus, reason?: string }`. Solo le transizioni ammesse dalla macchina a stati sono consentite (400 altrimenti).

Entrambi gli endpoint richiedono autenticazione (JWT). Il contratto query è lo stesso usato per clienti e appartamenti (ListQuery).

## Transizioni di stato ammesse

| Da       | A                                 |
|----------|-----------------------------------|
| new      | contacted, viewing, lost          |
| contacted| viewing, offer, lost              |
| viewing  | offer, contacted, lost            |
| offer    | won, lost, viewing                |
| won      | — (terminale)                     |
| lost     | — (terminale)                     |

La logica è in-process in be-followup-v3; in futuro può essere delegata a be-tecma-status-automata (stesso contratto).

**Compravendita (punto 6):** Il campo opzionale `clientRole` (`buyer` | `seller` | `tenant` | `landlord`) in creazione e in risposta permette di distinguere acquirente/venditore; le associazioni per ruolo possono essere mostrate nelle schede Cliente e Appartamento.

## Riferimenti

- [FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md) — Wave 4, task 1 (modello e API).
- OpenAPI: `GET /v1/openapi.json` (tag `requests`, schemi `RequestRow`).
