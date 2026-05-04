/**
 * Generato da scripts/sync-figma-tokens.mjs — Typography / mode Tecma (Figma)
 */

export const typography = {
  fontFamily: {
    serif: '"Ivy Journal", Georgia, serif',
    sans: '"Lato", "Segoe UI", sans-serif',
    body: '"Lato", "Segoe UI", sans-serif',
    title: '"Lato", "Segoe UI", sans-serif',
  },

  fontWeight: {
    thin: 100,
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  size: {
    standard: {
      '2xs': 10,
      xs: 12,
      s: 14,
      m: 16,
      l: 18,
      xl: 20,
      '2xl': 24,
    },
    oversize: {
      s: 36,
      m: 48,
      l: 50,
      xl: 62,
    },
  },

  lineHeight: {
    standard: {
      '2xs': 14,
      xs: 17,
      s: 20,
      m: 22,
      l: 25,
      xl: 28,
      '2xl': 34,
    },
    oversize: {
      s: 42,
      m: 56,
      l: 58,
      xl: 72,
    },
  },

  textStyles: {
    title1: { size: 'xl', lineHeight: 'xl' },
    title2: { size: 'l', lineHeight: 'l' },
    subtitle1: { size: 'm', lineHeight: 'm' },
    subtitle2: { size: 's', lineHeight: 's' },
    body1: { size: 'm', lineHeight: 'm' },
    body2: { size: 's', lineHeight: 's' },
    button: { size: 's', lineHeight: 's' },
    caption: { size: 'xs', lineHeight: 'xs' },
    overline: { size: '2xs', lineHeight: '2xs' },
  },
} as const;

export type TypographyToken = typeof typography;
