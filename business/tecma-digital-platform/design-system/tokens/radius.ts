/**
 * Generato da sync-figma-tokens.mjs
 * border-radius: Alias Global → values.border-radius (mode Tecma v2)
 * Primitive: data/figma-primitives-radius.json (es. radius.square.*)
 */

/** Nomi Figma: external (card), internal (in card), element (es. button), standard */
export const borderRadius = {
  external: "var(--tecma-values-border-radius-external)",
  internal: "var(--tecma-values-border-radius-internal)",
  element: "var(--tecma-values-border-radius-element)",
  standard: "var(--tecma-values-border-radius-standard)",
} as const;

export const borderRadiusPx = {
  external: 16,
  internal: 8,
  element: 8,
  standard: 4,
} as const;

/** Convenzione scala (sm/md/lg) se serve in app */
export const radius = {
  sm: borderRadius.standard,
  md: borderRadius.element,
  lg: borderRadius.external,
  DEFAULT: borderRadius.element,
} as const;

export const spacing = {
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

export type BorderRadiusToken = typeof borderRadius;
export type RadiusToken = typeof radius;
export type SpacingToken = typeof spacing;
