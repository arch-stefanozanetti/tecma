# @tecma/design-system-tokens

Design system Tecma: **token** (Figma → CSS/TS), **CSS per componenti** (Button, Icon, Accordion, Alert), Storybook. Nessun Tailwind nel package.

## Contenuto

- **`css/fonts.css`** — caricamento **Lato** (sans DS Tecma da Figma). **Importare per primo** rispetto ai token.
- **`css/tokens.css`** — variabili `--tecma-color-*`, `--tecma-typography-*` (sans = `"Lato"`), `--tecma-values-border-radius-*` (generato da `sync:tokens`).
- **`css/components.css`** — classi `.tecma-button`, `.tecma-icon` (dopo `tokens.css`).
- **Primitive** — `data/figma-primitives-hex.json`, `data/figma-primitives-radius.json`.
- **Componenti React** — `Button`, `Icon`, **Avatar**, `AccordionItem`, `Alert`, `Checkbox`, `Tag`, **Select** (trigger / item / menu + `Select` composto), **InlineEdit** (Text, Select, Multiselect) in `src/components/` (`tokens.css` + `components.css`).

## Allineamento Figma

1. Sostituisci `data/figma-variables.json`.
2. Aggiorna i JSON delle primitive (hex + radius).
3. `npm run sync:tokens` → `tokens/*.ts`, `css/tokens.css`.
4. `npm run build` (solo TypeScript per `dist/tokens`).

## Storybook

```bash
npm install
npm run storybook
```

`http://localhost:6006`. Statico: `npm run build-storybook`.

### Test Storybook (flusso per ogni nuovo componente)

Riferimento ufficiale: **[Storybook — How to test UIs](https://storybook.js.org/docs/writing-tests)** (render, interaction, accessibilità, CI).

| Step | Azione |
|------|--------|
| 1 | Aggiungere `src/stories/components/<Nome>.stories.tsx` con **tutti gli stati rilevanti** (default, varianti, disabled/loading/error se esistono). Ogni story che monta senza errori è un **render test**. |
| 2 | Per `onClick` / `onDismiss` / callback nelle story: usare **`noop`** da [`src/stories/storyStubHandlers.ts`](src/stories/storyStubHandlers.ts) o `() => {}`. **Evitare** `import` da `@storybook/addon-actions` o `@storybook/test` nel file story (con SB 8 + Vite possono causare errori di *dynamic import* in dev). |
| 3 | Controllare il pannello **Accessibility** sulle story principali. In preview è impostato `a11y.test: "todo"` così il **test-runner in CI non fallisce** sulle violazioni residue; correggere comunque contrasto/ruoli e, per story critiche, valutare `parameters.a11y.test: "error"` a livello di story ([a11y testing](https://storybook.js.org/docs/writing-tests/accessibility-testing)). |
| 4 | *(Opz.)* Interaction: funzione `play` con `userEvent` + `expect` ([interaction testing](https://storybook.js.org/docs/writing-tests/interaction-testing)); se si ripresentano errori di modulo, usare solo test-runner in CI. |
| 5 | *(Opz.)* CI: workflow [`storybook-design-system.yml`](../.github/workflows/storybook-design-system.yml) (monorepo tecma-digital-platform). In locale: `npm run test-storybook:ci` — su monorepo con altri package, Jest può segnalare snapshot “obsolete” estranei: eseguire la stessa pipeline da una **copia isolata** della cartella `design-system` (come fa il job CI in `/tmp`) oppure affidarsi al job su GitHub. Template: [`ci/github-storybook-tests.yml`](ci/github-storybook-tests.yml). |
| 6 | *(Opz.)* Visual regression con Chromatic ([visual tests](https://storybook.js.org/docs/writing-tests/visual-testing)). |

**Locale — test-runner** (dopo `npm run build-storybook`):

```bash
npx http-server storybook-static -p 6099 -s &
npx wait-on http://127.0.0.1:6099 && npx test-storybook --url http://127.0.0.1:6099
```

Oppure in un unico comando: `npm run test-storybook:ci` (vedi `package.json`).

#### Roadmap (Storybook 10 + Vitest)

**Valutazione (non implementato):** portare il package a **Storybook 9/10** e installare **`@storybook/addon-vitest`** per eseguire i test delle story da UI/sidebar e allinearsi alla [doc ufficiale](https://storybook.js.org/docs/writing-tests) (watch mode, coverage). Richiede migrazione da 8.6 (`npx storybook@latest upgrade`), verifica story MDX/CSF e possibili ritocchi Vite. Il test-runner attuale resta valido fino a quella milestone.

## Uso nelle app

### Token + componenti

```css
@import "@tecma/design-system-tokens/fonts.css";
@import "@tecma/design-system-tokens/css";
@import "@tecma/design-system-tokens/components.css";
```

Poi `<button class="tecma-button tecma-button--primary tecma-button--md">` oppure il componente React `<Button />` (stesse classi).

### Solo token (TS)

```ts
import { typography, color, borderRadiusPx } from "@tecma/design-system-tokens";
```

### App con Tailwind (es. followup-v3)

Il package **non** espone più un tema Tailwind. Estendi `fontSize` / `fontFamily` con `var(--tecma-typography-*)` come in `fe-followup-v3/tailwind.config.js` e importa sempre `tokens.css` prima di `@tailwind`.

## Struttura

```
design-system/
├── css/
│   ├── fonts.css           # Lato (Google Fonts)
│   ├── tokens.css          # generato
│   ├── components.css      # + tag + select (Button…Select)
│   └── storybook-layout.css
├── tokens/                 # generati + index
├── src/components/
├── src/stories/
└── scripts/sync-figma-tokens.mjs
```

## Figma

[DS — Tecma Software Suite](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/)
