# Architettura e come aggiungere una funzionalità

Obiettivo: **aggiungere una nuova funzionalità deve richiedere pochissimo sforzo.** Questo documento è il punto di riferimento per dove mettere codice e quali pattern usare.

---

## Struttura `src/`

| Cartella | Uso |
|----------|-----|
| **api/** | Client HTTP (`http.ts`) e tutti gli endpoint (`followupApi.ts`). Le chiamate al backend passano **solo** da qui. Per client e appartamenti usa `followupApi.clients.*` e `followupApi.apartments.*`; i moduli in `api/domains/` sono implementazione interna. |
| **auth/** | Login, scope workspace/progetti, salvataggio preferenze. |
| **components/ui/** | Componenti UI riutilizzabili (Button, Input, Select, Dialog, …). Nuovi componenti DS vanno qui; ogni componente può avere `*.test.tsx`. |
| **core/** | Feature per area: `auth/`, `calendar/`, `clients/`, `apartments/`, `workflows/`, `ai/`, `hc/`, `templates/`, ecc. Ogni area può contenere pagine, componenti specifici, hook locali. |
| **core/shared/** | Componenti e hook condivisi tra più aree: `PageTemplate`, `usePaginatedList`, `useAsync`, `DataTable`, `CommandPalette`. |
| **data/** | Adapter e tipi per il layer dati (feed, mock). |
| **lib/** | Utility: `utils.ts` (es. `cn`), `ds-form-classes.ts` (classi DS per form, DRY). |
| **types/** | Tipi di dominio e API in `domain.ts`. Tutti i tipi condivisi (request/response, entità) vivono qui. |

---

## Aggiungere una nuova pagina / schermata

1. **Route**  
   In `App.tsx` (o dove sono definite le route) aggiungi la route e il componente.

2. **Dove mettere il componente**  
   - Pagina legata a un’area esistente → `src/core/<area>/<NomePagina>.tsx` (es. `core/clients/ClientsPage.tsx`).  
   - Nuova area → crea `src/core/<nuova-area>/` e metti lì la pagina.

3. **Layout**  
   Usa `PageTemplate` (o `PageSimple`) da `core/shared` per header, contenitore e stile coerente.

4. **Dati**  
   - **Lista paginata** (tabella, griglia) → usa **`usePaginatedList`** (vedi sotto). Esempi: `ClientsPage`, `ApartmentsPage`.  
   - **Una sola chiamata async** (caricamento iniziale, submit form, “carica progetti”) → usa **`useAsync`** (vedi sotto).  
   Non replicare a mano `useState` per loading/error: usa questi hook.

5. **API**  
   Se serve un nuovo endpoint: aggiungi il metodo in `followupApi.ts` e, se necessario, i tipi in `types/domain.ts`.

---

## Aggiungere un nuovo endpoint API

1. **Tipi**  
   In `types/domain.ts` definisci i tipi per request/response (o riusa `ListQuery` / `PaginatedResponse<T>` se è una query paginata).

2. **Metodo in followupApi**  
   In `api/followupApi.ts` aggiungi un metodo che usa `getJson`, `postJson`, `putJson`, `patchJson` o `deleteJson` da `http.ts`. Per domini già strutturati (client, appartamenti) aggiungi il metodo in `api/domains/clientsApi.ts` o `api/domains/apartmentsApi.ts` e usa in pagina `followupApi.clients.*` / `followupApi.apartments.*`. Esempio per un nuovo dominio:
   ```ts
   getSomething: (id: string) => getJson<Something>(`/something/${id}`),
   createSomething: (payload: SomethingCreate) => postJson<Something>("/something", payload),
   ```

3. **Uso nella pagina**  
   Importa `followupApi` e chiama il nuovo metodo. Se è un’azione one-shot (submit, caricamento iniziale), usa `useAsync`. Se è una lista paginata, usa `usePaginatedList` con un loader che chiama l’endpoint.

---

## Hook condivisi: quando usarli

### Liste paginate (tabella, griglia con ricerca/paginazione)

Usa **`usePaginatedList`** in `core/shared/usePaginatedList.ts`:

- Riceve: `loader` (funzione che prende `ListQuery` e restituisce `Promise<PaginatedResponse<T>>`), `workspaceId`, `projectIds`, `defaultSortField`, opzionalmente `filters` e `defaultPerPage`.
- Restituisce: `data`, `total`, `page`, `setPage`, `searchText`, `setSearchText`, `isLoading`, `error`.

Non reimplementare load + loading + error + paginazione nelle pagine: passa un loader che chiama `followupApi` e usa i valori restituiti dall’hook.

### Azioni async singole (on-demand: login, submit form, “carica progetti”, salvataggio)

Usa **`useAsync`** in `core/shared/useAsync.ts`:

- Riceve una funzione async (es. `(email: string) => followupApi.getProjectsByEmail(email)`).
- Restituisce: `run(...args)` per eseguire l’azione, `data`, `error`, `isLoading`, `reset`.

La funzione passata a `useAsync` **deve essere stabile** (es. definita con `useCallback` o importata). **Non usare useAsync per caricamenti che devono avvenire al cambiare di id o dipendenze** (es. dettaglio entità): in quel caso usare `useEffect` + `useState` con dipendenze stabili (vedi sotto).

Gestisci loading e error tramite l’hook invece di ripetere `setLoading` / `setError` in ogni componente.

### Caricamento legato a id/dipendenze (pagine dettaglio, liste con filtri)

Usa **`useEffect` + `useState`** con dipendenze stabili (id dalla route, chiavi derivate come `selectedProjectIds.join(',')`, eventuale “version” per reload manuale). Esempi: `useClientDetailData`, `useApartmentDetailData` (in `core/clients/`, `core/apartments/`).

Per evitare re-run inutili quando il parent passa nuovi riferimenti (es. array), usare una chiave stabile (es. `selectedProjectIdsKey = selectedProjectIds.join(',')`) nelle dipendenze. Usare sempre un flag `cancelled` nel cleanup degli effetti per evitare setState dopo unmount o dopo cambio dipendenze.

---

## Aggiungere un nuovo componente UI

- **Componenti riutilizzabili / Design System** → `src/components/ui/<Nome>.tsx`.  
  Usa le classi da `lib/ds-form-classes.ts` se è un form control; allinea al DS Figma (vedi `.cursor/rules/figma-design-system.mdc`).  
  Aggiungi test in `src/components/ui/<Nome>.test.tsx`.

- **Componente specifico di una feature** → nella cartella dell’area, es. `core/<area>/<ComponentName>.tsx`.

---

## Qualità e test

- **Test unitari:** Vitest + React Testing Library. Comandi: `npm run test`, `npm run test:run`, `npm run test:coverage`.
- **Nuovi componenti UI:** aggiungere test in `*.test.tsx` nella stessa cartella.
- **CI:** il workflow `.github/workflows/ci-fe.yml` esegue test e build su push/PR che toccano `fe-followup-v3/`.

---

## Riepilogo checklist “nuova funzionalità”

- [ ] Route e pagina in `core/<area>/` (o nuova cartella area).
- [ ] Nuovo endpoint? → tipo in `types/domain.ts` + metodo in `api/followupApi.ts`.
- [ ] Lista paginata? → `usePaginatedList` con loader che usa `followupApi`.
- [ ] Azione async singola? → `useAsync` invece di useState loading/error.
- [ ] Nuovo componente riutilizzabile? → `components/ui/` + test.
- [ ] Layout pagina? → `PageTemplate` / `PageSimple`.
