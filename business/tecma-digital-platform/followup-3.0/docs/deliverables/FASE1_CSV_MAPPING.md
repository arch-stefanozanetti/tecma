# Fase 1 — Mapping legacy → FollowUp 3.0 (data_first)

**Stato:** matrice operativa — colonne **legacy** da compilare con i nomi reali dei CSV/export o dei documenti Mongo read-only; la colonna **Destinazione** riflette il modello attuale nel codice (baseline repo). **Quote:** mapping esplicito `asset.quotes` → `tz_quotes` + due modalità (migrato vs digitale) documentato sotto (Ciclo 3, 2026-04-14).

**Correlati:** [LEGACY_MONGO_INVENTORY.md](./LEGACY_MONGO_INVENTORY.md), [PILOT_ETL_RUNBOOK.md](./PILOT_ETL_RUNBOOK.md), [PIANO_GLOBALE_FOLLOWUP_3.md](../PIANO_GLOBALE_FOLLOWUP_3.md) §6.

---

## Input richiesti

- [x] Inventario sorgenti Mongo read-only disponibile in [LEGACY_MONGO_INVENTORY.md](./LEGACY_MONGO_INVENTORY.md)
- [ ] CSV o export **clienti** (campione + dizionario colonne) **oppure** campioni documenti da `client.clients`
- [ ] CSV o export **appartamenti** **oppure** campioni da `asset.apartments_view` / `asset.appartments`
- [x] Sorgente **quote** disponibile in lettura: collection Mongo **`asset.quotes`** (stesso contenuto utilizzabile per CSV export se necessario); campione + schema in sezione Field coverage e tabella mapping sotto.
- [ ] Export **utenti** legacy (email, ruolo, legame progetto) da `user.users` per [RBAC_LEGACY_TO_WORKSPACE_MAPPING.md](./RBAC_LEGACY_TO_WORKSPACE_MAPPING.md)

## Volumetria reale (snapshot 2026-03-26)

| Dominio | Sorgente legacy | Documenti |
|---------|------------------|----------:|
| Appartamenti | `asset.apartments_view` | 22952 |
| Appartamenti (storico naming) | `asset.appartments` | 22952 |
| Plan / extra | `asset.plans` | 17582 |
| Typology | `asset.typologies` | 963 |
| Quote | `asset.quotes` | 6057 |
| Clienti | `client.clients` | 15694 |
| Trattative | `client.requests` | 4762 |
| Utenti | `user.users` | 2091 |
| Stati trattativa | `status-automata.request_status` | 4149 |

Questa volumetria rende il piano ETL misurabile e consente di definire KPI di completezza per il pilota.

## Field coverage reale (schema inferito + frequenza chiavi)

### Appartamenti legacy (`asset.apartments_view`)

- Schema inferito su campione: **20 campi top-level**.
- `extraInfo` contiene numerose chiavi eterogenee (pattern `kebab-case`, spazi, slash), inclusi attributi non presenti nel modello attuale.
- Top chiavi `extraInfo` per frequenza (conteggio documenti):
  - `spese-condominiali` (1637), `riscaldamento` (1298), `disponibilità` (1267)
  - `stato` (1106), `esposizione` (1105), `totale-piani` (1105), `classe-energetica` (1105)
  - `balcone/terrazzo/giardino` (1105), `pertinenza` (1103), `descrizione-immobile` (1078)

**Gap concreto:** il modello `tz_apartments` oggi copre il core (`code`, `name`, `status`, `mode`, `surfaceMq`, `rawPrice`), ma non normalizza nativamente gran parte di `extraInfo`/`plan`/`typology`.

### Piani e tipologie (`asset.plans`, `asset.typologies`)

- `asset.plans`: **29 campi** (incluse superfici legacy `Superficie*`, `mainFeatures`, `surfaceArea`, `extraInfo` esteso).
- `asset.typologies`: **14 campi** (`rooms`, `active`, visibilità web/desk, ecc.).

**Gap concreto:** presenza di doppia semantica (campi storici `Superficie*` + strutture moderne `surfaceArea`) da armonizzare in una sola proiezione FE/BE.

### Clienti legacy (`client.clients`)

- Schema inferito su campione: **51 campi**.
- Campi non presenti nel create/update attuale ma rilevanti:
  - `coniuge`, `family`
  - `privacyInformation` (storico consensi a snapshot temporali)
  - `additionalInfo` (campagna, vendor riferimento, stato lead, tag)
  - `activityState`, `activityStateHistory`, `surveyInfo`

**Gap concreto:** necessario mappare questi blocchi su `extraInfo`/metadata e decidere il trattamento privacy (vedi spike GDPR).

### Quote legacy (`asset.quotes`)

- Schema inferito su campione: **20 campi top-level**, con payload annidato esteso (`customQuote`, `proposals`, `importantInfo`, `savedDocuments`).

**Gap concreto:** il nuovo modello `tz_quotes` deve prevedere una strategia di snapshot progressivo: P0 per `quoteNumber/status/total/expiry`, P1+ per dettagli finanziari e documentali avanzati.

### Richieste legacy (`client.requests`)

- Schema inferito su campione: **28 campi** (`status`, `requestStatus`, `quote_id`, `spaceType`, `rentPayments`, `priceDetails`, ecc.).

**Gap concreto:** coesistono semantiche duplicate (`status` vs `requestStatus`) da consolidare nella macchina a stati nuova.

---

## Processo

1. Per ogni sorgente: elencare colonne/campi → tipo → obbligatorietà legacy.
2. Mappare su: campo API / Mongo `tz_*` **oppure** estensione (`extraInfo`, `legacyMetadata`) **oppere** “display only / non importare” con motivazione.
3. Definire ordine di implementazione: estensione schema + API prima di import batch massivo.

---

## Cliente → `tz_clients`

Riferimento codice: `ClientCreateSchema` in [`clients.service.ts`](../../be-followup-v3/src/core/clients/clients.service.ts) (`workspaceId`, `projectId`, `firstName`, `lastName`, `email`, `phone`, `status`, `city`, `marketingAttribution`).

| Colonna / campo legacy | Tipo | Note legacy | Destinazione Followup 3 | Priorità |
|------------------------|------|-------------|-------------------------|----------|
| _id legacy | ObjectId | chiave sorgente | `legacySourceId` / metadata migrazione (non sostituire `_id` se già generato) | P0 |
| progetto / progettoId | string | scope CRM | `projectId` (+ `workspaceId` da tabella progetto→workspace) | P0 |
| nome / cognome / ragione sociale | string | | `firstName`, `lastName` (o split da `fullName` con `splitLegacyFullName`) | P0 |
| email | string | | `email` (unicità per `workspaceId`) | P0 |
| telefono | string | | `phone` | P1 |
| stato / funnel | string | enum legacy variabile | `status` ∈ `lead|prospect|client|contacted|negotiation|won|lost` — tabella mapping se enum diversa | P0 |
| città | string | | `city` | P2 |
| attribuzione marketing | oggetto | | `marketingAttribution` | P2 |
| campi CRM extra (famiglia, coniuge, note, …) | mixed | spesso presenti in legacy | `extraInfo` o sezione documentata; oppure `tz_additional_infos` se modello già in uso | P1/P2 |
| consensi GDPR | — | vedi [GDPR_CONSENT_SCOPE_SPIKE.md](./GDPR_CONSENT_SCOPE_SPIKE.md) | flag / metadata per contesto progetto vs workspace | **Legale** |

---

## Appartamento → `tz_apartments` (+ catalogo opzionale)

Riferimento codice: `ApartmentCreateSchema` e `RawApartment` in [`apartments.service.ts`](../../be-followup-v3/src/core/apartments/apartments.service.ts); arricchimenti catalogo in [`catalog.service.ts`](../../be-followup-v3/src/core/catalog/catalog.service.ts) (`extraInfo`, `cadastral`, import Tecma sell/rent).

| Colonna / campo legacy | Tipo | Note legacy | Destinazione Followup 3 | Priorità |
|------------------------|------|-------------|-------------------------|----------|
| codice / unit | string | | `code` | P0 |
| nome / label | string | | `name` | P0 |
| prezzo vendita / canone | number | | `rawPrice.amount` + `rawPrice.mode` (`RENT`/`SELL`) | P0 |
| piano | number | | `floor` | P0 |
| mq / superficie | number | | `surfaceMq` | P0 |
| stato disponibilità | enum | | `status` ∈ `AVAILABLE|RESERVED|SOLD|RENTED` — mapping da stati legacy | P0 |
| planimetria URL | string | | `planimetryUrl` | P0 |
| deposito / cauzione | number | | `deposit` (opzionale) | P2 |
| extra info / plan / typology / planimetrie extra | string / doc | molti attributi in legacy | `extraInfo` (record chiave→valore), `cadastral[]` come da parser catalogo; estendere Zod/OpenAPI se necessario per UI | P1 |
| id legacy | ObjectId | | metadata migrazione + `legacySourceId` | P0 |

---

## Quote / preventivi → `tz_quotes` + campi su `tz_requests`

Riferimenti codice:

- **Preventivo digitale (nuovo):** [`quotes.service.ts`](../../be-followup-v3/src/core/quotes/quotes.service.ts) — `createDigitalQuote`, `tokenHash`, `pdfStorageKey`, `totalPrice`, `requestId`, `clientId`.
- **Migrazione pilota legacy:** [`migrate-legacy-pilot.ts`](../../be-followup-v3/scripts/migration/migrate-legacy-pilot.ts) — upsert da `asset.quotes` con blocco `migration.*`.
- Seed demo: [`seedFullDemo.ts`](../../be-followup-v3/src/utils/seedFullDemo.ts).

### Due modalità sulla stessa collection `tz_quotes`

| Modalità | Origine | Campi distintivi | Flusso pubblico / PDF |
|----------|---------|------------------|------------------------|
| **Digitale** | `POST /v1/requests/:requestId/quotes` → `createDigitalQuote` | `requestId`, `clientId`, `tokenHash` (hash SHA-256 del token), `totalPrice`, `pdfStorageKey`, `status` tipicamente `sent` | Sì: URL `/v1/public/quotes/:token`, PDF su S3 |
| **Migrato** | Script pilota `asset.quotes` → `tz_quotes` | `migration.legacyId`, `migration.legacyCollection`, `migration.runId`, `legacyClientId`, `legacyApartmentId`, `customQuote` snapshot; **nessun** `tokenHash` finché non si rigenera un flusso digitale | No, finché non si crea una nuova quote digitale collegata alla trattativa |

Le quote migrate non espongono il magic link storico: per offrire pagina pubblica + PDF occorre il flusso digitale (nuovo record o estensione prodotto non ancora nel pilota).

### Mapping esplicito `asset.quotes` → `tz_quotes` (pilota migrazione)

Campi lato legacy letti dallo script (nomi tipici dal dominio `asset`; verificare su campione Mongo se divergenti):

| Campo / percorso legacy (`asset.quotes`) | Tipo | Destinazione `tz_quotes` | Note |
|------------------------------------------|------|---------------------------|------|
| `_id` | ObjectId | — | Tracciato in `migration.legacyId`; nuovo `_id` generato su insert |
| `project_id` | ObjectId | `projectId` (via mappa legacy→target) | Obbligatorio per scope workspace |
| `quoteNumber` | string | `quoteNumber` | Fallback `LQ-{suffix}` in script |
| `status` | string | `status` | Default `draft` se assente |
| `expiryOn` | date/string | `expiryOn` | Può essere `null` |
| `customQuote` | object | `customQuote` | Snapshot JSON completo legacy (P1+ dettagli economici) |
| `client` | ObjectId | `legacyClientId` | Hex string; risoluzione `clientId` post-migrazione avviene con allineamento `tz_requests` / clienti |
| `appartment` | ObjectId | `legacyApartmentId` | Naming storico legacy (typo noto) |
| — | — | `workspaceId` | Da contesto workspace pilota |
| — | — | `migration` | `{ legacySourceDb, legacyCollection: "quotes", legacyId, runId }` |

Campi **non** popolati dalla migrazione pilota ma presenti sul flusso digitale: `requestId`, `tokenHash`, `totalPrice` (top-level), `pdfStorageKey`, `createdBy`. Il totale economico P0 per UI/report: in migrazione, se presente in legacy, viene impostato `totalPrice` tramite [`extractLegacyQuoteTotalPrice`](../../be-followup-v3/src/core/quotes/legacy-quote-total.ts) (top-level o `customQuote.totalPrice` / `customQuote.total`).

**Lista CRM:** `POST /v1/quotes/query` (permesso `requests.read`) restituisce righe `QuoteListRow` senza esporre `tokenHash`.

### Allineamento `tz_requests`

Dopo migrazione richieste, lo script collega `quote_id` legacy → id `tz_quotes` tramite mappa `legacyQuoteToTarget` e aggiorna la trattativa (`quoteId`, ecc. dove previsto nel loop richieste). Verificare coerenza con [`requests.service.ts`](../../be-followup-v3/src/core/requests/requests.service.ts) per stati `quote` e snapshot prezzo.

| Campo legacy | Tipo | Note | Destinazione | Priorità |
|-------------|------|------|--------------|----------|
| id preventivo legacy | string | entry point trattative SELL | `tz_quotes._id` o traccia `migration.legacyId` + `request.quoteId` dopo join migrazione | P0 |
| numero | string | | `quoteNumber` | P0 |
| totale | number | | `totalPrice` (digitale) o `customQuote.*` (migrato) | P0 |
| scadenza | date | | `expiryOn` | P1 |
| stato | enum | | `status` + allineamento `quoteStatus` su `tz_requests` | P0 |

---

## Utenti → `user` + `tz_users` + workspace

**Nota:** login legacy legge ancora la collection `user` in read-only per password; inviti e `tz_users` sono descritti nel [README.md](../../README.md). La tabella dettagliata ruoli è in [RBAC_LEGACY_TO_WORKSPACE_MAPPING.md](./RBAC_LEGACY_TO_WORKSPACE_MAPPING.md).

| Campo legacy | Destinazione | Priorità |
|-------------|--------------|----------|
| email | chiave univoca invito; `user.workspaces[]` + documento `tz_users` | P0 |
| ruolo legacy (vendor, front office, …) | `roleKey` workspace + `tz_workspace_user_projects` | P0 |
| progetti assegnati | `tz_workspace_user_projects` | P0 |

---

## Output atteso

MR che aggiorna questo file + script di import / ETL su campione anonimizzato + test; verificare `npm run test` / integrazione dove applicabile.
