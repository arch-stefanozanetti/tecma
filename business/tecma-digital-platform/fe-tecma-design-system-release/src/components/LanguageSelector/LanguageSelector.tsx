import React, { useState, useRef } from 'react';

import { PopoverOrigin } from '@mui/material';
import classNames from 'classnames';

import { Button } from '../Button';
import { DropDown } from '../DropDown';
import { Icon } from '../Icon';
import { AVAILABLE_LANGUAGES, AvailableLanguage, DEFAULT_LANGUAGE } from './constants';
import { getCleanLanguages, getNormalizedCurrentLanguage, getOrderedLanguages } from './utils';

import type { DefaultProps } from '../../declarations';
import type { IconName } from '../Icon/IconName';

import '../../styles/language-selector.scss';

// Required Props
interface LanguageSelectorRequiredProps {
  currentLanguage: string;
  onChangeLanguage: (currLanguage: AvailableLanguage) => void;
}

// Optional Props
interface LanguageSelectorOptionalProps extends DefaultProps {
  languages?: AvailableLanguage[];
  dataTestId?: string;
  // The dropDown position
  position?: PopoverOrigin;
  rotated?: boolean;
  transparent?: boolean;
  // If true, the dropdown is open
  isOpen?: boolean;
  // TrasformOrigin: see PopOver
  transformOrigin?: PopoverOrigin;
  triggerIcon?: IconName;
}

// Combined required and optional props to build the full prop interface
export interface LanguageSelectorProps extends LanguageSelectorRequiredProps, LanguageSelectorOptionalProps {}

const defaultProps: LanguageSelectorProps = {
  currentLanguage: DEFAULT_LANGUAGE,
  transparent: false,
  rotated: false,
  onChangeLanguage: () => {},
  isOpen: false,
  position: { vertical: 'bottom', horizontal: 'center' },
  transformOrigin: { vertical: 'top', horizontal: 'center' },
  triggerIcon: 'globe-alt',
};

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  transparent,
  languages = ['en-GB', 'it-IT'],
  dataTestId = 'tecma-languageSelector',
  currentLanguage = DEFAULT_LANGUAGE,
  rotated = false,
  position,
  transformOrigin,
  onChangeLanguage = () => {},
  isOpen,
  triggerIcon = 'globe-alt',
  className,
  ...rest
}) => {
  const openingDirection = () => {
    if ((position?.vertical as string) === 'top' && (transformOrigin?.vertical as string) === 'bottom') {
      return 'open-upwards';
    }
    return 'open-downwards';
  };

  const classList = classNames(
    'language-selector-dropdown',
    {
      rotated,
      [openingDirection()]: true,
    },
    className,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isDropDownOpen, setIsDropDownOpen] = useState<boolean>(isOpen || false);
  const triggerClassList = classNames('language-selector', { open: isDropDownOpen });
  const cleanLanguages = getCleanLanguages(languages as string[]);
  const orderedLanguages = getOrderedLanguages(cleanLanguages, rotated);
  const normalizedCurrentLanguage = getNormalizedCurrentLanguage(currentLanguage, orderedLanguages);

  const handleOnChangeLanguage = (language: AvailableLanguage) => {
    setIsDropDownOpen(false);
    onChangeLanguage(language);
  };

  return (
    <DropDown
      className={classList}
      isOpen={isDropDownOpen}
      transformOrigin={
        rotated
          ? ({
              ...transformOrigin,
              vertical: transformOrigin?.vertical === 'bottom' ? 'top' : 'bottom',
            } as PopoverOrigin)
          : transformOrigin
      }
      trigger={
        <Button
          className={triggerClassList}
          id='language-selector-button'
          aria-controls={isDropDownOpen ? 'language-selector-menu' : undefined}
          aria-haspopup='true'
          aria-expanded={isDropDownOpen ? 'true' : undefined}
          onClick={() => setIsDropDownOpen(!isDropDownOpen)}
          outlined={transparent}
          iconName={triggerIcon}
          data-testid={`${dataTestId}-button`}
          ref={triggerRef}
        >
          {AVAILABLE_LANGUAGES[normalizedCurrentLanguage].language}
          <Icon iconName='chevron-down' className={`language-selector__chevron ${isDropDownOpen ? 'open' : ''} `} />
        </Button>
      }
      data-testid={`${dataTestId}-dropdown`}
      position={
        rotated
          ? ({
              ...position,
              vertical: position?.vertical === 'bottom' ? 'top' : 'bottom',
            } as PopoverOrigin)
          : position
      }
      onToggle={() => setIsDropDownOpen(!isDropDownOpen)}
      {...rest}
    >
      {orderedLanguages.map((language) => {
        const isSelected = normalizedCurrentLanguage === language;
        return (
          <DropDown.Item key={language} className={`${isSelected ? 'selected' : ''}`} onClick={() => handleOnChangeLanguage(language)}>
            <div className='language-selector__wrapper'>
              <span className='language-selector__wrapper__language'>{AVAILABLE_LANGUAGES[language].language}</span>
              <span className='language-selector__wrapper__region'>{AVAILABLE_LANGUAGES[language].region}</span>
            </div>
            <Icon size='small' className={`language-selector__icon ${isSelected ? 'selected' : ''}`} filled iconName='check-circle' />
          </DropDown.Item>
        );
      })}
    </DropDown>
  );
};

LanguageSelector.defaultProps = defaultProps as Partial<LanguageSelectorProps>;

export default LanguageSelector;
