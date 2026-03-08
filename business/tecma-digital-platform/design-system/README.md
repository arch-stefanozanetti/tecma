# @tecma/design-system-tokens

Design system condiviso per la **piattaforma Tecma**: token tipografici, colore e spacing allineati al DS Figma (DS — Tecma Software Suite). Pensato per essere riusato da **followup-3.0** e da altri applicativi futuri.

## Contenuto

- **Typography** – typeface (Ivy Journal, Lato), weight, size (standard + oversize), line-height
- **Color** – semantici (primary, background, …) e palette; estensibile per app-specific
- **Spacing / Radius** – convenzioni comuni; valori da allineare al Figma quando definiti

I token sono la **single source of truth**; le app consumano via CSS variables e/o tema Tailwind.

## Come usarlo nelle app

### 1. Variabili CSS (qualsiasi stack)

Importa il foglio token nel tuo entry (es. `main.tsx` o `index.css`):

```css
@import "@tecma/design-system-tokens/css";
```

Oppure con path relativo (senza npm link):

```css
@import "../../design-system/css/tokens.css";
```

Poi usa le variabili nei tuoi stili o in Tailwind:

```css
body {
  font-family: var(--tecma-font-body);
  font-size: var(--tecma-font-size-m);
  line-height: var(--tecma-line-height-m);
}
```

### 2. Tailwind (React/Vite, followup-3.0, ecc.)

In `tailwind.config.js` estendi il tema con i token:

```js
import tecmaTheme from "@tecma/design-system-tokens/tailwind";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: tecmaTheme.fontFamily,
      fontSize: tecmaTheme.fontSize,
      lineHeight: tecmaTheme.lineHeight,
      // ... colori, spacing se esposti
    },
  },
};
```

E importa i CSS token nell’entry (es. `src/styles.css`):

```css
@import "@tecma/design-system-tokens/css";
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 3. Uso programmatico (JS/TS)

Per logica o componenti che leggono i token a runtime:

```ts
import { typography, color } from "@tecma/design-system-tokens";

// es. fontSize standard "m" => 16
const sizePx = typography.size.standard.m;
```

## Struttura

```
design-system/
├── package.json
├── README.md
├── css/
│   └── tokens.css       # Variabili CSS (importabile da qualsiasi app)
├── tokens/              # Single source of truth
│   ├── typography.ts
│   ├── color.ts
│   └── index.ts
├── src/                 # Build per dist (tokens.js, tailwind.theme.js)
│   ├── tokens.ts
│   └── tailwind.theme.ts
└── tsconfig.json
```

## Riferimento Figma

- **File:** [DS — Tecma Software Suite](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/)
- **Typography (Variabili tipografiche):** node `8932-33170` (frame Typography)
- **Tecma** usa: sans Lato, serif Ivy Journal; weight thin → bold; scale standard + oversize come in `tokens/typography.ts`

## Versioning e app

- I token sono **condivisi**: modifiche qui impattano tutte le app che li consumano.
- Per override **solo in un’app** (es. followup-3.0): ridefinisci le variabili CSS dopo l’import del design-system, oppure estendi il tema Tailwind nell’app.
