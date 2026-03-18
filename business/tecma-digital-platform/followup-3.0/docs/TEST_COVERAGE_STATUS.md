# Stato test e copertura – obiettivo 100%

Ultimo aggiornamento: in base a `npm run test -- --coverage` (BE) e `npm run test:coverage` (FE).

**Obiettivo strategico**: tutta l’app (FE, BE, integrazioni, E2E) testata al 100%, così che aggiungendo una feature non si rompa nulla. Vedi **[Piano 100% – tutta l’app](archive/PLAN_100_PERCENT_FULL_APP.md)** per roadmap e deliverable.

---

## Riepilogo numeri

| Area | Statements | Branch | Funcs | Lines | Note |
|------|------------|--------|-------|-------|------|
| **BE** (unit+api+integration) | **39.24%** | 36.36% | 20.63% | 39.24% | `npm run test:coverage` in be-followup-v3 |
| **FE** (tutto il src in report) | **69.84%** | 70.58% | 40.26% | **69.84%** | Include: **tutto** `src/**`; obiettivo 90%→100% (vedi [archive/PLAN_100_PERCENT_FULL_APP.md](archive/PLAN_100_PERCENT_FULL_APP.md)) |
| **Complessivo (media Stmts)** | **~54.5%** | — | — | — | (FE + BE) / 2 su statement; target 100% |

*Ultimo run: FE `npm run test:coverage -- --run`, BE `npm run test:coverage`. FE: 75 file test, 382 test.*

---

## Backend (be-followup-v3)

### Cosa è coperto oggi
- **Route (`v1.ts`)**: ~70% – test API con supertest (health, openapi, auth, session, requests, clients) con **servizi mockati**.
- **authMiddleware, asyncHandler, types/http, docs/openapi, token.service**: alti o 100%.
- **list-query.ts**: ~84%.
- **Integration** (config separata): clients.service e requests.service esercitati con DB reale in-memory, ma **non entrano nel report coverage** (vitest.integration.config senza coverage).

### Cosa non è coperto (gap verso 100%)
- **server.ts**: 0% (bootstrap).
- **config/db.ts**: ~84% (connectDb/getDb usati in integration).
- **core/clients, requests**: coverage da integration; unit con mock in v1.test.
- **core/apartments, calendar, auth (login/refresh/sso/projectAccess/userPreferences/audit/refreshSession), future, inspect, events**: 5–25% (solo i path chiamati dalle route con mock).
- **core/pricing/price-normalizer.ts**: **100%** (test unitari aggiunti).
- **utils/** (seed, listCollections, copyCollections): 0% (script esclusi da coverage).

### Azioni per avvicinarsi al 100% BE
1. **Fatto**: integration inclusi nel report; `npm run test:coverage`. clients ~47%, requests ~70%, list-query 100%, db ~84%, **price-normalizer 100%** (test unitari).
2. **Test unitari sui servizi** (o integration aggiuntivi): apartments, calendar, auth.*, future, inspect, event-log – almeno i path critici.
3. **Escludere da coverage** (opzionale): `server.ts`, `utils/*` (script one-off), `*.d.ts`.
4. **Aumentare test route**: coprire più endpoint e casi in v1.test.ts per alzare % su v1.ts e sui servizi già mockati.

---

## Frontend (fe-followup-v3)

### Cosa è in report oggi (tutto il src)
- **Include**: tutto `src/**/*.{ts,tsx}` (vedi `vite.config.ts`). Nessun modulo “nascosto”.
- **Exclude**: solo `**/*.test.*`, test-utils, main.tsx, vite-env.d.ts, index, `*.d.ts`, types, mockData.

### Cosa è già al 100% (statement/line/branch)
- **components/ui/** (la maggior parte): accordion, alert, avatar, badge, button, button-group, card, checkbox, date-input, dialog, divider, drawer, form-field, input, link, password-input, progress, progress-indicator, radio-group, scroll-area, select, separator, sheet, slider, spinner, stepper, switch, table, tabs, tag, textarea, tooltip.
- **lib/**, **useAsync**, **usePaginatedList**.

### Cosa è scoperto (gap verso 100% – da testare)
- **App.tsx**, **components**: ErrorBoundary, LogoTecma, filters-drawer, dropdown-menu, phone-input (parziale), snackbar (parziale). **Con test**: sidebar-menu, file-upload.
- **api/** (authApi, followupApi, http, bssAuthAdapter), **auth/** (itdLogin, projectScope).
- **core/shared**: CommandPalette, DataTable (PageTemplate, PageSimple hanno smoke test).
- **Pagine**: **Con smoke test**: CreateApartment, TemplateConfig (anche sezione configurazione), AssociateAptClient, CompleteFlow (anche wizard step/Flow Summary), Login (anche submit ok/ko e step ambiente), Cockpit, Clients, **ProjectAccess** (anche Conferma e auth fail), **Requests** (anche Nuova trattativa e Cerca), **Calendar** (anche pulsante Oggi), **Apartments** (anche campo ricerca e Cerca), Approvals (AI), Workspaces (anche con lista workspace), **ClientDetail** (anche email e dettagli), **ApartmentDetail** (e app-header, pagination, sidebar-menu, file-upload, dropdown-menu in UI). *Pagine HC trascurate: non definitive.* **App.tsx**: smoke con token + projectScope + followupApi mockato. **dataAdapter**: test con filtri e paginazione. **ClientsFiltersDrawerContent**: getDefaultFiltersDraft, render, ricerca, bottone Cancella filtri. **PageTemplate**: isAdmin, selettore progetti, click Clienti → onSectionChange (mock WorkspaceOverrideProvider).
- **data/** (dataAdapter, types).

### Azioni per avvicinarsi al 100% FE
1. **Fatto**: 100% statements/lines e 99.69% branch sui moduli in include (checkbox, radio-group, switch, usePaginatedList, invalid/scroll-area, ecc.).
2. **Obiettivo “100% su tutto il src”** (opzionale):  
   - Allargare `coverage.include` a (ad es.) `src/**/*.{ts,tsx}` con exclude per test, main, vite-env, types, mockData.  
   - Aggiungere test per: api (authApi, http, followupApi), hook/core condivisi, componenti condivisi (ErrorBoundary, PageTemplate, …), poi pagine (almeno smoke/render o integrazione con router).

---

## Strumenti di test: JMeter (legacy) vs followup-3.0

- **Legacy (followup / piattaforma)**  
  In **testing-tecma-integration** si usa **JMeter** per test di carico e funzionali: `LoadTest_followupFlow.jmx`, `LoadTest_floorplanningFlow.jmx`, test SC_selections, functional_tests (Spaces, Request, Quotes, User, …). Strumenti: JMeter, moduli .jmx, pipeline fragments.

- **followup-3.0**  
  Per **performance / load / stress** qui si usa **k6** (non JMeter): `npm run test:performance`, `test:load`, `test:stress` (script in `performance/` e `load/`). Per unit/integration: **Vitest** (BE + FE). Per E2E/UI: **Playwright**.

- **Serve JMeter in followup-3.0?**  
  Per il lavoro attuale (unit, integration, coverage FE/BE) **no**: bastano Vitest e Playwright. Per load/performance è già previsto **k6**. Se serve parità con il legacy (stessi scenari JMeter), si può: (1) introdurre JMeter in followup-3.0 e riusare/adattare gli .jmx, oppure (2) riscrivere gli scenari critici in k6 e mantenere un solo stack (k6). Requisito k6: `brew install k6` (vedi `performance/README.md`).

---

## Suite test disponibili (script)

- **test** / **test:unit**: unit + api (BE e FE).
- **test:coverage**: report coverage BE (unit+api+integration) e FE; dalla root `npm run test:coverage`.
- **test:api**: solo route BE (supertest).
- **test:api:gateway**: smoke su AWS API Gateway se `API_GATEWAY_BASE_URL` è impostata.
- **test:integration**: BE con MongoDB in-memory (db, clients, requests).
- **test:e2e**, **test:visual**, **test:a11y**: Playwright (FE).
- **test:performance**, **test:load**, **test:stress**: k6 (dalla root; richiede k6 installato e BE avviato per performance).
- **test:lint**, **test:security**: vedi README.

---

## Prossimi step consigliati (priorità)

1. **Fatto**: BE integration nel run coverage; FE 100% (99.69% branch) sui moduli in include.
2. **BE**: Aggiungere test (unit o integration) per servizi critici: auth.service, apartments.service, calendar.service, future.service, inspect.service, event-log, price-normalizer (oggi 5–25% o meno).
3. **BE**: Aumentare test route (v1.test) per coprire più endpoint e branch in v1.ts.
4. **FE** (opzionale): Allargare `coverage.include` e aggiungere test per api, shared e pagine in modo incrementale.
