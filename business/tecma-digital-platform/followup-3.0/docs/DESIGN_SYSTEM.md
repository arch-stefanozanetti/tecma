# Design system in Followup 3.0

Followup 3.0 usa il **design system condiviso** della piattaforma Tecma, così che typography, colori e radius siano allineati al DS Figma e riutilizzabili da altri applicativi.

## Dove si trova

- **Pacchetto:** [tecma-digital-platform/design-system](../../design-system)
- **Nome:** `@tecma/design-system-tokens`
- **Contenuto:** token typography (Figma), color (semantici), radius/spacing; output CSS variables + tema Tailwind.

## Configurazione attuale in fe-followup-v3

L’integrazione è **attiva**:

1. **Dipendenza:** in `package.json` è presente `"@tecma/design-system-tokens": "file:../../design-system"`.
2. **CSS:** in `src/styles.css` viene importato `@tecma/design-system-tokens/css` prima di `@tailwind base`; in `:root` le variabili `--body-font` e `--title-font` puntano a `var(--tecma-font-body)` e `var(--tecma-font-title)`.
3. **Tailwind:** in `tailwind.config.js` il tema è esteso con `tecmaTheme` (fontFamily, fontSize, fontWeight, lineHeight, borderRadius). I colori restano sulle variabili locali (`--background`, `--primary`, ecc.) già in uso nell’app.

Le variabili del design system sono disponibili sotto il prefisso `--tecma-*` (es. `--tecma-font-size-m`, `--tecma-primary`).

## Import delle componenti Figma (wave)

L’ordine e le wave con cui importare in codice le **pagine/componenti** del file Figma DS (Button, Input, Card, ecc.) sono descritti in **[DESIGN_SYSTEM_COMPONENTS_WAVES.md](DESIGN_SYSTEM_COMPONENTS_WAVES.md)**. Per ogni componente il link/node-id Figma va fornito al momento dell’implementazione (richiesto di volta in volta).

## Match con fe-tecma-design-system (@tecma/ds)

Il confronto tra componenti del **design system Tecma** (repo `fe-tecma-design-system-release`, Storybook ds-biz-tecma-dev1.tecmasolutions.com) e quelle in followup-v3, più il piano per allineamento, test e DRY nel DS, è in **[DS_MATCH_AND_ALIGNMENT.md](DS_MATCH_AND_ALIGNMENT.md)**.

## Altri applicativi

Qualsiasi altro frontend nella piattaforma (nuovo o esistente) può riusare lo stesso pacchetto:

1. Aggiungere la dependency `@tecma/design-system-tokens` (file link o workspace).
2. Importare `@tecma/design-system-tokens/css` nel proprio entry CSS.
3. Usare le variabili `--tecma-*` negli stili o estendere Tailwind con `@tecma/design-system-tokens/tailwind`.

Vedi il [README del design-system](../../design-system/README.md) per i dettagli.
