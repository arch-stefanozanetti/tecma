# Catalogo eventi prodotto (Followup 3.0)

**Versione:** 1.0.0  
**Convenzione nomi:** `area.object.action` (snake_case con punti).  
**Changelog:** incrementare versione minore quando si aggiungono proprietà obbligatorie; major solo per breaking rename.

## Proprietà comuni (opzionali ma consigliate)

| Proprietà | Tipo | Note |
|-----------|------|------|
| `section` | string | Sezione app (`cockpit`, `clients`, `requests`, …) |
| `route_path` | string | Pathname normalizzato (senza query sensibili) |
| `workspace_id` | string | Solo ID workspace (no email) |
| `project_id` | string | Singolo progetto se applicabile |
| `duration_ms` | number | Durata operazione lato client |
| `outcome` | `success` \| `error` \| `cancel` | Esito |
| `error_code` | string | Codice errore normalizzato (mai stack trace) |

**Non inviare mai:** token JWT, refresh token, testo note, indirizzi email in chiaro, contenuto documenti.

## Dimensione neuro-oriented → eventi

| Dimensione | Eventi principali |
|------------|-------------------|
| Attenzione / navigazione | `app.session.start`, `app.route.view` |
| Attrito / task | `task.client.log_action`, `flow.request.board_view` |
| Integrazioni | `integr.marketing.oauth_click`, `integr.page.view` |
| Stress / fiducia | `error.ui.shown` |
| Cockpit / priorità | `cockpit.page.view` |

## Elenco eventi (MVP v1)

### `app.session.start`

Emesso una volta per caricamento SPA autenticato (dopo scope progetto disponibile).

- `app_version`: string (da `import.meta.env`)

### `app.route.view`

Emesso quando cambiano sezione effettiva o pathname significativo.

- `section`: string
- `route_path`: string
- `previous_section`: string | optional

### `cockpit.page.view`

Vista Cockpit (caricamento dashboard priorità).

- `project_count`: number (bucket: 0, 1, 2+)

### `task.client.log_action`

Utente registra attività su cliente (chiamata, mail, ecc.).

- `action_type`: `call_completed` \| `mail_sent` \| `mail_received` \| `meeting_scheduled`

### `flow.request.board_view`

Apertura board richieste (proxy per engagement modulo richieste).

- (nessuna PII)

### `integr.page.view`

Apertura pagina Integrazioni.

### `integr.marketing.oauth_click`

Click su collegamento OAuth marketing Google o Meta (da Integrazioni, Big Data workspace, ecc.).

- `surface`: `integrations` \| `project_detail` \| `bigdata`
- `provider`: `google` \| `meta`

### `error.ui.shown`

Toast o banner errore visibile utente (campionamento: solo codice).

- `error_code`: string
- `context`: string breve (es. `api`, `form`)

## Versioning

- **1.0.0**: introduzione catalogo + implementazione FE in `fe-followup-v3/src/telemetry/` (PostHog, eventi MVP).
- Aggiunte future: appendere righe e aggiornare versione in cima a questo file.
