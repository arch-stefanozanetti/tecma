export const DEFAULT_LANGUAGE: AvailableLanguage = 'en-GB';

export type AvailableLanguage = 'de-DE' | 'en-GB' | 'en-US' | 'en-IN' | 'es-ES' | 'es-US' | 'fr-FR' | 'it-IT';

export const ITEM_HEIGHT = 60;
export const AVAILABLE_LANGUAGES: {
  [k in AvailableLanguage]: { language: string; region: string };
} = {
  'de-DE': {
    language: 'Deutsch',
    region: 'Deutschland',
  },
  'en-US': {
    language: 'English',
    region: 'United States',
  },
  'en-GB': {
    language: 'English',
    region: 'United Kingdom',
  },
  'en-IN': {
    language: 'English',
    region: 'India',
  },
  'es-ES': {
    language: 'Español',
    region: 'España',
  },
  'es-US': {
    language: 'Español',
    region: 'Americana',
  },
  'fr-FR': {
    language: 'Français',
    region: 'France',
  },
  'it-IT': {
    language: 'Italiano',
    region: 'Italia',
  },
};
