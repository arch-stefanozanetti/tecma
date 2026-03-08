/**
 * Token colore — struttura condivisa.
 * I valori semantici possono essere sovrascritti per app (es. followup-3.0).
 * Allineamento con DS Figma quando disponibili le variabili colore.
 */

/** Valori HSL senza prefisso hsl() — per uso con hsl(var(--x)) */
export const color = {
  /** Colori semantici (es. followup-3.0) — valori default piattaforma */
  semantic: {
    background: "0 0% 100%",
    foreground: "224 20% 26%",
    primary: "238 64% 58%",
    "primary-foreground": "0 0% 100%",
    secondary: "220 20% 91%",
    "secondary-foreground": "224 20% 26%",
    muted: "220 20% 95%",
    "muted-foreground": "224 16% 45%",
    accent: "238 64% 58%",
    "accent-foreground": "0 0% 100%",
    destructive: "1 58% 52%",
    "destructive-foreground": "0 0% 100%",
    border: "220 17% 86%",
    input: "220 17% 86%",
    ring: "238 64% 58%",
    card: "0 0% 100%",
    "card-foreground": "224 20% 26%",
    sidebar: "222 24% 90%",
    "sidebar-foreground": "224 20% 26%",
    "sidebar-border": "220 20% 83%",
    "sidebar-accent": "238 64% 95%",
    "sidebar-accent-foreground": "238 64% 42%",
  },
  /** Raw/hex per contesti dove serve valore completo (es. panel, scrollbar) */
  raw: {
    "app-bg": "#f8f8f9",
    "panel-bg": "rgba(255, 255, 255, 0.85)",
    "panel-border": "#dbe2ef",
    "scrollbar-thumb": "#d3d4da",
    "scrollbar-thumb-hover": "#b0b3bf",
  },
} as const;

export type ColorToken = typeof color;
