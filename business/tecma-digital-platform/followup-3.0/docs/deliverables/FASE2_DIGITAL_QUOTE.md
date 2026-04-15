# Fase 2 — Preventivo digitale + magic link

**Dipendenze:** Fase 1 (modello quote), Fase 3 (bucket S3 funzionante).

## Obiettivo prodotto

- Transizione stato trattativa → creazione record preventivo.
- Pagina pubblica con token firmato, scadenza, audit.
- PDF generato → upload storage → URL persistito.

## Passi implementativi suggeriti

1. Schema persistito `tz_quotes` (o equivalente) allineato al mapping Fase 1.
2. Servizio generazione token magic link (secret env, TTL configurabile).
3. Route pubblica read-only + rate limit.
4. Pipeline PDF (libreria scelta in repo) + `assets-s3.service` per upload.
5. FE admin: anteprima, rigenera link, stato invio.

## Stato implementazione nel repo (Followup 3.0)

| Area | Stato | Riferimenti |
|------|--------|-------------|
| Modello `tz_quotes` + token | Fatto | `quotes.service.ts` (`COLLECTION`), `tokenHash`, `pdfStorageKey` |
| Creazione da UI (trattativa → preventivo) | Fatto | `RequestsPage.tsx`: blocco «Preventivo digitale» se il workflow consente lo stato `quote` (`canOfferDigitalQuote`); API `createDigitalQuote` su trattativa |
| PDF + upload S3 | Fatto | `buildQuotePdfBuffer` + `putObjectBuffer`; rollback su errore |
| Route pubblica read-only + rate limit | Fatto | `GET /v1/public/quotes/:token` in `public.routes.ts` + `publicApiRateLimiter` |
| Lista preventivi (staff) | Fatto | `POST /v1/quotes/query`, sezione **Preventivi** in `RequestsPage` |
| Risposta pubblica | JSON | `getQuotePublicByToken` restituisce dati + URL presignato PDF (`pdfDownloadUrl`); nessuna pagina HTML cliente dedicata in questo repo |
| Test automatici BE (pubblico) | Fatto | `quotes.service.test.ts`: token assente / non trovato / scaduto / valido + presign S3 + nome cliente; `routes/v1.test.ts`: `GET /v1/public/quotes/:token` anonimo |

## Definition of Done (chiusura tema / QA)

Checklist da chiudere quando **QA su staging** (o equivalente) ha verificato i flussi end-to-end. L’implementazione tecnica in repo copre i tre punti sotto.

- [ ] Creazione quote da UI con stato trattativa — *criterio:* da una trattativa il workflow permette «Preventivo»; form importo/scadenza; trattativa aggiornata a `quote` con metadati preventivo.
- [ ] Link pubblico valido fino a scadenza — *criterio:* `GET …/public/quotes/:token` restituisce dati prima della scadenza e nega accesso utile dopo (es. `found: false`).
- [ ] PDF e URL salvati e verificabili — *criterio:* oggetto presente su bucket; download tramite URL presignata nella risposta pubblica; coerenza importo in PDF.

**Nota:** per marcare `[x]` qui serve evidenza di test (manuale o automatico) su ambiente con S3 e API reali.

---

## Checklist QA (staging)

**Prima di iniziare**

- Ambiente con **bucket S3** e credenziali AWS valide (stesso percorso del deploy Followup).
- Utente con permessi **`requests.read`**, **`requests.update`** (e creazione trattativa se serve una nuova richiesta).
- Progetto con **workflow** che consente la transizione allo stato **Preventivo** (`quote`) dal tipo di trattativa usato (es. vendita/affitto).

### 1. Creazione da UI (allinea DoD: creazione quote + stato trattativa)

1. Vai a **Trattative** e seleziona una trattativa **non** ancora in stato preventivo, per cui il workflow permette ancora di passare a «Preventivo» (o creane una nuova e portala allo stato precedente al preventivo, secondo il workflow).
2. Apri il dettaglio (drawer) e scorri fino a **Preventivo digitale**.
3. Compila **Importo** e **Scadenza** (data futura) e invia **Genera preventivo e link**.
4. **Atteso:** messaggio di successo; la trattativa risulta aggiornata con numero preventivo / importo / scadenza; compare il **link pubblico** (copialo).
5. Nella stessa pagina, verifica che la sezione **Preventivi** (sotto la board) elenchi il nuovo record dopo **Aggiorna elenco** (se applicabile).

*Evidenza per chiudere il punto DoD:* screenshot o breve nota su ID trattativa + ID preventivo.

### 2. Link pubblico + JSON (allinea DoD: link valido fino a scadenza)

L’URL assoluto è tipicamente `{base API}/public/quotes/{token}`, dove `{base API}` è il valore configurato nel front (es. prefisso `/v1` o URL completo del servizio) e il path relativo restituito dall’API è `/public/quotes/...`.

1. Con browser **non autenticato** (finestra anonima) oppure con `curl` / REST client **senza** header `Authorization`:
   - `GET {base}/public/quotes/{token}`  
   (es. `GET https://<host-api>/v1/public/quotes/<token>` se il gateway espone sotto `/v1`).
2. **Atteso (prima della scadenza):** risposta `200` con corpo JSON che include `data.found === true`, `quoteNumber`, `totalPrice`, `expiryOn`, e se il PDF è stato caricato anche `pdfDownloadUrl` / `pdfExpiresAt`.
3. **Dopo la scadenza** (ripeti il giorno successivo o con una seconda prova usando **scadenza nel passato** non permessa dal form — in tal caso per test tecnico si può aggiornare solo `expiryOn` su `tz_quotes` in Mongo su staging, operazione da chi ha accesso DB):
   - **Atteso:** `data.found === false` (nessun dettaglio commerciale esposto).

*Evidenza:* output JSON (anonimizzato) o descrizione del comportamento prima/dopo scadenza.

### 3. PDF e URL (allinea DoD: PDF e URL verificabili)

1. Dalla risposta pubblica del passo 2, copia `data.pdfDownloadUrl` (URL presignata).
2. Apri l’URL nel browser o `curl -L -o quote.pdf "<pdfDownloadUrl>"`.
3. **Atteso:** file PDF scaricabile; contenuto coerente con importo e numero preventivo (verifica visiva).
4. Opzionale: in console AWS (o strumento equivalente), verifica che esista l’oggetto sotto il prefisso `workspaces/.../quotes/...pdf` per lo stesso `quoteId`.

*Evidenza:* conferma download riuscito + (opzionale) hash o nome file.

### Chiusura

Quando i tre blocchi sopra sono OK, spunta le checkbox nella sezione **Definition of Done** in cima a questo documento e aggiorna [`IMPLEMENTATION_TRACKER.md`](../../tasks/IMPLEMENTATION_TRACKER.md) (`digital-quote` → `[x]` se il team considera chiuso il tema).
