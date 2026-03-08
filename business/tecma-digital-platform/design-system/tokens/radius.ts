/**
 * Token per border-radius e spacing condivisi.
 * Estendibili con valori dal DS Figma quando definiti.
 */

export const radius = {
  sm: "calc(var(--tecma-radius, 0.85rem) - 4px)",
  md: "calc(var(--tecma-radius, 0.85rem) - 2px)",
  lg: "var(--tecma-radius, 0.85rem)",
  /** Valore base (usato in :root come --tecma-radius) */
  DEFAULT: "0.85rem",
} as const;

export const spacing = {
  /** Scale 4px base (es. 1 = 4px, 2 = 8px) — da allineare al DS se definito */
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export type RadiusToken = typeof radius;
export type SpacingToken = typeof spacing;
