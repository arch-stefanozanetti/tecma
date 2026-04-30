# API per uso esterno (riusabili)

Alcune API di Followup 3.0 sono pensate per l’**uso fuori dal solo CRM**: siti web (listati immobiliari), preventivatori, connettori e integrazioni esterne. Queste API hanno un **contratto stabile** (ListQuery + risposta paginata o lista light) e sono documentate qui e nello spec OpenAPI.

**Autenticazione:**  
- **API pubbliche (senza JWT):** `POST /v1/public/listings` — listati con **rate limit** (60 req/min per IP).  
- **API con JWT:** gli altri endpoint riusabili richiedono **JWT Bearer** (token da login o SSO). In futuro: API key o token con scope limitato.

**Rate limiting:**  
- Login e SSO exchange: 10 richieste / 15 minuti per IP.  
- API pubblica listati: 60 richieste / minuto per IP. In caso di superamento risposta **429** con messaggio di riprova.

---

## Endpoint riusabili

### 0. Listati pubblici (senza autenticazione)

**Path:** `POST /v1/public/listings`  
**Descrizione:** Elenco appartamenti (listings) **senza JWT**. Stesso contratto e risposta di `POST /v1/apartments/query`. Ideale per siti web, widget, integrazioni che non gestiscono login. **Rate limited:** 60 richieste/minuto per IP.

| Aspetto | Dettaglio |
|--------|-----------|
| **Auth** | Nessuna (pubblico) |
| **Rate limit** | 60 req/min per IP; 429 se superato |
| **Request** | Contratto **ListQuery** (come sotto) |
| **Response** | **PaginatedResponse**: `{ data: ApartmentListRow[], pagination }` |

**Esempio curl:**
```bash
curl -X POST "http://localhost:5060/v1/public/listings" \
  -H "Content-Type: application/json" \
  -d '{"workspaceId":"dev-1","projectIds":["project-01"],"page":1,"perPage":25}'
```

**GET (per Looker Studio e connettori che preferiscono query string):**  
`GET /v1/public/listings` — stesso contratto e risposta della POST, parametri in query:

| Parametro    | Tipo   | Obbligatorio | Descrizione |
|-------------|--------|--------------|-------------|
| workspaceId | string | Sì          | ID workspace |
| projectIds  | string | Sì          | ID progetti separati da virgola (es. `id1,id2`) |
| page        | number | No (default 1) | Pagina |
| perPage     | number | No (default 25, max 200) | Elementi per pagina |
| searchText  | string | No          | Ricerca su nome/codice |

**Esempio URL (Looker Community Connector, Google Apps Script, ecc.):**
```
GET /v1/public/listings?workspaceId=dev-1&projectIds=project-01,project-02&page=1&perPage=25
```
Rate limit e autenticazione identici alla POST (nessuna auth, 60 req/min per IP).

---

### 1. Elenco appartamenti (listings, con JWT)

**Path:** `POST /v1/apartments/query`  
**Descrizione:** Elenco appartamenti per progetto/workspace con filtri e paginazione. Adatto a listati su siti web, export, connettori.

| Aspetto | Dettaglio |
|--------|-----------|
| **Auth** | JWT Bearer (header `Authorization: Bearer <accessToken>`) |
| **Request** | Contratto **ListQuery**: `workspaceId`, `projectIds`, `page`, `perPage`, `searchText`, `sort`, `filters` (es. `status`, `mode`) |
| **Response** | **PaginatedResponse**: `{ data: ApartmentListRow[], pagination: { page, perPage, total, totalPages } }` |

**Esempio body (minimo):**
```json
{
  "workspaceId": "dev-1",
  "projectIds": ["project-sell-01"],
  "page": 1,
  "perPage": 25
}
```

**Esempio con filtri e ordinamento:**
```json
{
  "workspaceId": "dev-1",
  "projectIds": ["project-sell-01", "project-rent-01"],
  "page": 1,
  "perPage": 25,
  "searchText": "piano 2",
  "sort": { "field": "updatedAt", "direction": -1 },
  "filters": { "status": ["AVAILABLE"], "mode": ["SELL"] }
}
```

**Esempio curl:**
```bash
curl -X POST "http://localhost:5060/v1/apartments/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_ACCESS_TOKEN" \
  -d '{"workspaceId":"dev-1","projectIds":["project-01"],"page":1,"perPage":25}'
```

---

### 2. Lista light clienti

**Path:** `POST /v1/clients/lite/query`  
**Descrizione:** Lista clienti “leggera” (id, nome, email, progetto) per progetto/workspace. Adatta a dropdown, selettori e integrazioni che non richiedono il cliente completo.

| Aspetto | Dettaglio |
|--------|-----------|
| **Auth** | JWT Bearer |
| **Request** | `{ workspaceId: string, projectIds: string[] }` |
| **Response** | `{ data: Array<{ _id, workspaceId, projectId, fullName, email }> }` (max 3000 elementi) |

**Esempio body:**
```json
{
  "workspaceId": "dev-1",
  "projectIds": ["project-sell-01", "project-rent-01"]
}
```

**Esempio curl:**
```bash
curl -X POST "http://localhost:5060/v1/clients/lite/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_ACCESS_TOKEN" \
  -d '{"workspaceId":"dev-1","projectIds":["project-01"]}'
```

---

## Contratti di riferimento

- **ListQuery** (per `apartments/query`): `workspaceId` (obbligatorio), `projectIds` (array non vuoto), `page` (default 1), `perPage` (default 25, max 200), `searchText`, `sort` (`field`, `direction` 1|-1), `filters` (oggetto libero; per gli appartamenti sono supportati `status`, `mode`).
- **PaginatedResponse&lt;T&gt;**: `{ data: T[], pagination: { page, perPage, total, totalPages } }`.
- **Clients lite**: ogni elemento in `data` ha `_id`, `workspaceId`, `projectId`, `fullName`, `email`.

Lo spec **OpenAPI** completo (schemi, sicurezza, tutti i path) è disponibile quando il backend è in esecuzione:

- **GET** `/v1/openapi.json`  
  (es. `http://localhost:5060/v1/openapi.json` in locale)

Gli endpoint riusabili sono marcati nello spec con il tag **"Riusabili"** (o "External") per distinguerli dalle API core CRM.

---

## Note

- **Core CRM vs riusabili:** le API “core” (auth, session, calendar, clienti completi, CRUD appartamenti, associations, workflows, templates, AI, requests) sono pensate per l’uso dall’app Followup. Le API riusabili sono quelle adatte a integrazioni esterne (listings, lista light clienti). Vedi anche il README del progetto, sezione “API: core CRM vs riusabili”.
- **Evoluzione auth:** in un secondo momento si potranno introdurre API key o JWT con scope limitato per esporre i listati in modo controllato senza login utente completo.
