export * from './dimensions.scss';

export type Dimensions =
  | 'spacingXxs'
  | 'spacingXs'
  | 'spacingS'
  | 'spacingM'
  | 'spacingL'
  | 'borderRadiusElement'
  | 'borderRadiusExternal'
  | 'borderRadiusInternal'
  | 'borderRadiusStandard';

export const dimensions = {
  spacingXxs: 'spacingXxs',
  spacingXs: 'spacingXs',
  spacingS: 'spacingS',
  spacingM: 'spacingM',
  spacingL: 'spacingL',
  borderRadiusElement: 'borderRadiusElement',
  borderRadiusExternal: 'borderRadiusExternal',
  borderRadiusInternal: 'borderRadiusInternal',
  borderRadiusStandard: 'borderRadiusStandard',
} as const;
