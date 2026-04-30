# Looker Studio – Community Connector Followup 3.0 Listings

Questo connettore permette di usare i **listati (appartamenti)** di Followup 3.0 come sorgente dati in **Looker Studio** (ex Google Data Studio). Chiama l’endpoint pubblico `GET /v1/public/listings` dell’API Followup (nessuna autenticazione, rate limit 60 req/min per IP).

## Requisiti

- Un’istanza dell’API Followup 3.0 raggiungibile via HTTPS (es. `https://api.tuodominio.com/v1`).
- **Workspace ID** e **Project IDs** del workspace/progetti da cui leggere i listati.

## Passi per il deploy

1. **Crea un progetto Google Apps Script**
   - Vai su [script.google.com](https://script.google.com).
   - Nuovo progetto.
   - Incolla il contenuto di `Code.gs` nel file `Code.gs` del progetto.
   - Copia il contenuto di `appsscript.json` nel file `appsscript.json` (manifest): in editor, menu **Progetto** → **Impostazioni progetto** → spunta "Mostra file manifest" e modifica `appsscript.json`.

2. **Registra come Community Connector**
   - In Apps Script: **Distribuisci** → **Gestisci distribuzioni**.
   - **Nuova distribuzione** → tipo **Connettore** (Looker Studio Community Connector).
   - Compila nome, descrizione e (opzionale) logo/URL azienda.
   - Dopo il deploy otterrai un **ID connettore** e un **URL di autorizzazione** per Looker Studio.

3. **Usa in Looker Studio**
   - In Looker Studio: **Crea** → **Report** (o apri un report esistente).
   - **Aggiungi dati** → in "Connettori" cerca il tuo connettore (es. "Followup 3.0 Listings") o usa **Connettore personalizzato** e inserisci l’ID connettore.
   - Nella configurazione inserisci:
     - **API base URL**: URL base dell’API (es. `https://api.tuodominio.com/v1`), senza slash finale.
     - **Workspace ID**: ID del workspace.
     - **Project IDs**: uno o più ID progetto separati da virgola (es. `proj-01,proj-02`).
   - Connetti e seleziona le dimensioni/metriche da usare nel report.

## Campi esposti (schema)

| Campo         | Tipo    | Descrizione                    |
|---------------|---------|--------------------------------|
| `_id`         | Testo   | ID appartamento                |
| `code`        | Testo   | Codice unità                   |
| `name`        | Testo   | Nome                           |
| `status`      | Testo   | AVAILABLE, RESERVED, SOLD, RENTED |
| `mode`        | Testo   | RENT o SELL                    |
| `surfaceMq`   | Numero  | Superficie (mq)                |
| `priceAmount` | Numero  | Importo prezzo normalizzato    |
| `priceCurrency` | Testo | Valuta                         |
| `updatedAt`   | Testo   | Data/ora ultimo aggiornamento   |

## API di riferimento

- **GET** `/v1/public/listings?workspaceId=...&projectIds=...&page=1&perPage=25`  
  Stesso contratto della POST; documentazione completa in `docs/API_RIUSABILI.md` nel repository Followup 3.0.

## Limitazioni

- Rate limit API: 60 richieste/minuto per IP; in caso di superamento risposta 429.
- Il connettore effettua paginazione automatica (fino a 50 pagine da 1000 record) per portare tutti i listati in Looker.
