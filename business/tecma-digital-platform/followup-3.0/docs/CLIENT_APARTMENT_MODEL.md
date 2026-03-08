# Modello Cliente e Appartamento — mapping legacy e API

Questo documento descrive il mapping tra i campi **legacy** (DB client/asset) e il modello **unificato** esposto dalle API Followup 3.0, e le regole per una futura migrazione.

---

## 1. Clienti

### 1.1 DB principale (collection `clients`)

| Campo API (`ClientRow`) | Campo DB primary | Note |
|-------------------------|------------------|------|
| `_id` | `_id` | ObjectId → string |
| `projectId` | `projectId` | string |
| `fullName` | `fullName` | obbligatorio in UI (default "-") |
| `email` | `email` | opzionale |
| `phone` | `phone` | opzionale |
| `status` | `status` | es. lead, prospect, client; default "lead" |
| `createdAt` | `createdAt` | ISO string |
| `updatedAt` | `updatedAt` | ISO string |
| `source` | `source` | opzionale |
| `city` | `city` | opzionale |
| `myhomeVersion` | `myhomeVersion` | opzionale |
| `createdBy` | `createdBy` | opzionale |

### 1.2 DB legacy (ENV `MONGO_CLIENT_DB_NAME`, collection `clients`)

| Campo API (`ClientRow`) | Campo legacy | Note |
|-------------------------|--------------|------|
| `_id` | `_id` | ObjectId → string |
| `projectId` | `project_id` | ObjectId o string → string |
| `fullName` | `fullName` oppure `firstName` + `lastName` | se fullName vuoto, concatena name parts |
| `email` | `email` | |
| `phone` | `tel` | mapping `tel` → `phone` |
| `status` | `status` | default "lead" |
| `createdAt` | `createdOn` | convertito a ISO |
| `updatedAt` | `updatedOn` \|\| `createdOn` | convertito a ISO |
| `source` | `source` | |
| `city` | `city` | |
| `myhomeVersion` | `myhome_version` | snake_case → camelCase |
| `createdBy` | `createdBy` | |

### 1.3 Comportamento API

- **POST /v1/clients/query**: interroga prima il DB principale; se `total === 0`, fallback su DB legacy. Stessa logica per **GET /v1/clients/:id** (getClientById).
- **POST /v1/clients** (create) e **PATCH /v1/clients/:id** (update) scrivono solo sul DB principale.

### 1.4 Profilazione (matching, punto 6.2)

Campi da aggiungere in futuro per il matching domanda/offerta (budget, tipologia, zona, preferenze) andranno aggiunti al modello primary; in lettura da legacy si potranno mappare campi esistenti o lasciare undefined.

---

## 2. Appartamenti

### 2.1 DB principale (collection `apartments`)

| Campo API | Campo DB primary | Note |
|-----------|------------------|------|
| `_id` | `_id` | ObjectId → string |
| `workspaceId` | `workspaceId` | |
| `projectId` | `projectId` | |
| `code` | `code` | |
| `name` | `name` | |
| `status` | `status` | AVAILABLE \| RESERVED \| SOLD \| RENTED |
| `mode` | `mode` | RENT \| SELL |
| `surfaceMq` | `surfaceMq` | number |
| `rawPrice` | `rawPrice` | { mode, amount } |
| `planimetryUrl` | `planimetryUrl` | |
| `updatedAt` | `updatedAt` | ISO |
| `createdAt` | `createdAt` | ISO |

### 2.2 DB legacy (DB `asset`, collection `apartments_view`)

| Campo API | Campo legacy | Note |
|-----------|--------------|------|
| `_id` | `_id` | ObjectId → string |
| `workspaceId` | — | valorizzato "legacy" in getById |
| `projectId` | `project_id` | ObjectId/string → string |
| `code` | `code` | default "-" se vuoto |
| `name` | `name` | default "-" se vuoto |
| `status` | `status` + `availability` | normalizzazione: rogitato→SOLD, locato→RENTED, libero→AVAILABLE, altro→RESERVED |
| `mode` | `status` | inferito: se status contiene "loca"/"affit" → RENT, altrimenti SELL |
| `surfaceMq` | `plan.surfaceArea.total \|\| commercial \|\| apartment` | default 0 |
| `rawPrice` | `price` | number → { mode, amount } |
| `planimetryUrl` | — | string vuoto in legacy |
| `updatedAt` | `updatedOn` \|\| `createdOn` | ISO |
| `createdAt` | `createdOn` | ISO |

### 2.3 Comportamento API

- **POST /v1/apartments/query** (apartments.service): prima DB principale; se `total === 0`, fallback su `getDbByName("asset").collection("apartments_view")`.
- **GET /v1/apartments/:id** (future.service): prima DB principale; se non trovato, fallback su DB `asset`, collection `apartments_view`, con mapping `mapLegacyApartmentToDetail`.
- Create/Update scrivono solo sul DB principale.

### 2.4 Profilazione (matching)

Campi come zona, tipologia, numero locali andranno aggiunti al modello primary (e eventualmente letti da campi legacy se presenti); stessi campi usati per lo scoring nel punto 6.2.

---

## 3. Progetto di riferimento `65c4f8958532393892916da1`

Per ispezionare i documenti effettivi di un progetto (es. dev-1):

- **Endpoint:** **GET /v1/inspect/model-sample?projectId=65c4f8958532393892916da1** (richiede JWT). Restituisce un sample anonimizzato di documenti cliente e appartamento (primary e/o legacy) per quel progetto, per allineare il modello e verificare campi presenti in DB.
- In assenza di accesso diretto a MongoDB, si può usare tale endpoint dopo aver configurato l’URI e i DB (primary, client, asset).

---

## 4. Regole di migrazione futura

1. **Nessuna modifica distruttiva** alle collection legacy; solo lettura o estensioni additive (prefisso `tz_`).
2. I campi esposti in API (`ClientRow`, `ApartmentRow` / dettaglio) sono il contratto stabile; in lettura da legacy si mappa allo stesso shape.
3. Nuovi campi di profilazione (matching): aggiungerli prima al modello primary e alle API; in lettura legacy lasciare undefined o mappare dove esiste già un campo equivalente.
4. Eventuale migrazione dati legacy → primary: da pianificare a parte; le API continueranno a supportare il dual-read finché necessario.
