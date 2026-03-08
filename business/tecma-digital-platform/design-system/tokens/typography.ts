/**
 * Token tipografici — DS Tecma Software Suite (Figma).
 * Riferimento: Variabili tipografiche, frame Typography (node 8932-33170).
 * Riusabili da followup-3.0 e da altri applicativi.
 */

export const typography = {
  /** Typeface: serif = Ivy Journal, sans = Lato */
  fontFamily: {
    serif: '"Ivy Journal", Georgia, serif',
    sans: '"Lato", "Segoe UI", sans-serif',
    /** Alias per body/testo */
    body: '"Lato", "Segoe UI", sans-serif',
    /** Alias per titoli (DS Tecma usa Lato anche per title) */
    title: '"Lato", "Segoe UI", sans-serif',
  },

  /** Pesi font (nomi Figma → valore CSS) */
  fontWeight: {
    thin: 100,
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  /** Dimensioni font (px) — scale standard */
  size: {
    standard: {
      "2xs": 10,
      xs: 12,
      s: 14,
      m: 16,
      l: 18,
      xl: 20,
      "2xl": 24,
    },
    oversize: {
      s: 36,
      m: 48,
      l: 50,
      xl: 62,
    },
  },

  /** Line height (px) */
  lineHeight: {
    standard: {
      s: 16,
      m: 20,
      l: 24,
      xl: 32,
    },
    oversize: {
      s: 48,
      m: 56,
      l: 72,
    },
  },
} as const;

export type TypographyToken = typeof typography;
