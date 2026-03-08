// Tecma Design System - Fonts TypeScript Export
// Type definitions and utilities for typography

export type FontSize = 'extraSmall' | 'small' | 'default' | 'medium' | 'large' | 'extraLarge';
export type FontFamily = 'primary' | 'secondary';
export type FontWeight = 'light' | 'normal' | 'bold';

// Font size values in rem
export const fontSizes = {
  extraSmall: '0.625rem', // 10px
  small: '0.76rem',       // 12px
  default: '0.875rem',    // 14px
  medium: '1rem',         // 16px
  large: '1.25rem',       // 20px
  extraLarge: '1.5rem',   // 24px
} as const;

// Font family values
export const fontFamilies = {
  primary: 'Lato',
  secondary: 'Ivy Journal',
} as const;

// Font weight values
export const fontWeights = {
  light: 300,
  normal: 400,
  bold: 700,
} as const;

// Typography utility functions
export const getFontSizeClass = (size: FontSize): string => `tecma-font-${size}`;
export const getFontFamilyClass = (family: FontFamily): string => `tecma-font-family-${family}`;
export const getFontWeightClass = (weight: FontWeight): string => `tecma-font-weight-${weight}`;

// Typography combinations
export interface TypographyStyle {
  fontSize: FontSize;
  fontFamily: FontFamily;
  fontWeight: FontWeight;
}

export const getTypographyClass = (style: TypographyStyle): string => 
  `${getFontSizeClass(style.fontSize)} ${getFontFamilyClass(style.fontFamily)} ${getFontWeightClass(style.fontWeight)}`;
