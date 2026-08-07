export const SUPPORTED_I18N_LOCALES = ['it', 'ar', 'en', 'en-GB'] as const;

export const I18N_APP_NAMESPACES = [
  'common',
  'auth',
  'workspace',
  'projects',
  'organization',
  'shell',
  'rbac',
  'userRbac',
] as const;

export type SupportedI18nLocale = (typeof SUPPORTED_I18N_LOCALES)[number];
export type I18nAppNamespace = (typeof I18N_APP_NAMESPACES)[number];

export const isSupportedI18nLocale = (value: string): value is SupportedI18nLocale =>
  (SUPPORTED_I18N_LOCALES as readonly string[]).includes(value);

export const isI18nAppNamespace = (value: string): value is I18nAppNamespace =>
  (I18N_APP_NAMESPACES as readonly string[]).includes(value);
