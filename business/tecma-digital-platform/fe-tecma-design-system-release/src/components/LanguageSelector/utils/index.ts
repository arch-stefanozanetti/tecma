import { PopoverOrigin } from '@mui/material';

import { AVAILABLE_LANGUAGES, AvailableLanguage, DEFAULT_LANGUAGE, ITEM_HEIGHT } from '../constants';

const isAvailableLanguage = (x: string): x is AvailableLanguage => {
  const availableLanguages = Object.keys(AVAILABLE_LANGUAGES);
  return availableLanguages.includes(x);
};

const defaultRegionByLanguage = (language: string) => {
  if (isAvailableLanguage(language)) {
    return language;
  }
  const availableLanguagesByLang = (Object.keys(AVAILABLE_LANGUAGES) as AvailableLanguage[]).reduce<{
    [key: string]: AvailableLanguage[];
  }>((acc, lang) => {
    const onlyLang = lang.split('-')?.[0];
    return {
      ...acc,
      [onlyLang]: [...(acc?.[onlyLang] ?? []), lang],
    };
  }, {});
  const onlyLang = language.split('-')?.[0];
  return Object.values(availableLanguagesByLang?.[onlyLang] ?? {})?.[0] ?? DEFAULT_LANGUAGE;
};

export const getOrderedLanguages = (languages: AvailableLanguage[], rotated: boolean) => {
  const languagesSorted = languages.sort((languageA, languageB) => languageA.localeCompare(languageB));
  if (rotated) {
    return languagesSorted.reverse();
  }
  return languagesSorted;
};

export const getCleanLanguages = (languages: string[]): AvailableLanguage[] =>
  languages.filter((language) => isAvailableLanguage(language));

export const getNormalizedCurrentLanguage = (language: string, availableLanguages: AvailableLanguage[]): AvailableLanguage => {
  const currentLang = isAvailableLanguage(language) ? language : defaultRegionByLanguage(language);
  return availableLanguages.includes(currentLang) ? currentLang : DEFAULT_LANGUAGE;
};

export const getPositionConfig = (
  itemsCount: number,
  rotated: boolean,
): { [k in 'top' | 'bottom']: { anchorOrigin: PopoverOrigin; transformOrigin: PopoverOrigin } } => {
  const maxVerticalTransform = ITEM_HEIGHT * (itemsCount > 6 ? 6 : itemsCount) + 8;
  return {
    top: {
      anchorOrigin: {
        vertical: rotated ? 'top' : 'bottom',
        horizontal: rotated ? 'left' : 'right',
      },
      transformOrigin: {
        vertical: rotated ? maxVerticalTransform : -8,
        horizontal: rotated ? 'left' : 'right',
      },
    },
    bottom: {
      anchorOrigin: {
        vertical: rotated ? 'bottom' : 'top',
        horizontal: rotated ? 'left' : 'right',
      },
      transformOrigin: {
        vertical: rotated ? -8 : maxVerticalTransform,
        horizontal: rotated ? 'left' : 'right',
      },
    },
  };
};
