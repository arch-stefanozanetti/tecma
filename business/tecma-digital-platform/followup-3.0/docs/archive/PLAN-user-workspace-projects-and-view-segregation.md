# Piano: Creazione utenti, workspace+progetti e segregazione view

## Obiettivi

1. **Creazione/gestione utente**: un utente deve poter essere associato a **un workspace** e a **uno o più progetti** (dentro quel workspace).
2. **Segregazione view**: un utente può vedere solo un **sottoinsieme** di clienti/appartamenti a lui assegnati dentro un particolare progetto (oltre ai progetti a lui consentiti).

---

## Stato attuale

- **Project access**: `getProjectAccessByEmail(email)` legge da **DB utenti esterno** (`MONGO_USER_DB_NAME`) i `project_ids` dell’utente. Gli admin vedono tutti i progetti, i non-admin solo quelli in `user.project_ids`. **Non** c’è oggi il concetto “questo utente in questo workspace vede solo questi progetti”.
- **Workspace users**: il FE chiama `listWorkspaceUsers`, `addWorkspaceUser`, `listWorkspaceUserProjects`, `addWorkspaceUserProject`, `removeWorkspaceUserProject` ma **queste API non sono implementate nel backend** (nessuna route né servizio).
- **Entity assignments**: il FE chiama `assignEntity` / `unassignEntity` / `listEntityAssignments` per clienti e appartamenti, ma **nel backend non esistono** route né collection per le assegnazioni.
- **Filtro per utente**: le query clienti/appartamenti/trattative non ricevono il `userId` (JWT) e non filtrano per “assegnato a me”.

---

## Modello dati proposto

**Modello user-centric:** non una collection “workspace_users”, ma **utente** a cui sono associati **uno o più workspace**. La collection rappresenta l’associazione utente ↔ workspace.

### 1. Associazione utente – workspace (nuovo)

- **Collection**: `tz_user_workspaces`
- **Campi**: `_id`, `userId` (email o id utente), `workspaceId`, `role` (`vendor` | `vendor_manager` | `admin`), `createdAt`, `updatedAt`
- **Significato**: l’utente `userId` è associato al workspace `workspaceId` con quel ruolo. Un utente può avere più record (uno per ogni workspace). Per “elenco utenti del workspace W” si interroga per `workspaceId = W`.

### 2. Progetti visibili per utente nel workspace (nuovo)

- **Collection**: `tz_workspace_user_projects`
- **Campi**: `_id`, `workspaceId`, `userId`, `projectId`, `createdAt`
- **Significato**: l’utente `userId` nel workspace `workspaceId` può vedere (e operare su) il progetto `projectId`.
- **Regola**: se per (workspaceId, userId) **non** esiste nessun record, l’utente vede **tutti** i progetti del workspace (comportamento “all”). Se esiste almeno un record, vede **solo** i progetti in questa tabella (restrizione esplicita).

### 3. Assegnazioni entità → utente (nuovo)

- **Collection**: `tz_entity_assignments`
- **Campi**: `_id`, `workspaceId`, `entityType` (`client` | `apartment`), `entityId`, `userId`, `createdAt`
- **Significato**: l’entità (cliente o appartamento) è assegnata all’utente `userId` nel workspace.
- **Regola view**: per utenti non-admin, in lista clienti/appartamenti mostrare solo:
  - entità **non assegnate** a nessuno (visibili a tutti), **oppure**
  - entità **assegnate** al current user.

---

## Integrazione con project access

- **Endpoint**: mantenere `POST /session/projects-by-email` ma estenderlo a accettare **opzionale** `workspaceId` nel body.
- **Logica** (quando `workspaceId` è fornito):
  1. Come oggi: da DB utenti esterno si ottiene `user` (e se admin → tutti i progetti; altrimenti `user.project_ids`).
  2. Progetti “base” = intersezione tra progetti restituiti dal passo 1 e **progetti del workspace** (`tz_workspace_projects` per `workspaceId`).
  3. Se in `tz_workspace_user_projects` esiste **almeno un record** per (workspaceId, userId): filtrare i progetti base lasciando **solo** i `projectId` presenti in `tz_workspace_user_projects`. Altrimenti restituire tutti i progetti base (nessuna restrizione per-workspace).
- **FE**: dopo scelta workspace, chiamare `getProjectsByEmail(email, workspaceId)` (o passare `workspaceId` nel body) e usare la lista progetti restituita per popolare progetti selezionabili e `selectedProjectIds`. In questo modo un utente vede solo workspace + progetti a lui consentiti.

---

## Backend – implementazione

### Fase 1: User–workspace (tz_user_workspaces) e workspace user projects

1. **Servizio** (es. `user-workspaces.service.ts` o in `workspaces.service.ts`):
   - Collection **tz_user_workspaces** (user-centric: userId, workspaceId, role, timestamps). Un utente ha uno o più workspace.
   - `listWorkspaceUsers(workspaceId)` → query su `tz_user_workspaces` dove workspaceId = X
   - `addWorkspaceUser(workspaceId, { userId, role })` → insert in `tz_user_workspaces`
   - `updateWorkspaceUser(workspaceId, userId, { role })` → update del record (userId, workspaceId)
   - `removeWorkspaceUser(workspaceId, userId)` → delete da `tz_user_workspaces` + delete da `tz_workspace_user_projects` per quella coppia
   - `listWorkspaceUserProjects(workspaceId, userId)` → da `tz_workspace_user_projects`, restituire array di `projectId`
   - `addWorkspaceUserProject(workspaceId, userId, projectId)` → insert (solo se progetto è nel workspace)
   - `removeWorkspaceUserProject(workspaceId, userId, projectId)` → delete

2. **Route** (sotto `requireAuth`; write con `requireAdmin` dove serve):
   - `GET /workspaces/:id/users` → listWorkspaceUsers
   - `POST /workspaces/:id/users` (body: userId, role) → addWorkspaceUser
   - `PATCH /workspaces/:id/users/:userId` (body: role) → updateWorkspaceUser
   - `DELETE /workspaces/:id/users/:userId` → removeWorkspaceUser
   - `GET /workspaces/:id/users/:userId/projects` → listWorkspaceUserProjects
   - `POST /workspaces/:id/users/:userId/projects` (body: projectId) → addWorkspaceUserProject
   - `DELETE /workspaces/:id/users/:userId/projects/:projectId` → removeWorkspaceUserProject

3. **Aggiornare** `getProjectAccessByEmail` in `projectAccess.service.ts`:
   - Input: `{ email, workspaceId?: string }`
   - Se `workspaceId` presente: dopo aver costruito la lista progetti (da DB utenti + tz_projects + project DB), intersecare con i progetti del workspace; se esistono righe in `tz_workspace_user_projects` per (workspaceId, userId), filtrare la lista ai soli projectId presenti lì.

### Fase 2: Entity assignments

1. **Servizio** (es. `entity-assignments.service.ts`):
   - `listEntityAssignments(workspaceId, entityType, entityId)` → da `tz_entity_assignments`
   - `assignEntity(workspaceId, entityType, entityId, userId)` → insert (evitare duplicati)
   - `unassignEntity(workspaceId, entityType, entityId, userId)` → delete

2. **Route**:
   - `GET /workspaces/:workspaceId/entities/:entityType/:entityId/assignments` → listEntityAssignments
   - `POST /workspaces/:workspaceId/entities/:entityType/:entityId/assignments` (body: userId) → assignEntity
   - `DELETE /workspaces/:workspaceId/entities/:entityType/:entityId/assignments/:userId` → unassignEntity

3. **Filtro per utente nelle query**:
   - Nei servizi `queryClients` e `queryApartments` (e dove serve), accettare un **opzionale** `assignedToUserId?: string` (dal JWT quando non admin).
   - Se presente: restringere i risultati alle entità che **non** hanno nessuna riga in `tz_entity_assignments` (visibili a tutti) **oppure** hanno almeno una riga con `userId = assignedToUserId`.
   - Le route che chiamano questi servizi devono passare `req.user?.sub` (o l’email usata come userId) quando l’utente non è admin.

### Fase 3: Collection e migrazioni

- Aggiungere a `unifyMainDb.ts` (o equivalente): `tz_user_workspaces` (user → uno o più workspace), `tz_workspace_user_projects`, `tz_entity_assignments`.
- Nessuna migrazione dati obbligatoria: le nuove collection partono vuote; le restrizioni si applicano quando si popolano.

---

## Frontend – miglioramenti

### 1. Creazione/gestione utente (Drawer “Aggiungi utente”)

- **Campi**: email (userId), ruolo (come oggi).
- **Nuovo**: sezione “Progetti visibili nel workspace”:
  - Lista progetti del workspace (da `listWorkspaceProjects(workspaceId)`).
  - Checkbox o multi-select: “Limita a questi progetti” con selezione di uno o più progetti.
  - Se nessuno selezionato → l’utente vede **tutti** i progetti del workspace (nessun insert in `tz_workspace_user_projects`).
  - Se almeno uno selezionato → dopo `addWorkspaceUser` chiamare `addWorkspaceUserProject` per ogni progetto selezionato.
- In modifica utente (se esposta): mostrare i progetti attualmente associati e consentire di aggiungere/rimuovere (add/removeWorkspaceUserProject).

### 2. Project access con workspace

- Nella pagina di scelta progetti (ProjectAccessPage o equivalente), dopo aver scelto il workspace chiamare `getProjectsByEmail(email, workspaceId)` (invece di solo email) e usare la lista restituita come unica fonte per i progetti selezionabili. In questo modo la restrizione “user → workspace → progetti” è già applicata lato backend.

### 3. Segregazione clienti/appartamenti

- Non serve cambiare le chiamate FE se il backend applica il filtro per `assignedToUserId` quando l’utente non è admin: le liste clienti/appartamenti saranno già filtrate. Le schermate di dettaglio e le assegnazioni (assign/unassign) sono già previste dal FE; basta che le API esistano e che le liste siano filtrate lato BE.

---

## Riepilogo priorità

| # | Cosa | Dove |
|---|------|------|
| 1 | Implementare `tz_user_workspaces` (user-centric) + CRUD e route “workspace users” (list/add/update/remove per workspace) | BE |
| 2 | Implementare `tz_workspace_user_projects` + CRUD e route user-projects | BE |
| 3 | Estendere `getProjectAccessByEmail` con `workspaceId` e filtro da `tz_workspace_user_projects` | BE |
| 4 | Drawer “Aggiungi utente” con selezione progetti (e salvataggio addWorkspaceUserProject) | FE |
| 5 | Chiamare project-by-email con workspaceId dopo scelta workspace | FE |
| 6 | Implementare `tz_entity_assignments` + servizio + route assign/unassign/list | BE |
| 7 | Filtro clienti/appartamenti per `assignedToUserId` quando non admin | BE |

Ordine consigliato: 1 → 2 → 3 → 4 → 5 (flusso utente e progetti), poi 6 → 7 (assegnazioni e segregazione view).
