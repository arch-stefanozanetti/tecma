import classNames from 'classnames';
import { Locale } from 'rc-picker/lib/interface';

import { DEFAULT_LOCALE_CONFIG } from '../../../constants/locale';

export const transPlacement2DropdownAlign = (
  direction: 'rtl' | 'ltr',
  placement: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight',
) => {
  const overflow = {
    adjustX: 1,
    adjustY: 1,
  };
  switch (placement) {
    case 'bottomLeft': {
      return {
        points: ['tl', 'bl'],
        offset: [0, 4],
        overflow,
      };
    }
    case 'bottomRight': {
      return {
        points: ['tr', 'br'],
        offset: [0, 4],
        overflow,
      };
    }
    case 'topLeft': {
      return {
        points: ['bl', 'tl'],
        offset: [0, -4],
        overflow,
      };
    }
    case 'topRight': {
      return {
        points: ['br', 'tr'],
        offset: [0, -4],
        overflow,
      };
    }
    default: {
      return direction === 'rtl'
        ? {
            points: ['tr', 'br'],
            offset: [0, 4],
            overflow,
          }
        : {
            points: ['tl', 'bl'],
            offset: [0, 4],
            overflow,
          };
    }
  }
};

export const getStatusClassNames = (prefixCls: string, status?: string) => {
  return classNames({
    [`${prefixCls}-status-success`]: status === 'success',
    [`${prefixCls}-status-warning`]: status === 'warning',
    [`${prefixCls}-status-error`]: status === 'error',
    [`${prefixCls}-status-validating`]: status === 'validating',
  });
};

export const getLocale = (lang: string): Partial<Locale> => {
  switch (lang.toLowerCase()) {
    case 'en':
    case 'en-us':
    case 'en-gb':
    case 'en-in':
      return DEFAULT_LOCALE_CONFIG.enGB;
    case 'fr':
    case 'fr-fr':
      return DEFAULT_LOCALE_CONFIG.fr;
    case 'it':
    case 'it-it':
      return DEFAULT_LOCALE_CONFIG.it;
    case 'de':
    case 'de-de':
      return DEFAULT_LOCALE_CONFIG.de;
    case 'es':
    case 'es-es':
    case 'es-us':
      return DEFAULT_LOCALE_CONFIG.es;
    default:
      return DEFAULT_LOCALE_CONFIG.enUS;
  }
};
