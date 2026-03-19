# Import da `@tecma/design-system-tokens/*` (React)

Il pacchetto è collegato con `file:../../design-system`. I **subpath** verso i `.tsx` del DS non sono sempre risolti allo stesso modo da **tsc** e da **Vite** in CI.

**Regola:** i mapping sono definiti **solo** in `tsconfig.json` → `compilerOptions.paths`.

**Vite / Vitest** applicano gli stessi path tramite **`vite-tsconfig-paths`** (`vite.base-plugins.ts`), così non si duplicano alias in `vite.config.ts`.

Se aggiungi un nuovo import `@tecma/design-system-tokens/…` da un file React del DS:

1. Aggiungi la riga in `tsconfig.json` `paths` (come gli altri subpath).
2. Non serve toccare `vite.config.ts` (il plugin legge il tsconfig).

`tailwind.config.js` e `styles.css` continuano a importare `css` / `tailwind` dal package linkato come prima.

## Build

- Lo script `build` usa **`tsc --noEmit`** (non `tsc -b`): typecheck unico sul `tsconfig.json` con i `paths` del DS.
- **`prebuild`** esegue `scripts/verify-design-system.mjs`: se manca `business/tecma-digital-platform/design-system`, il build fallisce subito con messaggio esplicito (tipico: checkout parziale o path sbagliato in CI).

## Se in CI vedi TS2307 su `@tecma/design-system-tokens/...`

1. Conferma che il commit includa `tsconfig.json` con i `paths` verso `../../design-system/...`.
2. Conferma che la cartella `design-system` esista sul runner (stesso livello di `followup-3.0` sotto `tecma-digital-platform`).
3. Gli errori **TS7006** su `value` in `ClientDetailPage` indicano commit senza `(value: string)` negli `onSave` di `InlineEditText`: allineare il branch a `main` / alla PR aggiornata.
