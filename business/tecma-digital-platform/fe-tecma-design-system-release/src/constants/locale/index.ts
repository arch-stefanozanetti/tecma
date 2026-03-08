/* eslint-disable global-require */
import { Locale } from 'rc-picker/lib/interface';

import de from './de_DE';
import enGB from './en_GB';
import enUS from './en_US';
import es from './es_ES';
import fr from './fr_FR';
import it from './it_IT';
import { AvailableLanguage } from '../../components/LanguageSelector/constants';

export const DEFAULT_LOCALE_CONFIG: { [key: string]: Partial<Locale> } = {
  it,
  de,
  enGB,
  enUS,
  fr,
  es,
};

export const DEFAULT_MOBILE_LOCALE_CONFIG: {
  [k in AvailableLanguage]: Partial<Locale> & {
    blank?: string | undefined;
    headerFormat?: string | undefined;
    todayLabel?:
      | {
          long: string;
        }
      | undefined;
    weekdays?: string[] | undefined;
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined;
  };
} = {
  'de-DE': {
    headerFormat: 'ddd, DD MMM',
    weekdays: ['Son', 'Mon', 'Die', 'Mit', 'Don', 'Fre', 'Sam'],
    blank: 'Wählen Sie ein Datum',
    todayLabel: {
      long: 'Heute',
    },
  },
  'en-US': { headerFormat: 'ddd, MMM DD' },
  'en-GB': { headerFormat: 'ddd, MMM DD' },
  'en-IN': {
    headerFormat: 'ddd, MMM DD',
  },
  'es-ES': {
    headerFormat: 'ddd, DD MMM',
    weekdays: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    blank: 'Seleccione una fecha',
    todayLabel: {
      long: 'Hoy',
    },
  },
  'es-US': {
    headerFormat: 'ddd, DD MMM',
    weekdays: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    blank: 'Seleccione una fecha',
    todayLabel: {
      long: 'Hoy',
    },
  },
  'fr-FR': {
    headerFormat: 'ddd, DD MMM',
    weekdays: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    blank: 'Aucune date selectionnee',
    todayLabel: {
      long: "Aujourd'hui",
    },
  },
  'it-IT': {
    headerFormat: 'ddd, DD MMM',
    weekdays: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
    blank: 'Seleziona una data',
    todayLabel: {
      long: 'Oggi',
    },
    weekStartsOn: 1,
  },
};

export const DATE_FNS_LANGUAGES: {
  [k in AvailableLanguage]: unknown;
} = {
  'de-DE': require('date-fns/locale/de'),
  'en-US': require('date-fns/locale/en'),
  'en-GB': require('date-fns/locale/en'),
  'en-IN': require('date-fns/locale/en'),
  'es-ES': require('date-fns/locale/es'),
  'es-US': require('date-fns/locale/es'),
  'fr-FR': require('date-fns/locale/fr'),
  'it-IT': require('date-fns/locale/it'),
};
