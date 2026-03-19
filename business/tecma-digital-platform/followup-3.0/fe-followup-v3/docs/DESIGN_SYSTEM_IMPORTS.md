# Import da `@tecma/design-system-tokens/*` (React)

Il pacchetto è collegato con `file:../../design-system`. I **subpath** verso i `.tsx` del DS non sono sempre risolti allo stesso modo da **tsc** e da **Vite** in CI.

**Regola:** i mapping sono definiti **solo** in `tsconfig.json` → `compilerOptions.paths`.

**Vite / Vitest** applicano gli stessi path tramite **`vite-tsconfig-paths`** (`vite.base-plugins.ts`), così non si duplicano alias in `vite.config.ts`.

Se aggiungi un nuovo import `@tecma/design-system-tokens/…` da un file React del DS:

1. Aggiungi la riga in `tsconfig.json` `paths` (come gli altri subpath).
2. Non serve toccare `vite.config.ts` (il plugin legge il tsconfig).

`tailwind.config.js` e `styles.css` continuano a importare `css` / `tailwind` dal package linkato come prima.
