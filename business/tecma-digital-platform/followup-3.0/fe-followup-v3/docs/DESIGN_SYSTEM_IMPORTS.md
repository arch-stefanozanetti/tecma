# Design system (React) in fe-followup-v3

## Componenti React (`Button`, `Avatar`, `InlineEdit`, …)

**Regola:** importare solo da **`@/tecma-ds/...`** (cartella `src/tecma-ds/`), mai da `@tecma/design-system-tokens/button` ecc. nel codice feature/UI.

I file in `src/tecma-ds/*.ts` fanno `export *` verso `../../../../design-system/src/...` con **path relativi stabili**: `tsc` e Vite risolvono senza mapping speciali in `tsconfig` (evita TS2307 in CI).

**Vite / Vitest:** `vite-tsconfig-paths` + solo `paths` `@/*` → `./src/*`.

## CSS e token

`tailwind.config.js` e `styles.css` continuano a usare `@tecma/design-system-tokens/css` e `components.css` dal package `file:../../design-system`.

## Build

- `pnpm run build` → `prebuild` (`verify-design-system.mjs`) poi `tsc --noEmit` poi `vite build`.
- **`design-system` deve avere `node_modules`** (almeno `react` + tipi): altrimenti `tsc` sui file DS importati via `src/tecma-ds` fallisce. In locale, una volta:
  ```bash
  cd business/tecma-digital-platform/design-system && npm ci
  ```
- In **CI** (workflow Followup 3.0) lo step `npm ci` nel design-system è già incluso prima dell’install del FE.

## Troubleshooting

- **TS7006** su `value` in `ClientDetailPage` / `InlineEditText`: usare `(value: string)` negli handler `onSave`.
