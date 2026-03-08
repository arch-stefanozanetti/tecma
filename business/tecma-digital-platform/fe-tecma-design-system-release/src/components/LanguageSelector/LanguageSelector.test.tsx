import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { LanguageSelector } from '.';
import { AVAILABLE_LANGUAGES, AvailableLanguage } from './constants';

const defaultProps = {
  currentLanguage: 'en-GB',
  dataTestId: 'tecma-languageSelector',
  onChangeLanguage: jest.fn(),
};

describe('LanguageSelector', () => {
  it('should render LanguageSelector component with default props and styles', () => {
    render(<LanguageSelector {...defaultProps} />);
    expect(screen.getByTestId(`${defaultProps.dataTestId}-button`)).toMatchSnapshot();
  });
  // Renders a button with a globe icon and the current language displayed.
  it('should render a button with the current language and a globe icon', () => {
    const currentLanguage: AvailableLanguage = 'en-US';
    const englishLanguageLabel = AVAILABLE_LANGUAGES[currentLanguage].language;
    render(<LanguageSelector {...defaultProps} currentLanguage={currentLanguage} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText(englishLanguageLabel)).toBeInTheDocument();
    expect(screen.getByTestId('tecma-languageSelector-button')).toContainElement(screen.getByLabelText('globe-alt'));
  });

  // Clicking the button opens a menu with a  default list of available languages if not provided by client.
  it('should open a menu with a list of default available languages passed by props when the button is clicked', () => {
    // Arrange
    const currentLanguage: AvailableLanguage = 'en-US';

    render(<LanguageSelector {...defaultProps} currentLanguage={currentLanguage} />);

    // Act
    fireEvent.click(screen.getByRole('button'));

    // Assert
    expect(screen.getByTestId(`${defaultProps.dataTestId}-dropdown`)).toBeInTheDocument();
    expect(screen.getAllByTestId('tecma-dropDown-item')).toHaveLength(2);
  });

  // Clicking the button opens a menu with a list of available languages.
  it('should open a menu with a list of available languages passed by props when the button is clicked', () => {
    // Arrange
    const currentLanguage: AvailableLanguage = 'en-US';
    const languages: AvailableLanguage[] = ['en-US', 'es-ES', 'fr-FR'];

    render(<LanguageSelector {...defaultProps} currentLanguage={currentLanguage} languages={languages} />);

    // Act
    fireEvent.click(screen.getByRole('button'));

    // Assert
    expect(screen.getByTestId(`${defaultProps.dataTestId}-dropdown`)).toBeInTheDocument();
    expect(screen.getAllByTestId('tecma-dropDown-item')).toHaveLength(languages.length);
  });

  // Selecting a language from the menu updates the current language displayed and calls the onChangeLanguage callback.
  it('should update the current language and call the onChangeLanguage callback when a language is selected from the menu', () => {
    // Arrange
    const currentLanguage: AvailableLanguage = 'en-US';
    const languages: AvailableLanguage[] = ['en-US', 'es-ES', 'fr-FR'];
    const newLanguage: AvailableLanguage = 'es-ES';
    const spanishLanguageLabel = AVAILABLE_LANGUAGES[newLanguage].language;

    render(<LanguageSelector {...defaultProps} currentLanguage={currentLanguage} languages={languages} />);

    fireEvent.click(screen.getByRole('button'));

    // Act
    fireEvent.click(screen.getByText(spanishLanguageLabel));

    // Assert
    expect(defaultProps.onChangeLanguage).toHaveBeenCalledWith(newLanguage);
    expect(defaultProps.onChangeLanguage.mock.calls[0][0]).toBe(newLanguage);
  });

  // When no languages are provided, the component renders with only the default language.
  it('should render with only the default language when no languages are provided', () => {
    // Arrange
    const currentLanguage: AvailableLanguage = 'en-US';
    const englishLanguageLabel = AVAILABLE_LANGUAGES[currentLanguage].language;
    const spanishLanguageLabel = AVAILABLE_LANGUAGES['es-ES'].language;

    render(<LanguageSelector {...defaultProps} currentLanguage={currentLanguage} />);

    // Assert
    expect(screen.getByText(englishLanguageLabel)).toBeInTheDocument();
    expect(screen.queryByText(spanishLanguageLabel)).not.toBeInTheDocument();
  });

  // When the current language is not in the list of available languages, the component falls back to the default language.
  it('should fall back to the default language when the current language is not in the list of available languages', () => {
    // Arrange
    const currentLanguage = 'fr-CA';
    const defaultLanguageLabel = AVAILABLE_LANGUAGES['en-GB'].language;

    render(<LanguageSelector {...defaultProps} currentLanguage={currentLanguage} />);

    // Assert
    expect(screen.queryByText('Français')).not.toBeInTheDocument();
    expect(screen.getByText(defaultLanguageLabel)).toBeInTheDocument();
  });

  // When the current language is not a valid language code, the component falls back to the default language.
  it('should fall back to the default language when the current language is not a valid language code', () => {
    // Arrange

    const defaultLanguageLabel = AVAILABLE_LANGUAGES['en-GB'].language;
    const currentLanguage = 'invalid-language';

    render(<LanguageSelector {...defaultProps} currentLanguage={currentLanguage} />);

    // Assert
    expect(screen.queryByText('Invalid Language')).not.toBeInTheDocument();
    expect(screen.getByText(defaultLanguageLabel)).toBeInTheDocument();
  });
});
