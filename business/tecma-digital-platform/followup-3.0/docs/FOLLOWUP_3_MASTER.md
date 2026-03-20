# Followup 3.0 — Documento maestro (prodotto e wave)

**Ultimo aggiornamento:** 2026-03-20  
**Piano globale unico (backlog, fasi, checklist):** [PIANO_GLOBALE_FOLLOWUP_3.md](PIANO_GLOBALE_FOLLOWUP_3.md).  
**Uso di questo file:** visione, principi e wave; per priorità e implementazione aggiornare solo il piano globale.

---

## 1. North Star e principi

- **North Star:** CRM verticale real estate (rent + sell), multiprogetto, **semplice da usare ogni giorno**. La semplicità e l’estetica vincono sulle funzionalità: poche funzioni chiare che risolvono problemi reali.
- **Utenti:** il prodotto è pensato per utenti **non tecnici**. Flussi lineari, pochi click, linguaggio chiaro. Ogni schermata deve rispondere a “Cosa faccio qui?” senza sovraccarico cognitivo.
- **API:** non solo dominio CRM stretto. Le API possono servire anche elenco planimetrie per siti web, preventivatori online, connettori esterni. Contratto REST chiaro e possibilmente domain-neutral dove ha senso (es. `listings`, `contacts`, `deals`).
- **Dati e legacy:** collection Mongo esistenti (es. `user`) **solo lettura** o estensioni additive con prefisso riconoscibile (es. `tz_*`). Niente modifiche massive allo schema legacy.

### Regole non negoziabili

1. **Rispettare l’ordine delle wave:** non implementare task di una wave successiva prima di aver chiuso i task della wave corrente (salvo eccezioni esplicite concordate).
2. **UX e semplicità prima delle feature:** meglio poche funzioni chiare e usabili che molte confuse; ogni nuova schermata deve ridurre frizione, non aggiungerla.
3. **Legacy e dati:** nessuna modifica distruttiva alle collection esistenti; solo lettura o estensioni additive (prefisso `tz_` o collection dedicate).
4. **Piano di riferimento:** questo documento (wave e principi) e [PIANO_GLOBALE_FOLLOWUP_3.md](PIANO_GLOBALE_FOLLOWUP_3.md) (checklist e fasi); aggiornare il piano globale quando una wave viene chiusa o si aggiunge un task concordato.

---

## 2. Visione e cosa non fare

### Cosa vogliamo (sintesi)

- **Cockpit operativo:** una home “cosa richiede attenzione oggi” con poche azioni chiare e CTA evidenti.
- **Modello apartment-first e request-based:** trattativa/richiesta come entità first-class, coerenza rent + sell.
- **API riusabili** anche fuori dal CRM (listings, export, siti, preventivatori).
- **Progressive disclosure:** informazioni essenziali in primo piano, campi avanzati in “Mostra altro” o step successivi.
- **Wizard guidati** per le azioni principali (nuovo cliente, appartamento, trattativa).

### Riferimento followup-nova (Recommerce Nova)

Il progetto **followup-nova** in `tecma/business/followup-nova` è un **laboratorio di idee**: apartment-first, request-based, API domain-neutral, cockpit, wizard. Followup 3.0 evolve in quella direzione **senza big bang**, con wave incrementali.

**Cosa non replicare da followup-nova:** troppe tab/route (reporting, reports, qa, config-studio, marketplace insieme), troppi concetti in parallelo (workflow versioning, automation rules, marketplace connettori, QA strumentazione). Per utenti non tecnici sarebbe un “casino”. Command palette, MCP, Services SDK, config studio sono **evoluzioni possibili solo dopo** che il core è stabile e percepito come semplice.

---

## 3. Stack e design system

- **Frontend:** React + Vite + TypeScript. **Tailwind** come base styling. Design system forte: token (colori, tipografia, spaziatura), componenti in `src/components/ui/`, regole Figma → codice in `.cursor/rules/` (Figma MCP + create-design-system-rules).
- **Backend:** REST modulare (modular monolith), JWT Followup come identità principale, OpenAPI come contratto.

Dettagli: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [DESIGN_SYSTEM_COMPONENTS_WAVES.md](DESIGN_SYSTEM_COMPONENTS_WAVES.md).

---

## 4. Wave (ordine vincolante)

**Regola operativa:** rispettare le wave in ordine; non saltare avanti e indietro. Ogni wave si considera chiusa solo quando i criteri di acceptance sono soddisfatti e i task sono verificati.

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
   - Gate "loggato" in App usa solo `hasAccessToken`; SSO: al ritorno con cookie SSO, `LoginPage` chiama `POST /v1/auth/sso-exchange`; in successo salva `accessToken` e reindirizza.  
   *Acceptance:* nessun percorso critico usa solo il cookie SSO per identità; `ProjectAccessPage` mostra l'email da token (read-only).

4. **Preferenze e scope (fatto):**  
   Preferenze progetti/ambiente salvate in `userPreferences` (Mongo) e in sessionStorage; selezione ambiente al login (step 2), poi selezione progetti full-page; persistenza.  
   *Acceptance:* scelte progetti/ambiente sopravvivono al refresh.

**Deliverable Wave 1:** Login nativo e SSO operativi; identità e autorizzazione basate su JWT Followup; UX login e selezione progetti coerente.

---

### Wave 2 — Design system e Tailwind (stato: **completata**)

**Obiettivo:** Tailwind come unica base di styling; design system esplicito (tokens, componenti, regole Figma).

**Task:**

1. **Tailwind e tokens (fatto):**  
   Tailwind standard in `fe-followup-v3`; tema (colori, font, radius, spacing) allineato al design Tecma/Followup.  
   *Acceptance:* nessun nuovo stile “a mano” fuori da utility Tailwind o da token del tema.

2. **Design system rules (Figma MCP) (fatto):**  
   Regole di progetto (es. `.cursor/rules/figma-design-system.mdc`): dove stanno i componenti, come mappare Figma → Tailwind, flusso get_design_context + get_screenshot.  
   *Acceptance:* implementazioni Figma seguono quel flusso.

3. **Componenti UI core (fatto):**  
   LoginPage e ProjectAccessPage usano `Button`, `Input`, `PasswordInput` da `src/components/ui/` e classi token. PageTemplate (shell) allineato a token.  
   *Acceptance:* auth e shell usano componenti e token coerenti.

**Deliverable Wave 2:** Design system documentato e applicato; base pronta per espandere le schermate senza drift visivo.

---

### Wave 3 — UX core: poche funzioni, chiare e utilizzabili (stato: **completata**)

**Obiettivo:** Consolidare le funzionalità core (cockpit/home, clienti, appartamenti, calendario) con UX semplice e pochi click; nessuna proliferazione di feature secondarie prima di aver reso solide le principali.

**Task:**

1. **Cockpit / Home:**  
   Una sola “home” action-first: cosa richiede attenzione oggi (scadenze, prossimi appuntamenti, azioni suggerite). Layout chiaro, pochi blocchi, CTA evidenti.  
   *Acceptance:* l’utente capisce in pochi secondi “cosa fare” dalla home; tempo e click per le azioni quotidiane ridotti.

2. **Liste e schede:**  
   Liste clienti e appartamenti con filtri essenziali, ricerca, e apertura scheda dettaglio. Schede dettaglio con informazioni essenziali in primo piano; campi avanzati in progressive disclosure (es. “Mostra altro”).  
   *Acceptance:* creazione/modifica di un cliente o appartamento avviene in pochi step; nessun form “muro di campi”.

3. **Calendario:**  
   Vista calendario multiprogetto coerente con il resto dell’UI; creazione/modifica evento semplice (form breve).  
   *Acceptance:* utente può vedere e gestire eventi senza dover cambiare contesto o pagina inutilmente.

**Deliverable Wave 3:** Esperienza quotidiana del CRM concentrata su poche azioni chiare; semplicità e pochi click prioritari rispetto al numero di funzionalità.

**Verifica 2026-03-19:** in codebase risultano coperti crea/modifica cliente (drawer), “Nuovo evento” / modifica in calendario, cockpit con suggerimenti AI (con fallback). Eventuali ritocchi UX restano nel [piano globale](PIANO_GLOBALE_FOLLOWUP_3.md), non come gate Wave 3.

---

### Wave 4 — Modello dominio: Requests e allineamento rent/sell (stato: **completata**)

**Obiettivo:** Allineare il modello dominio al mondo “request-based” (come in followup-nova) dove ha senso: una trattativa/richiesta come entità first-class. Coerenza rent + sell nel modello dati e nelle API.

**Task:**

1. **Modello e API (fatto):**  
   Definire (o adottare) il concetto di **Request/Deal** unificato (rent + sell): stati, transizioni, associazioni cliente-appartamento. Esporre API REST coerenti (es. `deals` o `requests`) con stesso contratto query (workspaceId, projectIds, filtri, paginazione).  
   *Acceptance:* documentazione modello Request/Deal; almeno un endpoint query/list che segue il pattern condiviso.  
   **Nota:** Modello descritto in [docs/REQUESTS_MODEL.md](REQUESTS_MODEL.md); collection `tz_requests`; endpoint `POST /v1/requests/query` e `GET /v1/requests/:id` (pattern ListQuery + PaginatedResponse).

2. **UI trattative/richieste (fatto):**  
   Vista lista e kanban con filtri (tipo, stato), ricerca e dettaglio in Sheet. Stessa UX per rent e sell, dati etichettati per tipo.  
   *Acceptance:* l’utente può elencare e aprire il dettaglio di una trattativa/richiesta in modo chiaro e uniforme.

**Deliverable Wave 4:** Modello unificato request/deal; API e UI allineate a rent+sell.

---

### Wave 5 — API riusabili e dominio “pubblico”

**Obiettivo:** Esporre API utili anche fuori dal solo CRM: es. elenco listing/appartamenti (o planimetrie) per siti web o preventivatori online; contratti chiari e possibilmente domain-neutral.

**Task:**

1. **Endpoint “pubblici” o scope-limited:**  
   Almeno un endpoint riutilizzabile (es. listati per progetto/workspace, con filtri e paginazione) con contratto stabile e documentato (OpenAPI). Autenticazione dove necessario (API key o JWT con scope limitato).  
   *Acceptance:* documento che descrive l’uso dell’endpoint; OpenAPI aggiornato; chiamata di test funzionante.

2. **Separazione concettuale:**  
   Chiarire in documentazione quali API sono “core CRM” e quali “servizi riusabili” (listing, export, ecc.).  
   *Acceptance:* sezione in docs (o README) che elenca le API per uso esterno e le convenzioni.

**Deliverable Wave 5:** Almeno un’API riusabile fuori dal CRM; contratto e documentazione pronti per integrazioni.

---

### Wave 6 — Hardening auth e sicurezza (stato: **completata**)

**Obiettivo:** Refresh token, revoca, audit login; enforcement lato backend su tutte le API sensibili.

**Task:**

1. **Refresh token e logout (fatto):**  
   Refresh token in `tz_authSessions`, endpoint `POST /v1/auth/refresh` e `POST /v1/auth/logout`. Frontend: rinnovo automatico su 401 e logout che invalida sessione.  
   *Acceptance:* sessione lunga senza ri-login; logout invalida refresh lato server.

2. **Middleware auth su API (fatto):**  
   Middleware JWT su tutte le route `/v1` eccetto health, openapi, login, refresh, sso-exchange, logout. `req.user` popolato da token.  
   *Acceptance:* chiamate senza token valido ricevono 401; nessun endpoint sensibile accessibile senza auth.

3. **Audit e policy (fatto):**  
   Log eventi login, logout e sso_exchange in `tz_authEvents`. Policy di retention e uso in [docs/AUTH_AUDIT_POLICY.md](AUTH_AUDIT_POLICY.md).  
   *Acceptance:* almeno login/logout tracciati; policy descritta in docs.

**Deliverable Wave 6:** Auth enterprise-grade (access + refresh, revoca, audit); API protette.

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

## 5. Riepilogo wave e dipendenze

| Wave | Nome breve           | Dipende da   | Stato      |
|------|----------------------|-------------|------------|
| 1    | Foundation e auth    | —           | Completata |
| 2    | Design system        | Wave 1      | Completata |
| 3    | UX core              | Wave 1, 2   | Completata |
| 4    | Requests / rent+sell | Wave 1, 3   | Completata |
| 5    | API riusabili        | Wave 1, 4   | Completata |
| 6    | Hardening auth       | Wave 1      | Completata |
| 7    | AI e automazioni     | Wave 1–3    | Da fare    |

- **Wave 6** può essere anticipata subito dopo Wave 1 se si vuole massima sicurezza prima di espandere feature.
- **Wave 2** e **Wave 3** in sequenza (prima design system, poi UX core) per evitare drift visivo.

---

## 6. Riferimenti

- **Visione e idee (non da copiare pari pari):** followup-nova (Recommerce Nova) in `tecma/business/followup-nova` — apartment-first, request-based, API riusabili; vedi README e `CRM_ENTERPRISE_WAVES.md`.
- **Auth e identità:** codice `be-followup-v3/src/core/auth/`; report stato API BSS: [AUTH_AND_TECMA_BSS_API_REPORT.md](AUTH_AND_TECMA_BSS_API_REPORT.md).
- **Design system:** [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [DESIGN_SYSTEM_COMPONENTS_WAVES.md](DESIGN_SYSTEM_COMPONENTS_WAVES.md); skill create-design-system-rules; Figma MCP.
- **Architettura frontend (come aggiungere feature):** [fe-followup-v3/ARCHITECTURE.md](../fe-followup-v3/ARCHITECTURE.md).
- **API / aws-api-gateway:** [PIANO_GLOBALE_FOLLOWUP_3.md](PIANO_GLOBALE_FOLLOWUP_3.md) §14.1 e [AUTH_AND_TECMA_BSS_API_REPORT.md](AUTH_AND_TECMA_BSS_API_REPORT.md).
