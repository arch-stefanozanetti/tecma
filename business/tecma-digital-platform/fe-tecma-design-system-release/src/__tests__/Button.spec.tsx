import React from 'react';

import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from '../components/Button';
import { SizeExtended } from '../declarations/size';
import checkSizeProp from '../helpers/checkSizeProp';
import performStandardTest, { performTest } from '../helpers/performStandardTest';

describe('Button component', () => {
  const buttonProps = {
    text: 'Button',
    onClick: jest.fn(),
    size: 'small' as SizeExtended,
    'data-testid': 'tecma-button',
  };

  performStandardTest(Button, buttonProps, 'tecma-button');

  checkSizeProp(Button, buttonProps);

  performTest({
    description: 'Should run onClick action',
    renderer: () => render(<Button onClick={buttonProps.onClick}>{buttonProps.text}</Button>),
    test: async (element) => {
      const handleClick = userEvent.setup();
      handleClick.click(element);
      await waitFor(() => {
        expect(buttonProps.onClick).toHaveBeenCalled();
      });
    },
    dataTestId: buttonProps['data-testid'],
  });

  performTest({
    description: 'Should check if Button is type button',
    renderer: () => render(<Button onClick={buttonProps.onClick}>{buttonProps.text}</Button>),
    test: (element) => expect(element.getAttribute('type')).toBe('button'),
    dataTestId: buttonProps['data-testid'],
  });

  performTest({
    description: 'Should be disable and not perform onClick event since disable prop is provided',
    renderer: () =>
      render(
        <Button onClick={buttonProps.onClick} disabled>
          {buttonProps.text}
        </Button>,
      ),
    test: async (element) => {
      const handleClick = userEvent.setup();
      handleClick.click(element);
      await waitFor(() => {
        expect(buttonProps.onClick).not.toHaveBeenCalled();
        expect(element.classList.contains('disabled')).toBeTruthy();
      });
    },
    dataTestId: buttonProps['data-testid'],
  });

  performTest({
    description: 'Should render the button outlined',
    renderer: () =>
      render(
        <Button onClick={buttonProps.onClick} outlined>
          {buttonProps.text}
        </Button>,
      ),
    test: (element) => expect(element.classList.contains('outlined')).toBeTruthy(),
    dataTestId: buttonProps['data-testid'],
  });

  performTest({
    description: 'Should render the secondary button if secondary prop is provided',
    renderer: () =>
      render(
        <Button onClick={buttonProps.onClick} color='secondary'>
          {buttonProps.text}
        </Button>,
      ),
    test: (element) => expect(element.classList.contains('secondary')).toBeTruthy(),
    dataTestId: buttonProps['data-testid'],
  });
});
