# Design system in Followup 3.0

Followup 3.0 usa il **design system condiviso** della piattaforma Tecma, così che typography, colori e radius siano allineati al DS Figma e riutilizzabili da altri applicativi.

## Dove si trova

- **Pacchetto:** [tecma-digital-platform/design-system](../../design-system)
- **Nome:** `@tecma/design-system-tokens`
- **Contenuto:** token typography, color, radius; CSS variables + `components.css` (Button/Icon). Nessun tema Tailwind nel package.

## Configurazione attuale in fe-followup-v3

L’integrazione è **attiva**:

1. **Dipendenza:** in `package.json` è presente `"@tecma/design-system-tokens": "file:../../design-system"`.
2. **CSS:** import `@tecma/design-system-tokens/css`. Le variabili del pacchetto sono solo quelle Figma: **`--tecma-color-*`** (Alias / Tecma v2) e **`--tecma-typography-*`** (Typography / Tecma), es. `hsl(var(--tecma-color-neutral-canvas))`, `var(--tecma-typography-typeface-sans-serif)`.
3. **Tailwind (solo nell’app):** `tailwind.config.js` usa `var(--tecma-typography-*)` per fontSize/lineHeight/fontWeight. Importare sempre `tokens.css` prima di `@tailwind`.

Non esistono più alias generici tipo `--tecma-background` o `--tecma-font-body`.

## Import delle componenti Figma (wave)

L’ordine e le wave con cui importare in codice le **pagine/componenti** del file Figma DS (Button, Input, Card, ecc.) sono descritti in **[DESIGN_SYSTEM_COMPONENTS_WAVES.md](DESIGN_SYSTEM_COMPONENTS_WAVES.md)**. Per ogni componente il link/node-id Figma va fornito al momento dell’implementazione (richiesto di volta in volta).

## Match con fe-tecma-design-system (@tecma/ds)

Il confronto tra componenti del **design system Tecma** (repo `fe-tecma-design-system-release`, Storybook ds-biz-tecma-dev1.tecmasolutions.com) e quelle in followup-v3, più il piano per allineamento, test e DRY nel DS, è in **[DS_MATCH_AND_ALIGNMENT.md](DS_MATCH_AND_ALIGNMENT.md)**.

## Altri applicativi

Qualsiasi altro frontend nella piattaforma (nuovo o esistente) può riusare lo stesso pacchetto:

1. Aggiungere la dependency `@tecma/design-system-tokens` (file link o workspace).
2. Importare `@tecma/design-system-tokens/css` nel proprio entry CSS.
3. Usare `--tecma-color-*` / `--tecma-typography-*` e opzionalmente `@tecma/design-system-tokens/components.css` per i componenti DS.

Vedi il [README del design-system](../../design-system/README.md) per i dettagli.
