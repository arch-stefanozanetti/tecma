import React from 'react';

import { render } from '@testing-library/react';

import PhoneInput from '../components/PhoneInput/PhoneInput';
import { Locales } from '../constants/locales';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-phoneInput',
  currentLanguage: 'it' as Locales,
  onChange: jest.fn(),
  selectedCountry: { label: 'Italia +39', value: 'IT' },
  onChangeCountry: jest.fn(),
};

describe('PhoneInput Component', () => {
  performStandardTest(PhoneInput, defaultProps, 'tecma-phoneInput');

  it('should render a Select and a Input component', () => {
    const { getByTestId } = render(<PhoneInput {...defaultProps} />);
    const selectComponent = getByTestId('tecma-phoneInput').querySelector('.tecma-select');
    const inputComponent = getByTestId('tecma-phoneInput').querySelector('.tecma-input');

    expect(selectComponent).toBeInTheDocument();
    expect(inputComponent).toBeInTheDocument();
  });

  const testCases = [
    {
      currentLanguage: 'en' as Locales,
      expectedCountryLabel: 'Italy +39',
    },
    {
      currentLanguage: 'it' as Locales,
      expectedCountryLabel: 'Italia +39',
    },
  ];

  testCases.forEach(({ currentLanguage, expectedCountryLabel }) => {
    it(`should translate country based on provided currentLanguage (${currentLanguage})`, () => {
      // Render the PhoneInput component with the specified currentLanguage and defaultCountry
      const { getByTestId } = render(<PhoneInput {...defaultProps} currentLanguage={currentLanguage} />);

      // Get the select element from the rendered component
      const selectElement = getByTestId('tecma-phoneInput').querySelector('.select__single-value');

      // Assert that the translated country label matches the expected value
      expect(selectElement?.textContent).toBe(expectedCountryLabel);
    });
  });
});
