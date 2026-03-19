# Piano refactoring Code-Simplifier (followup-3.0)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ridurre il debito tecnico emerso dall’assessment code-simplifier: pagine dettaglio troppo grandi, duplicazione API, ternari annidati, ripetizione audit/event e parsing query nel backend, migliorando chiarezza e manutenibilità senza cambiare comportamento.

**Architecture:** Interventi incrementali e indipendenti per fase: (1) unificazione layer API FE, (2) scomposizione pagine dettaglio in sotto-componenti, (3) sostituzione ternari con switch/mappe, (4) helper BE per audit+event e parsing query, (5) documentazione/optional useDetailData e test. Ogni fase è committabile separatamente.

**Tech Stack:** React (FE), Express (BE), Vitest, TypeScript. Riferimenti: `fe-followup-v3/ARCHITECTURE.md`, assessment in `docs/subagents/code-simplifier-subagent.md`.

---

## Fase 1: Unificazione layer API (frontend)

**Contesto:** Stessi metodi esistono in `followupApi.ts` e in `api/domains/clientsApi.ts` / `apartmentsApi.ts`. ARCHITECTURE indica “solo da api/” e “metodo in followupApi.ts”. Si adotta un unico punto di verità: `followupApi` espone sotto-oggetti per dominio che delegano a `api/domains/*`.

### Task 1.1: Esporre clients e apartments da followupApi

**Files:**
- Modify: `fe-followup-v3/src/api/followupApi.ts`
- Modify: `fe-followup-v3/src/api/domains/clientsApi.ts` (nessuna modifica alla firma pubblica, solo usata da followupApi)
- Modify: `fe-followup-v3/src/api/domains/apartmentsApi.ts` (idem)

**Step 1:** In `followupApi.ts` importare `clientsApi` e `apartmentsApi` da `./domains/clientsApi` e `./domains/apartmentsApi`.

**Step 2:** Aggiungere in `followupApi` le proprietà `clients` e `apartments` che re-espongono rispettivamente `clientsApi` e `apartmentsApi` (es. `clients: clientsApi`, `apartments: apartmentsApi`).

**Step 3:** Rimuovere da `followupApi.ts` tutti i metodi duplicati relativi a client e apartment (queryClients, getClientById, createClient, updateClient, e gli equivalenti per apartments), lasciando solo i re-export tramite `followupApi.clients` e `followupApi.apartments`.

**Step 4:** Eseguire test API FE: `cd fe-followup-v3 && npm run test -- --run src/api/followupApi.test.ts src/api/domains/clientsApi.test.ts src/api/domains/apartmentsApi.test.ts`. Verificare che passino.

**Step 5:** Commit: `git add fe-followup-v3/src/api/followupApi.ts && git commit -m "refactor(fe): expose clients/apartments via followupApi, remove duplicate methods"`

---

### Task 1.2: Migrare i consumer a followupApi.clients / followupApi.apartments

**Files:**
- Modify: tutti i file che importano `clientsApi` o `apartmentsApi` (vedi grep sotto)

**Step 1:** Cercare riferimenti: `grep -rl "from.*clientsApi\|from.*apartmentsApi" fe-followup-v3/src`.

**Step 2:** Per ogni file: sostituire l’import di `clientsApi` con `followupApi` e le chiamate tipo `clientsApi.queryClients(...)` con `followupApi.clients.queryClients(...)` (e analogamente per apartments). Aggiornare solo gli import e le chiamate, senza cambiare logica.

**Step 3:** Eseguire test FE: `cd fe-followup-v3 && npm run test -- --run`. Verificare che nessun test fallisca.

**Step 4:** Commit: `git add fe-followup-v3/src && git commit -m "refactor(fe): use followupApi.clients and followupApi.apartments everywhere"`

---

### Task 1.3: Aggiornare ARCHITECTURE e (opzionale) deprecare import diretti

**Files:**
- Modify: `fe-followup-v3/ARCHITECTURE.md`

**Step 1:** Nella sezione “API” e “Aggiungere un nuovo endpoint API”, specificare che per clients e apartments si usano `followupApi.clients.*` e `followupApi.apartments.*`; i moduli in `api/domains/` sono implementazione interna.

**Step 2:** Commit: `git add fe-followup-v3/ARCHITECTURE.md && git commit -m "docs: document followupApi.clients / followupApi.apartments as single API surface"`

---

## Fase 2: Scomposizione pagine dettaglio (ClientDetail, ApartmentDetail, Requests)

**Contesto:** ClientDetailPage ~1679 righe, ApartmentDetailPage ~1261, RequestsPage ~936. Obiettivo: file sotto ~400–500 righe, pagina come orchestratore.

### Task 2.1: Estrarre sezioni da ClientDetailPage

**Files:**
- Create: `fe-followup-v3/src/core/clients/ClientDetailHeader.tsx`
- Create: `fe-followup-v3/src/core/clients/ClientDetailAnagrafica.tsx`
- Create: `fe-followup-v3/src/core/clients/ClientDetailTrattative.tsx` (o nome coerente con contenuto reale)
- Create: `fe-followup-v3/src/core/clients/ClientDetailAzioni.tsx` (se esiste un blocco azioni ripetuto)
- Modify: `fe-followup-v3/src/core/clients/ClientDetailPage.tsx`

**Step 1:** Aprire `ClientDetailPage.tsx` e identificare blocchi logici (header con titolo/azioni, anagrafica, trattative/requests, azioni, eventuali tab). Definire le props di ogni sotto-componente (solo dati necessari, no pass-through eccessivo).

**Step 2:** Creare `ClientDetailHeader.tsx`: estrarre JSX e stato locale strettamente legato all’header. Riceve es. `client`, `onRefresh`, callback azioni. Export default.

**Step 3:** Creare `ClientDetailAnagrafica.tsx`: estrarre sezione dati anagrafici. Props: `client`, eventuali `onEdit`/callbacks.

**Step 4:** Creare uno o due componenti aggiuntivi per le sezioni più corpose (es. trattative, azioni), seguendo lo stesso schema.

**Step 5:** In `ClientDetailPage.tsx` importare i nuovi componenti e sostituire i blocchi JSX con `<ClientDetailHeader ... />`, `<ClientDetailAnagrafica ... />`, ecc. Non cambiare logica di fetch o routing; solo spostamento di JSX e stato locale dove appropriato.

**Step 6:** Eseguire test: `npm run test -- --run src/core/clients/ClientDetailPage.test.tsx`. Verificare che passino.

**Step 7:** Commit: `git add fe-followup-v3/src/core/clients/ClientDetail*.tsx && git commit -m "refactor(fe): split ClientDetailPage into Header, Anagrafica, and section components"`

---

### Task 2.2: Estrarre sezioni da ApartmentDetailPage

**Files:**
- Create: `fe-followup-v3/src/core/apartments/ApartmentDetailHeader.tsx`
- Create: `fe-followup-v3/src/core/apartments/ApartmentDetailDati.tsx` (o nomi coerenti con il contenuto)
- Modify: `fe-followup-v3/src/core/apartments/ApartmentDetailPage.tsx`

**Step 1–5:** Stesso approccio di Task 2.1: identificare blocchi, creare sotto-componenti con props minime, sostituire in `ApartmentDetailPage.tsx`.

**Step 6:** Eseguire test: `npm run test -- --run src/core/apartments/ApartmentDetailPage.test.tsx`.

**Step 7:** Commit: `git add fe-followup-v3/src/core/apartments/ApartmentDetail*.tsx && git commit -m "refactor(fe): split ApartmentDetailPage into Header and section components"`

---

### Task 2.3: Estrarre sezioni da RequestsPage

**Files:**
- Create: `fe-followup-v3/src/core/requests/RequestsPageHeader.tsx` (o Filters/Toolbar se è più appropriato)
- Create: `fe-followup-v3/src/core/requests/RequestsBoardSection.tsx` (se non esiste già o va rinominato/estratto)
- Modify: `fe-followup-v3/src/core/requests/RequestsPage.tsx`

**Step 1–5:** Identificare blocchi (filtri, board, dettaglio modale), estrarre in componenti, mantenere la pagina come orchestratore.

**Step 6:** Eseguire test: `npm run test -- --run src/core/requests/` (se esistono test per RequestsPage).

**Step 7:** Commit: `git add fe-followup-v3/src/core/requests/Requests*.tsx && git commit -m "refactor(fe): split RequestsPage into smaller components"`

---

## Fase 3: Sostituzione ternari annidati (frontend)

**Contesto:** Ternari in CalendarPage, CreateApartmentPage, ConnettoriTab, dialog.tsx, CommandPalette, CockpitPage, ProjectAccessPage, ecc. Sostituire con switch o mappe label/valore.

### Task 3.1: CalendarPage e CalendarEventFormDrawer

**Files:**
- Modify: `fe-followup-v3/src/core/calendar/CalendarPage.tsx`
- Modify: `fe-followup-v3/src/core/calendar/CalendarEventFormDrawer.tsx`

**Step 1:** In `CalendarPage.tsx` cercare ternari per view unit/label (es. day/week/month). Introdurre costante tipo `VIEW_LABELS: Record<string, string>` o switch e variabile `viewLabel`. Sostituire i ternari con lookup.

**Step 2:** In `CalendarEventFormDrawer.tsx` sostituire ternari per pulsante “Salva”/“Crea” con mappa `submitLabel = isEdit ? "Salva" : "Crea"` (o oggetto per tipo).

**Step 3:** Eseguire test: `npm run test -- --run src/core/calendar/CalendarPage.test.tsx`.

**Step 4:** Commit: `git add fe-followup-v3/src/core/calendar/CalendarPage.tsx fe-followup-v3/src/core/calendar/CalendarEventFormDrawer.tsx && git commit -m "refactor(fe): replace nested ternaries with maps in Calendar pages"`

---

### Task 3.2: CreateApartmentPage, ConnettoriTab, dialog, CommandPalette, CockpitPage, ProjectAccessPage

**Files:**
- Modify: `fe-followup-v3/src/core/apartments/CreateApartmentPage.tsx`
- Modify: `fe-followup-v3/src/core/integrations/ConnettoriTab.tsx`
- Modify: `fe-followup-v3/src/components/ui/dialog.tsx`
- Modify: `fe-followup-v3/src/core/shared/CommandPalette.tsx`
- Modify: `fe-followup-v3/src/core/cockpit/CockpitPage.tsx`
- Modify: `fe-followup-v3/src/core/auth/ProjectAccessPage.tsx`

**Step 1:** Per ogni file: individuare ternari annidati (es. per progress step, connectorId, sizeClass, typeLabel). Sostituire con `const x = MAP[key] ?? default` o switch, e usare `x` nel JSX.

**Step 2:** Eseguire test correlati: `npm run test -- --run src/core/apartments/CreateApartmentPage.test.tsx src/core/cockpit/CockpitPage.test.tsx src/core/auth/ProjectAccessPage.test.tsx` (e altri che coprono i file modificati).

**Step 3:** Commit: `git add <file1> <file2> ... && git commit -m "refactor(fe): replace nested ternaries with maps/switch in CreateApartment, ConnettoriTab, dialog, CommandPalette, Cockpit, ProjectAccess"`

---

## Fase 4: Helper backend (audit+event, parsing query)

**Contesto:** Route clients (e altre) ripetono `safeAsync(auditRecord(...)); safeAsync(dispatchEvent(...));` e parsing manuale di workspaceId, projectIds, page, perPage.

### Task 4.1: Helper auditAndDispatchEntityEvent

**Files:**
- Create: `be-followup-v3/src/routes/helpers/auditAndDispatch.ts`
- Modify: `be-followup-v3/src/routes/v1/clients.routes.ts`
- Modify: `be-followup-v3/src/routes/v1/apartments.routes.ts` (e altri che usano lo stesso pattern)

**Step 1:** Creare `auditAndDispatch.ts` con funzione `auditAndDispatchEntityEvent(options)` che accetta `action`, `workspaceId`, `projectId`, `entityType`, `entityId`, `actor`, `payload`, e internamente chiama `auditRecord(...)` e `dispatchEvent(...)` con `safeAsync` e stesso payload/opzioni. Signature da adattare ai tipi esistenti di `auditRecord` e `dispatchEvent`.

**Step 2:** In `clients.routes.ts` sostituire i blocchi doppi `safeAsync(auditRecord(...)); safeAsync(dispatchEvent(...));` con una singola chiamata a `auditAndDispatchEntityEvent(...)` (create, update, ecc.).

**Step 3:** Replicare in `apartments.routes.ts` e in altre route che hanno lo stesso pattern (requests, hc se applicabile).

**Step 4:** Eseguire test BE: `cd be-followup-v3 && npm run test -- --run`. Verificare che i test di integrazione/route passino.

**Step 5:** Commit: `git add be-followup-v3/src/routes/helpers/auditAndDispatch.ts be-followup-v3/src/routes/v1/*.ts && git commit -m "refactor(be): add auditAndDispatchEntityEvent helper, use in clients and apartments routes"`

---

### Task 4.2: Helper parseListQueryFromRequest

**Files:**
- Create: `be-followup-v3/src/routes/helpers/parseListQuery.ts`
- Modify: `be-followup-v3/src/routes/v1/clients.routes.ts`
- Modify: altre route che parsano workspaceId, projectIds, page, perPage a mano

**Step 1:** Creare `parseListQuery.ts` con `parseListQueryFromRequest(req): { workspaceId, projectIds, page, perPage }` (e eventuali filtri comuni). Gestire query string, default page=1, perPage=25, validazione workspaceId/projectIds.

**Step 2:** In `clients.routes.ts` nell’handler `GET /clients/:id/requests` sostituire il blocco di parsing con `const { workspaceId, projectIds, page, perPage } = parseListQueryFromRequest(req);` e usare questi valori nella chiamata a `queryRequests`.

**Step 3:** Applicare lo stesso pattern alle altre route che fanno parsing simile (cercare `req.query.workspaceId`, `req.query.projectIds`, `req.query.page`, `req.query.perPage`).

**Step 4:** Eseguire test BE: `cd be-followup-v3 && npm run test -- --run`.

**Step 5:** Commit: `git add be-followup-v3/src/routes/helpers/parseListQuery.ts be-followup-v3/src/routes/v1/*.ts && git commit -m "refactor(be): add parseListQueryFromRequest helper, use in list handlers"`

---

## Fase 5: Documentazione e optional (useDetailData, test coverage)

**Contesto:** useDetailData ha useEffect con dependency array da chiarire; copertura test BE ~39%.

### Task 5.1: Documentare useDetailData

**Files:**
- Modify: `fe-followup-v3/src/core/shared/useDetailData.ts`

**Step 1:** Aggiungere JSDoc in cima al file: spiegare che `loadEntity` (e eventuali altri parametri) non sono in dependency array per scelta (evitare loop di reload); oppure, se è un bug, inserirli e documentare. Decidere in base al comportamento atteso (reload quando cambia loadEntity vs no).

**Step 2:** Eseguire test: `npm run test -- --run src/core/shared/useDetailData.test.ts`.

**Step 3:** Commit: `git add fe-followup-v3/src/core/shared/useDetailData.ts && git commit -m "docs(fe): document useDetailData effect dependencies"`

---

### Task 5.2: (Opzionale) Aumentare copertura test BE

**Files:**
- Modify/create: test in `be-followup-v3/src/core/clients/`, `be-followup-v3/src/core/apartments/`, `be-followup-v3/src/core/requests/` (servizi critici)

**Step 1:** Identificare servizi con copertura bassa (es. `clients.service.ts`, `apartments.service.ts`, `requests.service.ts`). Aggiungere test unitari per funzioni pubbliche principali (create, update, query con filtri).

**Step 2:** Eseguire coverage: `cd be-followup-v3 && npm run test:coverage` (o comando equivalente). Verificare incremento senza regressioni.

**Step 3:** Commit: `git add be-followup-v3/src/core/*/**.test.ts && git commit -m "test(be): add unit tests for clients, apartments, requests services"`

---

## Ordine di esecuzione consigliato

1. **Fase 1** (API unificata) – basso rischio, alto impatto su manutenibilità.
2. **Fase 4** (helper BE) – riduce rumore nelle route; può essere fatto in parallelo con Fase 2.
3. **Fase 2** (split pagine) – un’area per volta (Client → Apartment → Requests).
4. **Fase 3** (ternari) – miglioramento leggibilità, nessuna modifica di comportamento.
5. **Fase 5** (docs + optional test) – quando le altre fasi sono stabili.

---

## Verifica finale

- `cd fe-followup-v3 && npm run test -- --run` → tutti i test passano.
- `cd be-followup-v3 && npm run test -- --run` → tutti i test passano.
- Build FE: `cd fe-followup-v3 && npm run build` → successo.
- Controllo manuale: apertura ClientDetail, ApartmentDetail, Requests, Calendar, Cockpit; nessuna regressione visiva o funzionale.

---

## Riferimenti

- Assessment: `docs/subagents/code-simplifier-subagent.md`
- ARCHITECTURE FE: `fe-followup-v3/ARCHITECTURE.md`
- Route BE: `be-followup-v3/src/routes/v1/clients.routes.ts`, `apartments.routes.ts`, `requests.routes.ts`
