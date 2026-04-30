# Refactoring strutturale (piano miglioramento con sprint)

Questo documento descrive la struttura del codice dopo il refactoring in 7 sprint (foundation, split route BE, appartamenti, project-config, IntegrationsPage, pagine FE, gestione errori, test e docs).

---

## Backend (be-followup-v3)

### Errori e contesto route
- **HttpError**: usato in tutti i servizi al posto di `(err as Error & { statusCode }).statusCode`; definito in `src/types/http.ts`.
- **Helper route**: `src/routes/requestContext.ts` — `getProjectContext(req)`, `getWorkspaceIdFromParam(req)`, `getWorkspaceIdFromQuery(req)`.

### Route v1 (split)
- `src/routes/v1/public.routes.ts` — health, openapi, docs, auth, public/listings, outlook/callback.
- `src/routes/v1/projects.routes.ts` — tutte le route sotto `/projects/:projectId/*` (usa `getProjectContext`).
- `src/routes/v1/connectors.routes.ts` — n8n, whatsapp, outlook.
- `src/routes/v1/communications.routes.ts` — templates, rules, deliveries.
- `src/routes/v1.ts` — monta i router sopra (non modificare il file del piano).

### Core: appartamenti
- **`src/core/apartments/apartments.service.ts`**: contiene `getApartmentById`, `createApartment`, `updateApartment`, tipi/schemi/helper (ApartmentCreateSchema, mapApartment, ecc.).
- **`src/core/future/future.service.ts`**: importa `createApartment` da `apartments.service.js`; non duplica più la logica appartamenti.

### Core: project-config (barrel)
- **`src/core/projects/project-config.service.ts`**: barrel che re-esporta da:
  - `project-access.ts` — `ensureProjectInWorkspace`, `toIsoDate`
  - `project-detail.service.ts` — `getProjectDetail`, `ProjectDetailRow`
  - `project-policies.service.ts` — policies (get/put)
  - `project-branding.service.ts` — branding (get/put, `getProjectBrandingInternal`)
  - `project-email.service.ts` — email config + email templates (CRUD)
  - `project-pdf.service.ts` — PDF templates (CRUD)
- Le route e i servizi (es. `channel-dispatcher.service.ts`, `resolve-context.service.ts`) continuano a importare da `project-config.service.js`.

---

## Frontend (fe-followup-v3)

### Toast e gestione errori
- **`src/contexts/ToastContext.tsx`**: `ToastProvider`, `useToast()`, `toastError()`, `toastSuccess()`.
- **`main.tsx`**: avvolge l’app con `ToastProvider`.
- Tutti gli errori API (salvataggio, eliminazione, ecc.) usano `toastError()` al posto di `window.alert`. I `window.confirm` per conferma eliminazione restano.

### Token raggio (border-radius)
- **Fonte unica**: in [`../fe-followup-v3/src/styles.css`](../fe-followup-v3/src/styles.css) `:root` definisce **`--radius-ui: 8px`**; `--radius`, `--tecma-radius` e `--radius-chrome` puntano a `var(--radius-ui)` (così non restano valori misti tipo 3px vs 0.85rem del pacchetto token).
- **Tailwind**: in [`../fe-followup-v3/tailwind.config.js`](../fe-followup-v3/tailwind.config.js) `rounded` / `rounded-sm|md|lg|xl|2xl|3xl` / `rounded-chrome` usano **`var(--radius)`** — un solo valore CSS per tutta l’app.
- **JS** (canvas, ecc.): [`../fe-followup-v3/src/tokens/radius.ts`](../fe-followup-v3/src/tokens/radius.ts) esporta `RADIUS_UI_PX` allineato a `--radius-ui`.
- Eccezioni volute: `rounded-none`, `rounded-full`, gruppi bottoni con angoli solo su primo/ultimo.

### Integrazioni
- **`src/core/integrations/integrationsCatalog.ts`**: catalogo connettori, `TAB_KEYS`, `CONNECTOR_CATALOG`, `STATUS_CONFIG`, `ALL_GROUPS`, `CONNECTOR_EVENT_LABELS`, `EVENT_LABELS`, `N8nConfigSnapshot`, `LOOKER_CONNECTOR_STORAGE_KEY`.
- **Tab in file dedicati**: `ConnettoriTab.tsx`, `RegoleTab.tsx`, `WebhookTab.tsx`, `ComunicazioniTab.tsx`, `ApiTab.tsx`.
- **`IntegrationsPage.tsx`**: importa catalogo e tab; gestisce stato condiviso (connectors, webhookConfigs, n8nConfig, outlook) e passaggio ai tab.

### Pagine refactorate (costanti, hook, componenti)
- **Clienti**
  - `src/core/clients/clientDetailConstants.ts` — `ACTION_TYPE_LABEL`, `STATUS_LABEL`, `statusLabel`, `PROFILATION_FIELDS`, `getProfilationPercent`.
  - `src/core/clients/useClientDetailData.ts` — hook: carica client e requests, espone `reloadRequests`.
  - `src/core/clients/ClientProfilationCard.tsx` — sezione “Profilazione per il match”.
  - `src/lib/formatDate.ts` — utility condivisa `formatDate(iso)`.
- **Appartamenti**
  - `src/core/apartments/apartmentDetailConstants.ts` — `STATUS_FILTER_OPTIONS`, `STATUS_LABEL`, `MODE_LABEL`.
  - `src/core/apartments/useApartmentDetailData.ts` — hook: carica apartment e requests.
  - `src/core/apartments/ApartmentHeaderSection.tsx` — intestazione (indietro, nome, stato, modalità, azioni Modifica/Configura HC).
- **Trattative**
  - `src/core/requests/requestsPageConstants.ts` — `TYPE_LABEL`, `STATUS_LABEL`, `CLIENT_ROLE_LABEL`, `KANBAN_STATUS_ORDER`, `ALLOWED_NEXT_STATUSES`, filtri, `ACTION_TYPE_LABEL`, `formatDate`, `REQUESTS_PER_PAGE`, `ViewMode`.
- **Product Discovery**
  - `src/core/product-discovery/productDiscoveryConstants.ts` — `SEGMENT_OPTIONS`, `SEVERITY_OPTIONS`, `FREQUENCY_OPTIONS`, `BUSINESS_IMPACT_OPTIONS`, `SOURCE_OPTIONS`.

---

## Test

- **BE**: `npm test` in `be-followup-v3` — i test in `v1.test.ts` mockano `apartments.service.js` con `importOriginal` e spread del modulo reale (per esporre `ApartmentCreateSchema` a `future.service`).
- **FE**: `npm test -- --run` in `fe-followup-v3` — test esistenti devono restare verdi dopo il refactor.
