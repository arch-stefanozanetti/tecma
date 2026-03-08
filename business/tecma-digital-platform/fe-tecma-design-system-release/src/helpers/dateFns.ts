import { DEFAULT_MOBILE_LOCALE_CONFIG, DATE_FNS_LANGUAGES } from '../constants/locale';
import { LocaleMobileConfig } from '../declarations';

export const getDateFnsLocale = (lang: string, localeConfig?: LocaleMobileConfig): LocaleMobileConfig => {
  return {
    ...DATE_FNS_LANGUAGES?.[lang]?.options,
    locale: DATE_FNS_LANGUAGES?.[lang],
    ...DEFAULT_MOBILE_LOCALE_CONFIG?.[lang],
    ...localeConfig,
  };
};
