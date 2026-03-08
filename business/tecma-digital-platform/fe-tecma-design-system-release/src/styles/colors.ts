// Tecma Design System - Colors TypeScript Export
// Type definitions and utilities for colors

export type Colors = 'primary' | 'secondary' | 'info' | 'warning' | 'success' | 'danger' | 'transparent' | 'inverse';

// Color categories for better organization
export type MainColors = 'accent' | 'primary' | 'secondary' | 'tertiary';
export type SemanticColors = 'danger' | 'info' | 'success' | 'warning';
export type NeutralColors = 'general' | 'inverse' | 'negative' | 'disabled';
export type GrayScale = 'gray-50' | 'gray-100' | 'gray-200' | 'gray-300' | 'gray-400' | 'gray-500' | 'gray-600' | 'gray-700' | 'gray-800' | 'gray-900';

// All available color names
export type AllColors = MainColors | SemanticColors | NeutralColors | GrayScale;

// Color variants
export type ColorVariants = 'active' | 'border' | 'hover' | 'light' | 'disabled';
export type OnColorVariants = 'on' | 'on-disabled' | 'on-light' | 'on-sub';

// Utility type for color combinations
export interface ColorPalette {
  base: string;
  active?: string;
  border?: string;
  hover?: string;
  light?: string;
  on?: string;
  'on-disabled'?: string;
  'on-light'?: string;
  'on-sub'?: string;
}

// Color utility functions
export const getColorClass = (color: Colors): string => `tecma-color-${color}`;
export const getSemanticColorClass = (color: SemanticColors): string => `tecma-semantic-${color}`;
export const getNeutralColorClass = (color: NeutralColors): string => `tecma-neutral-${color}`;
