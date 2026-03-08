# Followup 3.0 — Piano di evoluzione a wave

> **Deprecato.** Questo documento è stato sostituito da **[FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md)** (visione, principi e wave in un unico file). Usare quello come riferimento. Il contenuto sotto è conservato per storico.

**Ultimo aggiornamento:** 2026-03-07  
**Regola operativa:** rispettare le wave in ordine; non saltare avanti e indietro. Ogni wave si considera chiusa solo quando i criteri di acceptance sono soddisfatti e i task sono verificati.

---

## 1. North Star e principi

- **North Star:** CRM verticale real estate (rent + sell), multiprogetto, **semplice da usare ogni giorno**. La semplicità e l’estetica vincono sulle funzionalità: poche funzioni chiare che risolvono problemi reali (ispirazione Steve Jobs / Tesla).
- **Riferimento visione funzionale:** il progetto **followup-nova** (Recommerce Nova) in `tecma/business/followup-nova` descrive la direzione di un CRM “vero” verticale immobiliare (apartment-first, request-based per rent, API riusabili anche fuori dal solo CRM). Followup 3.0 evolve in quella direzione **senza big bang**: wave incrementali, design system solido, UX curata.
- **API:** non solo dominio CRM stretto. Le API possono servire anche elenco planimetrie per siti web, preventivatori online, connettori esterni. Contratto REST chiaro e possibilmente domain-neutral dove ha senso (es. `listings`, `contacts`, `deals`).
- **Dati e legacy:** collection Mongo esistenti (es. `user`) **solo lettura** o estensioni additive con prefisso riconoscibile (es. `tz_*`). Niente modifiche massive allo schema legacy.

---

## 2. Stack e design system

- **Frontend:** React + Vite + TypeScript. **Tailwind** come base styling. Design system **forte** e coerente:
  - Token (colori, tipografia, spaziatura) definiti e usati ovunque.
  - Regole di progetto per Figma → codice (Figma MCP + create-design-system-rules) in `.cursor/rules/` o equivalente, per implementazioni 1:1 e convenzioni uniche.
- **Backend:** REST modulare (modular monolith), JWT Followup come identità principale, OpenAPI come contratto.

---

## 3. Wave (ordine vincolante)

### Wave 1 — Foundation e auth solida (stato: **completata**)

**Obiettivo:** Login funzionante (nativo + SSO), identità su JWT Followup, nessuna dipendenza dalla sola lettura del cookie SSO lato frontend per “chi è loggato”.

**Task:**

1. **Auth backend (fatto):**  
   `POST /v1/auth/login`, `GET /v1/auth/me`, verifica password su collection `user` legacy (solo lettura), emissione JWT Followup (access token).  
   *Acceptance:* login con email/password restituisce `accessToken` e `user`; `GET /v1/auth/me` con `Authorization: Bearer` restituisce identità.

2. **Auth frontend (fatto):**  
   Form login nativo in `LoginPage`, salvataggio `followup3.accessToken` in sessionStorage, invio header `Authorization: Bearer` in tutte le chiamate API.  
   *Acceptance:* utente può entrare con email/password e usare l’app; le chiamate API portano il token.

3. **Identità unica su token (fatto):**  
   - `/auth/me` è la sorgente di verità per email/ruolo; `ProjectAccessPage` chiama `me()` al mount e usa l'email restituita (sola lettura).  
   - Gate "loggato" in App usa solo `bypassLogin` o `hasAccessToken`; rimosso l'uso di `getJwtFromCookie()` per considerare l'utente autenticato.
   - SSO BusinessPlatform: al ritorno con cookie SSO ma senza token Followup, `LoginPage` chiama `POST /v1/auth/sso-exchange` con il JWT da cookie; in caso di successo salva `accessToken` e reindirizza; in caso di errore reindirizza al login BusinessPlatform.  
   *Acceptance:* nessun percorso critico usa solo il cookie SSO per identità; `ProjectAccessPage` mostra l'email da token (read-only) e non permette input libero.

4. **Preferenze e scope (fatto):**  
   Preferenze progetti/ambiente salvate in `userPreferences` (Mongo) e in localStorage; selezione progetti full-page con ambiente (dev/demo/prod) e persistenza.  
   *Acceptance:* scelte progetti/ambiente sopravvivono al refresh e, quando implementato, al login da altro device.

**Deliverable Wave 1:** Login nativo e SSO operativi; identità e autorizzazione basate su JWT Followup; UX login e selezione progetti coerente e senza sovrapposizioni.

---

### Wave 2 — Design system e Tailwind (stato: **completata**)

**Obiettivo:** Tailwind come unica base di styling; design system esplicito (tokens, componenti, regole Figma) e regole progetto per AI/implementazioni.

**Task:**

1. **Tailwind e tokens (fatto):**  
   Confermare Tailwind come standard in `fe-followup-v3`; introdurre/estendere `tailwind.config` con tema (colori, font, radius, spacing) allineato al design Tecma/Followup.  
   *Acceptance:* nessun nuovo stile “a mano” fuori da utility Tailwind o da token del tema; file CSS globali minimi e solo per variabili/token.

2. **Design system rules (Figma MCP) (fatto):**  
   Usare **create-design-system-rules** (e Figma MCP) per generare regole di progetto (es. `.cursor/rules/figma-design-system.mdc` o `CLAUDE.md`): dove stanno i componenti, come mappare Figma → Tailwind, dove mettere asset, flusso get_design_context + get_screenshot prima dell’implementazione.  
   *Acceptance:* esiste un file di regole design system referenziato dal progetto; le implementazioni Figma seguono quel flusso e le convenzioni definite.

3. **Componenti UI core (fatto):**  
   LoginPage e ProjectAccessPage usano `Button`, `Input` da `src/components/ui/` e classi token. PageTemplate (shell) allineato a token (border-border, bg-app, font-body, shadow-sidebar-nav, text-primary). Rimosse classi hex ad hoc.  
   *Acceptance:* auth e shell usano componenti e token coerenti; nessun pattern divergente.

**Deliverable Wave 2:** Design system documentato e applicato; Tailwind + tokens + regole Figma come standard; base pronta per espandere le schermate senza drift visivo.

---

### Wave 3 — UX core: poche funzioni, chiare e utilizzabili (stato: **in corso**)

**Obiettivo:** Consolidare le funzionalità core (cockpit/home, clienti, appartamenti, calendario) con UX semplice e pochi click; nessuna proliferazione di feature secondarie prima di aver reso solide e usabili le principali.

**Task:**

1. **Cockpit / Home:**  
   Una sola “home” action-first: cosa richiede attenzione oggi (scadenze, prossimi appuntamenti, azioni suggerite). Layout chiaro, pochi blocchi, CTA evidenti.  
   *Acceptance:* l’utente capisce in pochi secondi “cosa fare” dalla home; tempo e click per le azioni quotidiane ridotti (target qualitativo: “molto più semplice del vecchio followup”).

2. **Liste e schede:**  
   Liste clienti e appartamenti con filtri essenziali, ricerca, e apertura scheda dettaglio. Schede dettaglio con informazioni essenziali in primo piano; campi avanzati in progressive disclosure (es. “Mostra altro”).  
   *Acceptance:* creazione/modifica di un cliente o appartamento avviene in pochi step; nessun form “muro di campi”.

3. **Calendario:**  
   Vista calendario multiprogetto coerente con il resto dell’UI; creazione/modifica evento semplice (form breve).  
   *Acceptance:* utente può vedere e gestire eventi senza dover cambiare contesto o pagina inutilmente.

**Deliverable Wave 3:** Esperienza quotidiana del CRM concentrata su poche azioni chiare; metriche qualitative (semplicità, pochi click) prioritarie rispetto al numero di funzionalità.

---

### Wave 4 — Modello dominio: Requests e allineamento rent/sell

**Obiettivo:** Allineare il modello dominio al mondo “request-based” (come in followup-rent / followup-nova) dove ha senso: una trattativa/richiesta come entità first-class, non solo “quote” in senso classico. Coerenza rent + sell nel modello dati e nelle API.

**Task:**

1. **Modello e API:**  
   Definire (o adottare) il concetto di **Request/Deal** unificato (rent + sell): stati, transizioni, associazioni cliente-appartamento. Esporre API REST coerenti (es. `deals` o `requests`) con stesso contratto query (workspaceId, projectIds, filtri, paginazione).  
   *Acceptance:* documentazione modello Request/Deal; almeno un endpoint query/list che segue il pattern condiviso.

2. **UI trattative/richieste:**  
   Una vista (lista o kanban) sulle trattative/richieste con filtri essenziali e dettaglio. Nessuna duplicazione di logica tra rent e sell; stessa UX, dati eventualmente etichettati per tipo.  
   *Acceptance:* l’utente può elencare e aprire il dettaglio di una trattativa/richiesta in modo chiaro e uniforme.

**Deliverable Wave 4:** Modello unificato request/deal; API e UI allineate a rent+sell e pronte per evoluzioni (workflow, automazioni).

---

### Wave 5 — API riusabili e dominio “pubblico”

**Obiettivo:** Esporre API utili anche fuori dal solo CRM: es. elenco listing/appartamenti (o planimetrie) per siti web o preventivatori online; contratti chiari e possibilmente domain-neutral dove serve.

**Task:**

1. **Endpoint “pubblici” o scope-limited:**  
   Definire e implementare almeno un endpoint riutilizzabile (es. listati per progetto/workspace, con filtri e paginazione) con contratto stabile e documentato (OpenAPI). Autenticazione dove necessario (API key o JWT con scope limitato).  
   *Acceptance:* documento che descrive l’uso dell’endpoint (es. “elenco planimetrie per sito”); OpenAPI aggiornato; chiamata di test funzionante.

2. **Separazione concettuale:**  
   Chiarire in documentazione quali API sono “core CRM” e quali “servizi riusabili” (listing, export, ecc.) per evitare accoppiamento indebito.  
   *Acceptance:* sezione in docs (o README) che elenca le API per uso esterno e le convenzioni.

**Deliverable Wave 5:** Almeno un’API riusabile fuori dal CRM; contratto e documentazione pronti per integrazioni (siti, preventivatori, connettori).

---

### Wave 6 — Hardening auth e sicurezza

**Obiettivo:** Refresh token, revoca, audit login; enforcement lato backend su tutte le API sensibili.

**Task:**

1. **Refresh token e logout:**  
   Implementare refresh token (opaco, memorizzato in `tz_authSessions` o simile), endpoint `POST /v1/auth/refresh` e `POST /v1/auth/logout`. Frontend: gestione rinnovo automatico su 401 e logout che invalida sessione.  
   *Acceptance:* sessione lunga senza ri-login; logout invalida refresh lato server.

2. **Middleware auth su API:**  
   Proteggere con middleware JWT tutte le route `/v1` eccetto health, openapi, login, refresh, sso-exchange (e eventuali endpoint pubblici definiti in Wave 5). `req.user` popolato da token.  
   *Acceptance:* chiamate senza token valido ricevono 401; nessun endpoint sensibile accessibile senza auth.

3. **Audit e policy:**  
   Log eventi di login/logout (e opzionalmente refresh) in collection dedicata (es. `tz_authEvents`). Documentare policy di retention e uso.  
   *Acceptance:* almeno login/logout tracciati; policy descritta in docs.

**Deliverable Wave 6:** Auth enterprise-grade (access + refresh, revoca, audit); API protette e identità sempre da token.

---

### Wave 7 — AI e automazioni (dopo foundation solida)

**Obiettivo:** Suggerimenti e automazioni solo dopo che core e UX sono stabili. Human-in-the-loop e policy chiare.

**Task:**

1. **Suggerimenti read-only:**  
   Primi suggerimenti operativi (es. “cosa fare oggi”, priorità) senza scrittura automatica. UI minimale (card o lista) con CTA “Esegui” che porta l’utente all’azione.  
   *Acceptance:* almeno un tipo di suggerimento visibile in cockpit/home; nessuna modifica dati senza azione esplicita utente.

2. **Approvazioni e audit:**  
   Per eventuali azioni “draft” (es. invio reminder, creazione task) introdurre step di approvazione e tracciamento.  
   *Acceptance:* azioni ad alto impatto richiedono conferma; evento registrato.

**Deliverable Wave 7:** Primo step AI/automazioni senza compromettere semplicità; base per estensioni successive (MCP, connettori).

---

## 4. Riepilogo ordine wave e dipendenze

| Wave | Nome breve           | Dipende da   | Stato      |
|------|----------------------|-------------|------------|
| 1    | Foundation e auth    | —           | Completata |
| 2    | Design system        | Wave 1      | Completata |
| 3    | UX core              | Wave 1, 2   | Da fare    |
| 4    | Requests / rent+sell | Wave 1, 3   | Da fare    |
| 5    | API riusabili        | Wave 1, 4   | Da fare    |
| 6    | Hardening auth       | Wave 1      | Da fare    |
| 7    | AI e automazioni     | Wave 1–3    | Da fare    |

- **Wave 6** può essere anticipata subito dopo il completamento di Wave 1 se si vuole massima sicurezza prima di espandere feature.
- **Wave 2** e **Wave 3** sono consigliate in sequenza (prima design system, poi consolidamento UX) per evitare drift visivo.

---

## 5. Riferimenti

- **Visione prodotto e funzionalità:** `followup-nova` (Recommerce Nova), `CRM_ENTERPRISE_WAVES.md` e README in `tecma/business/followup-nova`.
- **Piani esistenti Followup 3.0:** `docs/FOLLOWUP_3_MEGA_CRM_MASTERPLAN.md`, `docs/FOLLOWUP_FUTURE_AI_NATIVE_PLAN.md`.
- **Auth e identità:** design già discusso (JWT Followup, collection `user` in lettura, `tz_*` per sessioni/audit); dettagli in conversation e in codice `be-followup-v3/src/core/auth/`.
- **Design system:** skill create-design-system-rules; Figma MCP per contesto e screenshot; Tailwind e token in `fe-followup-v3`.

---

## 6. Regole non negoziabili

1. **Rispettare l’ordine delle wave:** non implementare task di una wave successiva prima di aver chiuso i task della wave corrente (salvo eccezioni esplicite concordate).
2. **UX e semplicità prima delle feature:** meglio poche funzioni chiare e usabili che molte confuse; ogni nuova schermata deve ridurre frizione, non aggiungerla.
3. **Legacy e dati:** nessuna modifica distruttiva alle collection esistenti; solo lettura o estensioni additive (prefisso `tz_` o collection dedicate).
4. **Un solo piano di riferimento:** questo documento è il piano di evoluzione di Followup 3.0; aggiornarlo quando una wave viene chiusa o quando si aggiunge un task concordato.
