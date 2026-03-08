import React from 'react';

import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ValuePicker from '../components/ValuePicker/ValuePicker';
import performStandardTest, { performTest } from '../helpers/performStandardTest';

const stringOptions = [
  { value: 'bilo', label: 'Bilocale' },
  { value: 'trilo', label: 'Trilocale' },
  { value: 'quadri', label: 'Quadrilocale' },
];
const defaultProps = {
  'data-testid': 'tecma-valuePicker',
  options: stringOptions,
  onChange: jest.fn(),
  value: stringOptions[0].value,
};

describe('ValuePicker Component', () => {
  performStandardTest(ValuePicker, defaultProps, 'tecma-valuePicker');

  // FIXME
  performTest({
    description: 'Should run prevOnClick action',
    renderer: () => render(<ValuePicker {...defaultProps} />),
    test: async (element) => {
      const handleClick = userEvent.setup();
      handleClick.click(element);
      await waitFor(() => {
        expect(defaultProps.onChange).toHaveBeenCalled();
      });
    },
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'Should render value picker outlined',
    renderer: () => render(<ValuePicker {...defaultProps} outlined />),
    test: (element) => expect(element.classList.contains('outlined')).toBeTruthy(),
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'Should render value picker placeholder',
    renderer: () => render(<ValuePicker {...defaultProps} value={null} placeholder='Placeholder' />),
    test: (element) => expect(element.children[1].classList.contains('disabled')).toBeTruthy(),
    dataTestId: defaultProps['data-testid'],
  });
});
