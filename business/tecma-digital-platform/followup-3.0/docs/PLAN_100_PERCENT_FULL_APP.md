# Piano: app al 100% testata ovunque

**Obiettivo**: tutta l’app (frontend, backend, integrazioni, E2E) deve essere coperta da test al 100%, così che **aggiungendo una feature non si rompa nulla** di ciò che esiste già. La suite è il guardrail: se passa, nessuna regressione.

---

## Principi

1. **Coverage su tutto il codice**  
   Nessun file “fuori report”: FE su tutto `src` (eccetto entrypoint/main e tipi puri), BE su tutto `src` (eccetto bootstrap e script one-off).

2. **100% = statement + branch + line**  
   Ogni modulo arriva al 100% (o alla soglia concordata per branch dove lo strumento ha artefatti). Non si considera “fatto” un’area finché non è tutta in report e tutta coperta.

3. **Piramide**  
   - **Unit**: logica pura, hook, servizi (mock delle dipendenze).  
   - **Integration**: DB, API reali in-memory o test double.  
   - **E2E**: flussi critici end-to-end (login, percorsi principali).  
   - **Contract / API**: dove serve (es. AWS API Gateway) smoke o contract test.

4. **CI / pre-commit**  
   La suite completa (unit + integration + E2E + lint + security) deve essere eseguibile in CI; nessun merge senza verde.

---

## Frontend – tutto il src

### Stato attuale (dopo allargamento include)
- **Coverage include**: tutto `src/**/*.{ts,tsx}` (eccetto test, main, tipi, mockData). Report “onesto” su tutta l’app.
- **Totale FE**: ~**20%** statement (baseline reale). Componenti UI già testati sono al 100%; tutto il resto (App, pagine, api, auth, shared, data, UI non ancora testati) è in report ma scoperto.

### Target
- **Coverage include**: tutto `src/**/*.{ts,tsx}` con exclude minimi (solo `main.tsx`, `vite-env.d.ts`, `**/*.test.*`, `**/test-utils*`, `**/mockData*`, tipi puri se necessario).
- **100%** statement/line (e branch dove possibile) su ogni file incluso.

### Deliverable per area

| Area | File / cartelle | Tipo test | Priorità |
|------|------------------|-----------|----------|
| **api** | authApi, followupApi, http, bssAuthAdapter | Unit (mock fetch/axios) | P0 |
| **auth** | itdLogin, projectScope | Unit (+ eventuale integration con mock) | P0 |
| **core/shared** | PageTemplate, PageSimple, CommandPalette, DataTable | Unit (render + interazioni) | P0 |
| **components** | ErrorBoundary, LogoTecma | Unit | P0 |
| **data** | dataAdapter, types (solo codice eseguibile) | Unit | P1 |
| **UI fuori include** | app-header, sidebar-menu, file-upload, pagination, filters-drawer, dropdown-menu, phone-input, snackbar | Unit (come il resto UI) | P0 |
| **Pagine** | Login, ProjectAccess, Cockpit, Clients, ClientDetail, Calendar, Requests, Approvals, Apartments, ApartmentDetail, CreateApartment, TemplateConfig, HC*, AssociateAptClient, CompleteFlow | Smoke render + interazioni critiche (unit o integration con router) | P1 |
| **App.tsx** | App.tsx | Smoke (render con router/provider) | P1 |

- **Config**: allargare `coverage.include` in `vite.config.ts` a `src/**/*.{ts,tsx}` e mantenere solo gli exclude necessari.

---

## Backend – tutto il src

### Stato attuale
- ~41% statement; integration in report; price-normalizer 100%; list-query 100%; token 100%; route ~70%.
- Gap: server.ts, utils (script), auth.* (auth.service, projectAccess, userPreferences, refreshSession, audit), apartments, calendar, future, inspect, events, ai (action-engine, orchestrator), v1.ts branch non coperti.

### Target
- **Coverage include**: tutto `src/**/*.ts` con exclude solo per `server.ts`, `utils/seed|listCollections|copyCollections`, `*.d.ts`.
- **100%** su ogni modulo (unit dove possibile, integration dove servono DB/esterni).

### Deliverable per area

| Area | File / servizi | Tipo test | Priorità |
|------|----------------|-----------|----------|
| **auth** | auth.service, projectAccess, userPreferences, refreshSession, authAudit | Unit (mock DB/HTTP) o integration | P0 |
| **core/apartments** | apartments.service | Unit (mock getDb) o integration | P0 |
| **core/calendar** | calendar.service | Idem | P0 |
| **core/future** | future.service | Idem | P0 |
| **core/inspect** | inspect.service | Integration (DB in-memory) | P1 |
| **core/events** | event-log.service | Unit (mock getDb) o integration | P1 |
| **core/ai** | action-engine, orchestrator | Unit (mock dipendenze) | P1 |
| **routes** | v1.ts (tutti i branch/endpoint), authMiddleware, asyncHandler | API test (supertest) + eventuali unit | P0 |
| **config** | db.ts (già parziale) | Integration già coperta | - |
| **server.ts** | Bootstrap | Escluso da coverage o 1 test smoke avvio | P2 |
| **utils** | seed, listCollections, copyCollections | Esclusi da coverage (script) | - |

---

## Integrazioni

### Target
- **DB**: integration test già presenti (clients, requests, db); estendere dove servono altri servizi (apartments, calendar, …).
- **API esterne**: dove l’app chiama servizi esterni (BSS, altro), test con mock o contract; nessuna chiamata reale in CI se non in job dedicato.
- **API Gateway (AWS)**: smoke test già presente; tenere e allineare a contract se cambiano le API.

### Deliverable
- Elenco integrazioni (DB, BSS, …) e per ognuna: test di integrazione o contract + mock in CI.
- Documentare in README o in questo doc quali test richiedono env (API Gateway, DB reale) e quali sono “always-on” in CI.

---

## E2E e qualità trasversale

### Target
- **E2E (Playwright)**: flussi critici coperti (login, almeno un percorso per area: cockpit, clients, calendar, requests, apartments) in modo che una modifica che rompe la UI o il flusso venga beccata.
- **Visual / a11y**: già presenti; mantenerli e allinearli ai flussi principali.
- **Lint / security / performance / load / stress**: già in script; eseguibili in CI e obbligatori in pre-merge.

### Deliverable
- Suite E2E che copra almeno: Login → Cockpit, Login → Clients (lista), Login → Calendar, Login → Requests, Login → Apartments (lista).
- CI config (es. GitHub Actions) che esegue: unit FE, unit BE, integration BE, E2E (e opz. lint, security, performance).

---

## Roadmap (ordine suggerito)

1. **Config e visibilità**
   - FE: allargare `coverage.include` a tutto `src`; eseguire coverage e generare report “honest” (con tutto il codice incluso).
   - BE: verificare exclude (server, utils) e che integration siano in report.

2. **FE – livelli bassi**
   - api (http, authApi, followupApi, bssAuthAdapter) al 100%.
   - auth (itdLogin, projectScope) al 100%.
   - core/shared (PageTemplate, PageSimple, CommandPalette, DataTable) al 100%.
   - ErrorBoundary, LogoTecma al 100%.
   - UI ancora esclusi (app-header, sidebar, file-upload, pagination, filters-drawer, dropdown-menu, phone-input, snackbar) in include e al 100%.

3. **FE – pagine e App**
   - Test smoke/render (e interazioni critiche) per ogni pagina e per App.tsx; portare coverage pagine e App al 100%.

4. **BE – servizi**
   - auth.* (auth.service, projectAccess, userPreferences, refreshSession, audit) al 100% (unit o integration).
   - apartments, calendar, future al 100%.
   - inspect, events, ai (action-engine, orchestrator) al 100%.
   - Route v1: coprire tutti gli endpoint e branch mancanti.

5. **Integrazioni e E2E**
   - Consolidare integration test DB; aggiungere dove servono per apartments/calendar/…
   - E2E: flussi critici elencati sopra; CI che li esegue.

6. **CI e gate**
   - Pipeline che esegue tutta la suite; merge solo se verde.
   - (Opzionale) badge coverage e soglie minime per non far scendere la % sotto una certa soglia.

---

## Come usare questo piano

- **Tasks**: ogni “Deliverable” può diventare un task (es. “FE api: test authApi e http al 100%”).
- **Verifica**: “100%” si considera raggiunto quando `npm run test:coverage` (FE e BE) mostra 100% (o soglia concordata) su tutti i file in include e la suite E2E passa.
- **Aggiornamento**: quando si aggiunge un nuovo modulo (nuova pagina, nuovo servizio, nuova integrazione), la regola è: **subito in coverage include + test che portano il modulo al 100%**, così l’app resta “la più solida del mondo” e aggiungere una cosa non spacca nulla.
