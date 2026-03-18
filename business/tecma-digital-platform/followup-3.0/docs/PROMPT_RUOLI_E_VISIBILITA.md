# Prompt: Ruoli e visibilità FollowUp 3.0 (RBAC + Scope + Ownership)

Questo documento è sia un **prompt** da dare a un agente/team per progettare il sistema di autorizzazione, sia la **specifica di riferimento** per ruoli, permessi e visibilità. Non mescolare **Users** (interni) e **Clients** (esterni): sono domini separati.

---

## 1. Istruzioni per l’agente

Sei un software architect senior esperto in SaaS multi-tenant, identity management e modelli di autorizzazione (RBAC, ABAC).

Stai progettando il sistema di **utenti, ruoli e visibilità** per **FollowUp 3.0**, piattaforma SaaS per aziende immobiliari (appartamenti, clienti, trattative, appuntamenti, vendite/affitti). La piattaforma è **multi-workspace**.

Devi produrre:

1. **Modello completo** utenti vs clienti, ruoli e membership.
2. **Schema database** (o estensioni allo schema esistente) per membership, ruoli, permessi, scope, associazioni.
3. **Matrice ruoli × entità × visibilità/azioni** (tabella di riferimento).
4. **Modello di visibilità** per entità (all | team | assigned | none; più masked per dati sensibili).
5. **Schema associazioni** utente → entità (progetti, appartamenti, clienti) per lo scope “assigned”.
6. **Strategia data masking** per ruoli che vedono solo dati anonimizzati (es. investor).
7. **Best practice** per SaaS multi-tenant e flusso di controllo accesso (verifica user → workspace → role → permission → scope → ownership).

**Vincolo architetturale:** il sistema deve combinare **tre livelli**, come in Notion/Linear/Stripe:

- **RBAC** (ruolo → cosa puoi fare)
- **Scope** (cosa puoi vedere: all / team / assigned / none)
- **Ownership** (chi è “proprietario” o assegnatario del dato)

Se manca uno dei tre, il sistema non regge. Non mettere permessi o “can_*” direttamente nella tabella users: usare Role + Permission + (opzionale) RoleScope.

---

## 2. Separazione dominio: Users vs Clients

| Concetto | Chi sono | Accedono alla piattaforma? | Uso nel sistema |
|----------|-----------|-----------------------------|------------------|
| **Users** | Persone interne (venditori, segreteria, manager, investor) | Sì | Identity, login, ruoli, visibilità. |
| **Clients** | Soggetti esterni (acquirenti, venditori immobili, affittuari) | No | Oggetto del business; gestiti nelle trattative; mai confusi con gli utenti. |

**Regola:** User = persona che usa il sistema. Client = soggetto esterno oggetto del business. Non mescolarli nel modello dati né nelle policy.

---

## 3. Struttura organizzativa

```
Workspace
  → Projects
  → Apartments (unità)
  → Clients (anagrafica esterna)
  → Requests (trattative)
  → Calendar (appuntamenti)
```

Gli **users** sono collegati al **workspace** (e opzionalmente a team, progetti, appartamenti, clienti) tramite **membership** e **associazioni**.

---

## 4. Ruoli utente (figure attuali)

Da supportare in modo esplicito:

| Ruolo | Descrizione | Nota |
|-------|-------------|------|
| **account_admin** (account manager) | Gestisce la piattaforma per l’azienda cliente. Crea utenti, configura workspace, gestisce progetti. | Accesso pieno al workspace (o come definito dalla matrice). |
| **vendor_manager** | Responsabile dei venditori. Vede tutti i vendor, le loro agende, monitora trattative. | Scope tipicamente **team**. |
| **vendor** | Venditore. Gestisce clienti e trattative. | Molti clienti chiedono: vede **solo** appartamenti e clienti **assegnati**. |
| **front_office** | Segreteria. Fissa appuntamenti, vede agende, gestisce visite. | Visibilità ampia su agenda; su entità può essere view/all secondo matrice. |
| **investor** | Investitore. Vede andamento vendite e dati aggregati. **Non** deve vedere dati personali dei clienti (nome, email, telefono). | Dati **mascherati** (es. a***@gmail.com, G*** R***). |
| **viewer** (opzionale) | Solo lettura generica. | Utile per ruoli “solo consultazione”. |

Nel codebase attuale i ruoli in `user.workspaces` sono: `vendor` | `vendor_manager` | `admin`. Mappare `admin` → account_admin e allineare i nomi alle figure sopra dove serve.

---

## 5. Livelli di visibilità (scope)

Per ogni **entità** (users, projects, apartments, clients, requests, calendar) definire uno **scope** possibile:

| Scope | Significato |
|-------|-------------|
| **all** | Vede tutto (nel workspace). |
| **team** | Vede solo risorse del proprio team (es. vendor manager vede i vendor del team). |
| **assigned** | Vede solo risorse a lui assegnate (es. vendor vede solo i clienti/appartamenti assegnati). |
| **own** | Solo le risorse di cui è owner (es. calendar → solo la propria agenda). |
| **none** | Nessun accesso. |
| **masked** | Accesso in lettura ma con dati sensibili anonimizzati (es. investor su clienti). |
| **aggregated** | Solo dati aggregati (es. investor su trattative: totali, KPI, nessun dettaglio personale). |

---

## 6. Matrice ruoli × entità × visibilità (riferimento)

Tabella di esempio da completare/validare. Per ogni cella: scope di **visibilità** (e, dove serve, azioni consentite: create, update, delete, view).

| Ruolo | Users | Projects | Apartments | Clients | Requests | Calendar |
|-------|-------|----------|------------|---------|-----------|----------|
| **account_admin** | all | all | all | all | all | all |
| **vendor_manager** | team | all / team | team | team | team | team |
| **vendor** | — | assigned* | assigned | assigned | assigned | own |
| **front_office** | view | view | view | view | view | all |
| **investor** | masked / none | view | view | masked | aggregated | none |
| **viewer** | view | view | view | view | view | view |

\* I progetti visibili al vendor possono essere già limitati da `tz_workspace_user_projects` (solo alcuni projectId). Lo scope “assigned” su apartments/clients si ottiene con `tz_entity_assignments`.

**Azioni (RBAC):** per ogni ruolo definire quali **permission** ha (es. apartment.view, apartment.create, client.update, request.create, …). La matrice sopra si concentra sulla **visibilità**; le permission definiscono **cosa può fare** (create/update/delete/view/export ecc.).

---

## 7. Modello dati suggerito (estensione stato attuale)

Segue una proposta coerente con RBAC + Scope + Ownership. Adattare allo schema esistente (documento utente con `user.workspaces`, `tz_workspace_user_projects`, `tz_entity_assignments`).

- **User** (già presente): id, email, name, … (nessun “ruolo globale” o permessi embedded).
- **Workspace** (già presente): id, name, …
- **WorkspaceMembership** (oggi: `user.workspaces[]`): user_id, workspace_id, **role_id** (o role name). Un utente può avere ruoli diversi in workspace diversi.
- **Role**: id, name (account_admin, vendor_manager, vendor, front_office, investor, viewer).
- **Permission**: id, entity, action (es. apartment.view, client.create, request.update).
- **RolePermission**: role_id, permission_id (RBAC: cosa può fare il ruolo).
- **RoleScope** (opzionale ma consigliato): role_id, entity, scope (all | team | assigned | own | none | masked | aggregated). Definisce **cosa può vedere** il ruolo per entità.
- **Team** (opzionale, per scope “team”): id, workspace_id, name. TeamMember: team_id, user_id. Il vendor_manager vede risorse “del team”.
- **Associazioni per “assigned”** (già in parte presenti):
  - **tz_workspace_user_projects**: workspaceId, userId, projectId → quali progetti vede l’utente (se vuoto = tutti i progetti del workspace, altrimenti solo quelli in elenco).
  - **tz_entity_assignments**: workspaceId, entityType (client | apartment), entityId, userId → assegnazione esplicita per scope “assigned”.
- **Ownership:** dove serve “own” o “assigned”, le entità (o una tabella di ownership) devono avere un riferimento a chi è owner/assegnatario (es. request.assigned_vendor_id, apartment con owner_id o solo tramite tz_entity_assignments).

Non duplicare i concetti: riusare `user.workspaces`, `tz_workspace_user_projects` e `tz_entity_assignments` e estendere con Role, Permission, RolePermission, RoleScope (e opzionale Team) dove mancano.

---

## 8. Granularità di associazione (vendor vede solo assegnati)

Per soddisfare la richiesta “i vendor vedono solo appartamenti e clienti a loro associati”:

- Usare **tz_entity_assignments**: (workspaceId, entityType, entityId, userId). Se per un vendor esiste almeno un assignment per (workspaceId, userId), allora le query su apartments e clients devono filtrare: “nessuna assegnazione” **oppure** “assegnato al current user” (come già previsto in PLAN_UNIFICATO e in entity-assignments).
- Progetti: **tz_workspace_user_projects**. Se esistono righe per (workspaceId, userId), l’utente vede solo quei projectId; altrimenti tutti i progetti del workspace.
- Trattative (requests): visibilità “assigned” se la request ha un assigned_vendor_id (o simile) uguale al current user, oppure se l’appartamento/cliente della request è assegnato al current user. Definire una regola chiara (es. request.assignedUserId o derivato da entity_assignments).

---

## 9. Data masking (investor)

Per il ruolo **investor** (e eventuali altri ruoli “solo aggregati / anonimizzati”):

- **Dove applicare:** serializzazione API e/o layer di presentazione. Non salvare dati già mascherati in DB; mascherarli in uscita in base al ruolo.
- **Campi sensibili:** nome, cognome, email, telefono, indirizzo (e altri PII dei clients).
- **Regole di mascheratura (esempio):**
  - Email: `a***@gmail.com` (primo carattere + *** + @ + dominio).
  - Nome: `G*** R***` (iniziali + ***).
  - Telefono: `+39 *** *** ****`.
- **Entità:** applicare masking su **Client** (e su eventuali campi sensibili nelle Request quando l’investor vede solo aggregated). Per “aggregated” non esporre record singoli ma solo totali/KPI.

---

## 10. Flusso di controllo accesso (esempio)

A ogni richiesta API:

1. **Identità:** chi è l’utente (JWT, session).
2. **Workspace:** in quale workspace opera (header/query/body).
3. **Membership:** l’utente è membro del workspace? Ruolo?
4. **Permission:** l’azione richiesta (es. GET /clients/:id) richiede una permission (es. client.view). Il ruolo del membro ha quella permission?
5. **Scope:** per l’entità (client), quale scope ha il ruolo? (all | team | assigned | masked | …)
6. **Filtro/ownership:** se scope = assigned, filtrare per tz_entity_assignments (e/o request.assignedUserId). Se scope = team, filtrare per team membership. Se scope = masked, applicare masking in risposta.

Implementazione: middleware o helper che, dopo auth, risolve (userId, workspaceId) → role → permissions e scope, poi applica filtri nelle query e masking in serialization.

---

## 11. Output richiesto all’agente

Fornire:

1. **Modello completo** utenti vs clienti, ruoli, workspace membership, team (se previsti).
2. **Schema database** (o delta rispetto allo schema esistente): tabelle/collection per Role, Permission, RolePermission, RoleScope, Team, TeamMember; uso di tz_workspace_user_projects e tz_entity_assignments.
3. **Matrice ruoli × entità × visibilità** (tabella definitiva, eventualmente con colonne per azioni: view, create, update, delete).
4. **Modello di visibilità** per entità (all, team, assigned, own, none, masked, aggregated) e regole di filtro.
5. **Schema associazioni** utente → entità (riuso tz_entity_assignments e tz_workspace_user_projects; eventuali estensioni).
6. **Strategia data masking** (dove, quali campi, formato) e dove integrarla (API layer / serialization).
7. **Best practice** per SaaS multi-tenant e un flusso di controllo accesso riutilizzabile (es. “policy” per entità).

---

## 12. Riferimenti nel codebase FollowUp 3.0

- Ruoli attuali in `user.workspaces`: `vendor` | `vendor_manager` | `admin` (vedi [workspace-users](tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/workspaces/workspace-users.service.ts)).
- Progetti per utente: [workspace-user-projects.service.ts](tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/workspaces/workspace-user-projects.service.ts) (`tz_workspace_user_projects`).
- Assegnazioni entità: [entity-assignments.service.ts](tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/workspaces/entity-assignments.service.ts) (`tz_entity_assignments`: client | apartment).
- Piano prodotto: [PLAN_UNIFICATO_FOLLOWUP_3.md](tecma/business/tecma-digital-platform/followup-3.0/docs/PLAN_UNIFICATO_FOLLOWUP_3.md) (sezione 4 – utenti, progetti, segregazione view).

L’agente deve allineare la matrice e lo schema proposto a queste strutture esistenti e indicare dove estendere (es. Role, Permission, RoleScope, filtro query per assigned, masking).
