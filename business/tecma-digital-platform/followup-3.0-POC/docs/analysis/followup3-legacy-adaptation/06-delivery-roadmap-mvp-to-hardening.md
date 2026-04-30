# Roadmap — MVP → hardening (Followup 3.1 su legacy source-of-truth)

## Principi di slicing

Ogni slice deve essere:

- **deployabile** in staging con feature flag
- **misurabile** con test minimi (API + 1–2 scenari E2E)
- **rollbackabile** (flag off + nessuna migrazione distruttiva)

## Slice 0 — Decisioni architetturali (bloccanti, 1–2 giorni)

Output: ADR brevi (anche in repo `docs/adr/` se il team lo usa).

Decisioni obbligatorie:

1. **AUTH_MODE**: `bss` vs `followup` vs `hybrid` (definizioni in `03-backend-adaptation-spec.md`)
2. **Percorso dati**:
   - target approvato: scritture domini legacy su legacy/BSS + `tz_*` additive
   - fuori scope: nuovo DB target greenfield + migrazione/cutover
3. **Topologia Mongo**:
   - Legacy primary DB read/write per domini legacy
   - eventuale DB additivo per capability non coperte dal legacy
4. **Source of truth progetti**:
   - BSS `project_id` è canonical?
   - `tz_projects.legacyProjectId` è obbligatorio per ogni progetto “bridge”?

**Criteri di uscita**

- firmato da: Engineering + Security (+ CTO se hybrid)

## Slice 1 — MVP tecnico “safe”: separazione domini + write governance

### Obiettivo

Rendere il runtime robusto: write legacy solo via percorsi approvati, no bypass non governati.

### Lavori tipici (BE)

- introdurre layer di accesso legacy con confini chiari (read/write)
- spostare letture/scritture legacy dietro servizi unificati (no accesso raw diffuso)
- aggiungere guardrail su write non approvate

### Lavori tipici (OPS)

- provisioning credenziali e ruoli DB coerenti per domini legacy/additive
- utenti DB separati (principle of least privilege)

### Test minimi

- smoke boot: app parte con connessioni legacy/additive corrette
- prova negativa: tentativo di write legacy fuori dai servizi approvati viene bloccato

**Criteri di uscita**

- write legacy tracciate solo su percorsi approvati

## Slice 2 — MVP prodotto: autenticazione “scelta” + session/projects funzionanti

### Variante A (BSS-first)

- FE: selezione `project_id` prima del login (o wizard)
- FE: `loginBss` + refresh BSS
- BE: (opzionale) nessun JWT followup in MVP

### Variante B (Followup-first)

- FE: mantiene `postAuthLogin`
- BE: mantiene refresh opaco (`tz_authSessions`)
- Gateway: merge addizioni per session (`openapi-tecma-bss-additions.yaml`)

### Lavori trasversali

- chiudere incoerenza `tz_users` vs `USER_COLLECTION_CANDIDATES` (vedi `04-data-adaptation-spec.md`)

### Test minimi

- login end-to-end (modalità scelta)
- refresh end-to-end
- `projects-by-email` coerente con `project_ids` noti su utenti di test

**Criteri di uscita**

- nessun “silent wrong project list” su 10 account campione

## Slice 3 — Workspace MVP: tenancy additiva + permessi stabili

### Obiettivo

Garantire che workspace/membership/assignments siano funzionanti e coerenti con utenti/progetti legacy.

### Lavori

- disabilitare o proteggere `ensureDefaultWorkspaces()` in produzione (oggi auto-seed se vuoto)
- completare enforcement `access_scope` (gap documentato in `01` e `03`)

### Test minimi

- utente non-member: non può accedere a workspace altrui (`canAccess`)
- assignment: visibilità liste clienti/appartamenti rispetta regole (`entity-assignment-query.util.ts`)

**Criteri di uscita**

- test automatici su `access_scope` + liste (unit/integration)

## Slice 4 — Integrazione CRM legacy read/write via BSS/servizi approvati

### Obiettivo

Per 1–2 entità critiche (es. clients + apartments), definire mapping query e comandi FE → endpoint/servizi legacy approvati.

### Lavori

- implementare `legacyBss` client + mapper errori
- definire subset campi MVP (evitare parity totale subito)
- implementare create/update/delete dove richiesto dal prodotto usando legacy/BSS, con audit e rollback funzionale

### Test minimi

- confronto record count su campione progetto (tolleranza definita)
- smoke write su staging legacy per create/update con verifica dati lato BSS/DB
- latenza p95 su query tipica (SLO da definire)

**Criteri di uscita**

- FE può operare con dati letti e scritti via legacy/BSS per gli screen MVP selezionati

## Slice 5 — Hardening: contratti, osservabilità, sicurezza

### OpenAPI / gateway

- merge ufficiale addizioni + lint Spectral clean (`05-api-contract-alignment-spec.md`)
- allineare public swagger su shape `/login` reale o generare public da raw (policy repo)

### Security

- threat model su proxy HTTP verso Followup
- rate limit end-to-end (FE + gateway + BE)

### Observability

- traceId condiviso FE→BE→BSS (header), correlazione audit

**Criteri di uscita**

- checklist security firmata + dashboard errori per integrazioni BSS

## Dipendenze e parallelizzazione

Parallelizzabile:

- Slice 1 (DB) + Slice 0 (decisioni) dopo decisione topologia
- Slice 5 (docs/contract) può iniziare dopo Slice 2 ma prima della GA se possibile

Sequenziale:

- Slice 4 dipende da Slice 2 (token/scoping coerente)

## Definition of Done (release “GA adattiva”)

- `AUTH_MODE` unico in prod (o hybrid esplicitamente approvato e osservabile)
- write legacy governate e tracciate; nessun bypass non approvato
- workspace + assignments + auth + 2 moduli CRM letti/scritti via BSS o servizi legacy passano test minimi in staging
- OpenAPI merged e lintato senza errori sui path Followup esposti

### Deliverable di test per slice (da allegare allo sprint review)

- **Slice 0–1**: decisioni ADR + script o query di smoke DB (connessione dual DB) con output salvato.
- **Slice 2–3 (auth/token)**: tabella `07` §9b compilata per R-AUTH-*; esiti Newman o Postman export allegati.
- **Slice workspace/inviti**: casi `07` §9 (invito scaduto, revoca, non-member 403) eseguiti in staging — screenshot log o report QA.
- **Slice progetti (`12`)**: test automatici o manuali documentati per `workspaceId` query obbligatoria e 404 progetto non nel workspace.
- **Pre-GA**: checklist `07` §9a firmata da owner Security/Platform (anche async su ticket) e link al dashboard errori menzionato in §Observability.
