import React from 'react';

import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RadioButton, { RadioButtonProps } from '../components/RadioButton/RadioButton';
import performStandardTest, { performTest } from '../helpers/performStandardTest';

const defaultProps: RadioButtonProps = {
  'data-testid': 'tecma-radioButton',
  onChange: jest.fn(),
  label: 'Text',
};

describe('RadioButton Component', () => {
  performStandardTest(RadioButton, defaultProps, 'tecma-radioButton');

  performTest({
    description: 'Should run onChange action',
    renderer: () => render(<RadioButton {...defaultProps} />),
    test: async (element) => {
      const handleClick = userEvent.setup();
      handleClick.click(element);
      await waitFor(() => {
        expect(defaultProps.onChange).toHaveBeenCalled();
      });
    },
    dataTestId: defaultProps['data-testid'] as string,
  });

  performTest({
    description: 'Should be disable and not perform onChange event since disable prop is provided',
    renderer: () => render(<RadioButton {...defaultProps} disabled />),
    test: async (element) => {
      const handleClick = userEvent.setup();
      handleClick.click(element);
      await waitFor(() => {
        expect(defaultProps.onChange).not.toHaveBeenCalled();
        expect(element.classList.contains('disabled')).toBeTruthy();
      });
    },
    dataTestId: defaultProps['data-testid'] as string,
  });

  performTest({
    description: 'Should render the radio button radio-card',
    renderer: () => render(<RadioButton {...defaultProps} type='radio-card' />),
    test: (element) => expect(element.classList.contains('radio-card')).toBeTruthy(),
    dataTestId: defaultProps['data-testid'] as string,
  });
});
