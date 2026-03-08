import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Checkbox from './Checkbox';
import { SizeStandard } from '../../declarations/size';
import performStandardTest, { performTest } from '../../helpers/performStandardTest';

describe('Checkbox component', () => {
  const checkboxProps = {
    onChange: () => {},
    checked: false,
    size: 'medium' as SizeStandard,
    'data-testid': 'tecma-checkbox',
  };

  performStandardTest(Checkbox, checkboxProps, checkboxProps['data-testid']);

  performTest({
    description: 'Should be disabled if disable prop is true',
    renderer: () => render(<Checkbox label='test' {...checkboxProps} disabled />),
    test: (element) => expect(element).toBeDisabled(),
    dataTestId: checkboxProps['data-testid'],
  });

  performTest({
    description: 'Should not perform the onClick event if the checkbox is disabled',
    renderer: () => render(<Checkbox label='test' {...checkboxProps} disabled />),
    test: async (element) => {
      const handleClick = userEvent.setup();
      handleClick.click(element);
      await waitFor(() => expect(element).not.toBeChecked());
    },
    dataTestId: checkboxProps['data-testid'],
  });

  performTest({
    description: 'Should be checked if checked prop is true',
    renderer: () => render(<Checkbox label='test' {...checkboxProps} checked />),
    test: (element) => expect(element).toBeChecked(),
    dataTestId: checkboxProps['data-testid'],
  });

  it('Should allow to define the checkbox size', () => {
    const { rerender } = render(<Checkbox label='test' {...checkboxProps} size='small' />);
    waitFor(() => {
      expect(screen.getByRole('checkbox').classList.contains('small')).toBeTruthy();
    });
    rerender(<Checkbox label='test' {...checkboxProps} size='medium' />);
    waitFor(() => {
      expect(screen.getByRole('checkbox').classList.contains('medium')).toBeTruthy();
    });
    rerender(<Checkbox label='test' {...checkboxProps} size='large' />);
    waitFor(() => {
      expect(screen.getByRole('checkbox').classList.contains('large')).toBeTruthy();
    });
  });
});
