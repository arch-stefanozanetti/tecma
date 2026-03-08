import React, { memo } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { LanguageSelector } from '../LanguageSelector';
import { DEFAULT_LANGUAGE } from '../LanguageSelector/constants';

import type { LanguageSelectorProps } from '../LanguageSelector/LanguageSelector';

interface HeaderLanguageSelectorRequiredProps {}
interface HeaderLanguageSelectorOptionalProps extends DefaultProps {}

export interface HeaderLanguageSelectorProps
  extends HeaderLanguageSelectorRequiredProps,
    HeaderLanguageSelectorOptionalProps,
    LanguageSelectorProps {}

const defaultProps: HeaderLanguageSelectorProps = {
  'data-testid': 'tecma-header-language-selector',
  onChangeLanguage: () => {},
  currentLanguage: DEFAULT_LANGUAGE,
};

const HeaderLanguageSelector: React.FC<HeaderLanguageSelectorProps> = ({
  className,
  style,
  onChangeLanguage,
  currentLanguage,
  languages,
  ...rest
}) => {
  const classList = classNames('tecma-header-language-selector', className);
  return (
    <LanguageSelector
      className={classList}
      transparent
      onChangeLanguage={onChangeLanguage}
      currentLanguage={currentLanguage}
      languages={languages}
      triggerIcon='translate'
      position={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      {...rest}
    />
  );
};

HeaderLanguageSelector.defaultProps = defaultProps as Partial<HeaderLanguageSelectorProps>;

export default memo(HeaderLanguageSelector);
