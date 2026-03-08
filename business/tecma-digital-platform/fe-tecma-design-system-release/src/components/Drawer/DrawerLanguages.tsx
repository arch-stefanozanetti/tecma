import React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';
import { Icon } from '../Icon';
import DrawerItem from './DrawerItem';
import { AVAILABLE_LANGUAGES, AvailableLanguage, DEFAULT_LANGUAGE } from '../LanguageSelector/constants';
import { getCleanLanguages, getNormalizedCurrentLanguage, getOrderedLanguages } from '../LanguageSelector/utils';

// Required Props
interface DrawerLanguagesRequiredProps {
  currentLanguage: string;
  onChangeLanguage: (currLanguage: AvailableLanguage) => void;
}

// Optional Props
interface DrawerLanguagesOptionalProps extends DefaultProps {
  languages?: AvailableLanguage[];
}

// Combined required and optional props to build the full prop interface
export interface DrawerLanguagesProps extends DrawerLanguagesRequiredProps, DrawerLanguagesOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: DrawerLanguagesOptionalProps = {
  'data-testid': 'tecma-drawerLanguages',
  languages: ['en-GB', 'it-IT'],
};

const DrawerLanguages: React.FC<DrawerLanguagesProps> = ({
  currentLanguage = DEFAULT_LANGUAGE,
  languages,
  onChangeLanguage,
  className,
  ...rest
}) => {
  const classList = classNames('tecma-drawerLanguages', className);
  const cleanLanguages = getCleanLanguages(languages as string[]);
  const orderedLanguages = getOrderedLanguages(cleanLanguages, false);
  const normalizedCurrentLanguage = getNormalizedCurrentLanguage(currentLanguage, orderedLanguages);
  const handleOnChangeLanguage = (language: AvailableLanguage) => {
    onChangeLanguage(language);
  };

  return (
    <div className={classList} {...rest}>
      {orderedLanguages.map((language) => {
        const isSelected = normalizedCurrentLanguage === language;

        return (
          <DrawerItem
            label={AVAILABLE_LANGUAGES[language].language}
            description={AVAILABLE_LANGUAGES[language].region}
            className={`${isSelected ? 'selected' : ''}`}
            rightIcon={isSelected ? <Icon iconName='check-circle' filled size='medium' /> : undefined}
            onClick={() => handleOnChangeLanguage(language)}
          />
        );
      })}
    </div>
  );
};

DrawerLanguages.defaultProps = defaultProps as Partial<DrawerLanguagesOptionalProps>;

export default React.memo(DrawerLanguages);
