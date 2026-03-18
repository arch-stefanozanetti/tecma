# Followup 3.0 — Piano unificato (unico riferimento)

**Ultimo aggiornamento:** 2026-03-06  

## Prossimi passi (ripartenza)

| Priorità | Cosa |
|----------|------|
| 1 | **Wave 5** — primo endpoint/API riusabile (es. listing) con contratto stabile e OpenAPI. |
| 2 | **Workspace users (Fase 1 BE)** — `user.workspaces[]` su test-zanetti, route `GET/POST/PATCH/DELETE /workspaces/:id/users` così “Aggiungi utente” funziona. |
| 3 | **Project access + drawer (Fase 1–3)** — `tz_workspace_user_projects`, estensione `getProjectAccessByEmail`, drawer progetti nel FE. |
| 4 | **Wave 7** — AI read-only, approvazioni draft (dopo o in parallelo a 5 se priorità prodotto). |
| 5 | **Entity assignments + matching** — come da tabelle in sez. 4 e 6. |

Dettaglio step-by-step: **sez. 4** (workspace) e **sez. 7** sotto.

---

**Uso:** questo documento è il **piano di riferimento unico** per il progetto. Fonti di dettaglio (in **[archive/](archive/)**, non backlog attivo):

- [FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md) — visione, wave, principi
- [archive/PLAN-user-workspace-projects-and-view-segregation.md](archive/PLAN-user-workspace-projects-and-view-segregation.md) — utenti workspace, progetti, segregazione view
- [archive/PLAN_100_PERCENT_FULL_APP.md](archive/PLAN_100_PERCENT_FULL_APP.md) — test e coverage 100%
- [archive/plans-2025-2026/2025-03-07-unificazione-api-aws-gateway-followup.md](archive/plans-2025-2026/2025-03-07-unificazione-api-aws-gateway-followup.md) — gateway AWS (design history)
- [archive/README.md](archive/README.md) — indice archivio (mega-piani deprecati, note email/Render/product discovery)

---

## 1. North Star e principi

- **North Star:** CRM verticale real estate (rent + sell), multiprogetto, **semplice da usare ogni giorno**. La semplicità e l’estetica vincono sulle funzionalità.
- **Utenti:** prodotto per utenti **non tecnici**. Flussi lineari, pochi click, linguaggio chiaro.
- **API:** non solo CRM; anche listing, preventivatori, connettori. REST chiaro, domain-neutral dove ha senso.
- **Dati e legacy:** collection Mongo esistenti **solo lettura** o estensioni additive con prefisso `tz_*`. Nessuna modifica distruttiva allo schema legacy.

### Regole non negoziabili

1. Rispettare l’ordine delle wave; non saltare avanti senza chiudere i task correnti.
2. UX e semplicità prima delle feature; ogni schermata deve ridurre frizione.
3. Legacy: solo lettura o estensioni additive (`tz_*`).
4. Un solo piano: questo documento; aggiornarlo quando si chiude una wave o si aggiunge un task concordato.

---

## 2. Stack e design system

- **Frontend:** React + Vite + TypeScript. Tailwind + token; componenti in `src/components/ui/`; regole Figma → codice (Figma MCP + create-design-system-rules). **Drawer** per le modali (non Dialog dove è stato richiesto Drawer).
- **Backend:** REST modulare (modular monolith), JWT Followup, OpenAPI come contratto. Main DB + DB utenti (`MONGO_USER_DB_NAME`) + Project DB (`MONGO_PROJECT_DB_NAME`) per progetti legacy; `tz_projects` per progetti creati da Followup.

Riferimenti: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [DESIGN_SYSTEM_COMPONENTS_WAVES.md](DESIGN_SYSTEM_COMPONENTS_WAVES.md).

---

## 3. Wave (ordine vincolante)

| Wave | Nome breve           | Stato      |
|------|----------------------|------------|
| 1    | Foundation e auth    | Completata |
| 2    | Design system        | Completata |
| 3    | UX core              | Completata |
| 4    | Requests / rent+sell | Completata |
| 5    | API riusabili        | Da fare    |
| 6    | Hardening auth       | Completata |
| 7    | AI e automazioni     | Da fare    |

### Wave 1–4, 6 (sintesi)

- **1:** Login nativo + SSO, JWT Followup, preferenze e scope (workspace + progetti).
- **2:** Tailwind, token, componenti UI core, regole Figma.
- **3:** Cockpit, liste/schede clienti e appartamenti, calendario; progressive disclosure.
- **4:** Modello Request/Deal unificato (rent+sell), `tz_requests`, UI trattative (lista/kanban/dettaglio). Timeline trattative con stati + azioni; revert stato; azioni CRUD e associazione a una o più trattative.
- **6:** Refresh token, logout, middleware JWT su `/v1`, audit login in `tz_authEvents`.

### Wave 5 — API riusabili

- Almeno un endpoint riutilizzabile (es. listing) con contratto stabile e OpenAPI.
- Documentazione: quali API sono “core CRM” e quali “servizi riusabili”.

### Wave 7 — AI e automazioni

- Suggerimenti read-only (es. “cosa fare oggi”) con CTA “Esegui”; nessuna scrittura automatica senza azione utente.
- Approvazioni e audit per azioni draft (reminder, task).

---

## 4. Utenti nel workspace, progetti e segregazione view

### Obiettivi

1. **Gestione utente:** un utente associato a **un workspace** e a **uno o più progetti** (dentro quel workspace).
2. **Segregazione view:** un utente può vedere solo un **sottoinsieme** di clienti/appartamenti a lui assegnati (oltre ai progetti a lui consentiti).

### Contesto DB

**Riferimento: solo test-zanetti.** Per la gestione utenti/workspace si considerano solo i dati nel DB test-zanetti, dove possiamo **leggere e scrivere**. Gli altri DB (user, project, client, ecc.) vanno ignorati per questa parte: la gestione avviene in test-zanetti.

### Stato attuale

- **Project access:** `getProjectAccessByEmail(email)` legge da DB utenti (`user.project_ids`). **Non** c’è il concetto “in questo workspace questo utente vede solo questi progetti”.
- **Associazione utente–workspace:** il FE chiama `listWorkspaceUsers`, `addWorkspaceUser`, `listWorkspaceUserProjects`, … ma **le API non sono implementate** → “Aggiungi utente” non funziona. Modello **user-centric**: un **utente** è associato a **uno o più workspace**.
- **Entity assignments:** route/collection non esistono.
- Le query clienti/appartamenti **non** filtrano per “assegnato a me”.

### Modello dati (test-zanetti, read+write)

**Associazioni utente–workspace:** **nessuna collection** dedicata. Si estende il **documento utente** (collection utenti in test-zanetti) con un array:

- **`user.workspaces`** = `[{ workspaceId, role }, ...]` (role: vendor | vendor_manager | admin). Un utente ha più associazioni = più elementi nell’array.
- **Indice** sulla collection utenti: su `workspaces.workspaceId` (o campo equivalente) per la query “utenti del workspace W”.
- **ListWorkspaceUsers(workspaceId)** = query sulla collection utenti con `workspaces.workspaceId = W`.
- **AddWorkspaceUser** = update del documento utente (push in `workspaces`); **RemoveWorkspaceUser** = pull da `workspaces`; **UpdateWorkspaceUser** = update dell’elemento in `workspaces` per quel workspaceId.

| Dove | Cosa |
|------|------|
| **Documento utente** (collection utenti in test-zanetti) | Campo `workspaces: [{ workspaceId, role }, ...]`. Nessuna collection `tz_user_workspaces`. |
| `tz_workspace_user_projects` (test-zanetti) | workspaceId, userId, projectId, createdAt. Se nessun record per (workspaceId, userId) → utente vede tutti i progetti del workspace; altrimenti solo i projectId in tabella. |
| `tz_entity_assignments` (test-zanetti) | workspaceId, entityType (client \| apartment), entityId, userId, createdAt. Per non-admin: mostrare solo entità non assegnate o assegnate al current user. |

### Backend — implementazione

**Fase 1 — User.workspaces (documento utente in test-zanetti) e user-projects**

- **Nessuna collection** `tz_user_workspaces`. Si usa il **documento utente** (collection utenti in test-zanetti): campo **`workspaces: [{ workspaceId, role }, ...]`**. Indice su `workspaces.workspaceId` per la query “utenti del workspace”.
- Servizio (es. `user-workspaces.service.ts` o in `workspaces.service.ts`), tutto su DB test-zanetti:
  - `listWorkspaceUsers(workspaceId)` → query sulla **collection utenti** con `workspaces.workspaceId = workspaceId` (o `workspaces` array contiene elemento con quel workspaceId)
  - `addWorkspaceUser(workspaceId, { userId, role })` → update documento utente: `$push` in `workspaces` { workspaceId, role } (evitare duplicati per stesso workspaceId)
  - `updateWorkspaceUser(workspaceId, userId, { role })` → update dell’elemento in `user.workspaces` per quel workspaceId
  - `removeWorkspaceUser(workspaceId, userId)` → update documento utente: `$pull` da `workspaces` dove workspaceId = X; opzionale: rimuovere anche righe in `tz_workspace_user_projects` per (workspaceId, userId)
  - `listWorkspaceUserProjects(workspaceId, userId)`, `addWorkspaceUserProject`, `removeWorkspaceUserProject` → su `tz_workspace_user_projects` (in test-zanetti)
- Route (protette, write con requireAdmin dove serve):
  - `GET/POST /workspaces/:id/users`, `PATCH/DELETE /workspaces/:id/users/:userId`
  - `GET /workspaces/:id/users/:userId/projects`, `POST /workspaces/:id/users/:userId/projects`, `DELETE /workspaces/:id/users/:userId/projects/:projectId`
- Estendere `getProjectAccessByEmail`: body `{ email, workspaceId? }`. Se `workspaceId` presente: intersecare progetti con quelli del workspace; se esistono righe in `tz_workspace_user_projects` per (workspaceId, userId), filtrare ai soli projectId lì.

**Fase 2 — Entity assignments**

- Servizio: `listEntityAssignments`, `assignEntity`, `unassignEntity` su `tz_entity_assignments`.
- Route: `GET/POST /workspaces/:workspaceId/entities/:entityType/:entityId/assignments`, `DELETE .../assignments/:userId`.
- Query clienti/appartamenti: accettare opzionale `assignedToUserId` (da JWT per non-admin) e filtrare: nessuna assegnazione **oppure** assegnata a current user.

**Fase 3 — Collection**

- Aggiungere a `unifyMainDb.ts` (test-zanetti): `tz_workspace_user_projects`, `tz_entity_assignments`. **Non** aggiungere `tz_user_workspaces`: le associazioni utente–workspace stanno nel documento utente (`user.workspaces[]`).

### Frontend

- **Drawer “Aggiungi utente”:** oltre a email e ruolo, sezione “Progetti visibili nel workspace”: multi-select progetti del workspace; se nessuno selezionato → tutti; se almeno uno → dopo `addWorkspaceUser` chiamare `addWorkspaceUserProject` per ciascuno.
- **Project access:** dopo scelta workspace, chiamare `getProjectsByEmail(email, workspaceId)` e usare la lista restituita per progetti selezionabili.
- Liste clienti/appartamenti: nessun cambio FE se il BE applica il filtro per `assignedToUserId`.

### Priorità (ordine)

| # | Cosa | Dove |
|---|------|------|
| 1 | Estendere documento utente con `user.workspaces[]` (test-zanetti) + servizio e route “workspace users” (list/add/update/remove per workspace) | BE |
| 2 | `tz_workspace_user_projects` + CRUD e route user-projects | BE |
| 3 | Estendere `getProjectAccessByEmail` con workspaceId e filtro da tz_workspace_user_projects | BE |
| 4 | Drawer “Aggiungi utente” con selezione progetti | FE |
| 5 | Chiamare project-by-email con workspaceId dopo scelta workspace | FE |
| 6 | `tz_entity_assignments` + servizio + route assign/unassign/list | BE |
| 7 | Filtro clienti/appartamenti per assignedToUserId (non admin) | BE |

---

## 5. Test e qualità (target 100%)

### Principi

- Coverage su tutto il codice in scope (FE: `src` eccetto entrypoint/tipi puri; BE: `src` eccetto bootstrap/script one-off).
- 100% statement/line (e branch dove possibile) sui file inclusi.
- Piramide: unit → integration → E2E; CI esegue tutta la suite; merge solo se verde.

### Frontend

- Include: `src/**/*.{ts,tsx}` con exclude minimi (main, vite-env, `*.test.*`, test-utils, mockData).
- Aree: api, auth, core/shared, components, data, UI, pagine (smoke + interazioni critiche), App.tsx.

### Backend

- Include: tutto `src/**/*.ts` con exclude per server.ts, utils/seed e script, `*.d.ts`.
- Aree: auth, core (apartments, calendar, future, inspect, events, ai), routes v1, config.

### Integrazioni ed E2E

- DB e API esterne: integration test o contract + mock in CI.
- E2E (Playwright): Login → Cockpit, → Clients, → Calendar, → Requests, → Apartments (almeno liste).
- CI: unit FE, unit BE, integration BE, E2E (e lint/security dove previsto).

Riferimento esteso: [archive/PLAN_100_PERCENT_FULL_APP.md](archive/PLAN_100_PERCENT_FULL_APP.md).

---

## 6. Altri piani (riferimento)

- **Unificazione API con aws-api-gateway:** [archive/plans-2025-2026/2025-03-07-unificazione-api-aws-gateway-followup.md](archive/plans-2025-2026/2025-03-07-unificazione-api-aws-gateway-followup.md). Centralizzare BSS + Followup nel gateway, OpenAPI/Postman, frontend che usa gateway per ambiente.
- **Matching:** endpoint GET `/v1/matching/apartments/:id/candidates` e `/v1/matching/clients/:id/candidates` (scoring budget/prezzo/città) — da implementare nel BE se richiesto; FE già pronto.
- **Dialog → Drawer:** dove richiesto, usare Drawer invece di Dialog (es. Modifica appartamento, Nuova trattativa, Eventi calendario).

---

## 7. Prossimi passi operativi (dettaglio — allineati alla tabella in cima)

1. **User–workspace (BE)** — In test-zanetti: estendere il **documento utente** con `workspaces: [{ workspaceId, role }, ...]` (nessuna collection dedicata). Servizio list/add/update/remove che opera sulla collection utenti; indice su `workspaces.workspaceId`; route `GET/POST/PATCH/DELETE /workspaces/:id/users` e `GET/POST/DELETE .../users/:userId/projects`. Così “Aggiungi utente” funziona.
2. **Project access con workspace (BE)** — Estendere `getProjectAccessByEmail` con `workspaceId` opzionale e filtro da `tz_workspace_user_projects`.
3. **Drawer Aggiungi utente (FE)** — Aggiungere selezione progetti nel drawer e chiamate `addWorkspaceUserProject`; opzionale chiamare getProjectsByEmail con workspaceId in ProjectAccessPage.
4. **Entity assignments (BE)** — `tz_entity_assignments`, servizio e route assign/unassign/list; filtro query clienti/appartamenti per `assignedToUserId` quando non admin.
5. **Matching (BE)** — Se servono “appartamenti papabili” / “clienti papabili”: implementare servizio matching e route GET `/v1/matching/.../candidates`.
6. **Sostituzioni Dialog → Drawer (FE)** — ApartmentDetailPage, ApartmentsPage, RequestsPage, CalendarPage: sostituire Dialog con Drawer dove indicato.
7. **Test e CI** — Portare coverage verso target (api, auth, core, route) e E2E sui flussi critici; gate in CI.

Dopo aver completato i passi 1–3, il flusso “Utenti nel workspace” e “Aggiungi utente” sarà operativo end-to-end. Poi si può procedere con 4–7 in base a priorità di prodotto.
