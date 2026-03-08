import React from 'react';

import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetchArrow } from '../components/Icon/mock/mockFetchIcon';
import Input from '../components/Input/Input';
import checkSizeProp from '../helpers/checkSizeProp';
import performStandardTest, { performTest } from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-input',
};

describe('Input Component', () => {
  performStandardTest(Input, defaultProps, 'tecma-input');
  checkSizeProp(Input, defaultProps);

  performTest({
    description: 'Should update value on onChange',
    renderer: () => render(<Input onChange={() => {}} />),
    test: async (element) => {
      const input = element.getElementsByTagName('input')[0];
      const handleType = userEvent.setup();
      handleType.type(input, 'text');

      await waitFor(() => {
        expect(input.value).toBe('text');
      });
    },
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'Should be disabled since disabled props is provided',
    renderer: () => render(<Input disabled onChange={() => {}} />),
    test: (element) => {
      expect(element.getElementsByTagName('input')[0]).toBeDisabled();
    },
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'Should check if input is of type password',
    renderer: () => render(<Input onChange={() => {}} type='password' />),
    test: (element) => {
      expect(element.getElementsByTagName('input')[0].type).toBe('password');
    },
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'Should check if input is of type text',
    renderer: () => render(<Input onChange={() => {}} type='text' />),
    test: (element) => {
      expect(element.getElementsByTagName('input')[0].type).toBe('text');
    },
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'Should check if input is of type number',
    renderer: () => render(<Input onChange={() => {}} type='number' />),
    test: (element) => {
      expect(element.getElementsByTagName('input')[0].type).toBe('number');
    },
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'Should have maximum number of characters set to 5',
    renderer: () => render(<Input onChange={() => {}} maxLength={5} />),
    test: (element) => {
      expect(element.getElementsByTagName('input')[0].maxLength).toBe(5);
    },
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'Should have an icon which toggle the input type password/text onClick, only if initial type is password',
    renderer: () => render(<Input onChange={() => {}} type='password' />),
    test: async (element) => {
      const handleTogglePassword = userEvent.setup();
      const icon = element.getElementsByTagName('svg')[0];
      handleTogglePassword.click(icon);
      await waitFor(() => {
        expect(element.getElementsByTagName('input')[0].type).toBe('text');
      });
    },
    dataTestId: defaultProps['data-testid'],
    fetchMockImplementation: mockFetchArrow as jest.Mock,
  });

  performTest({
    description: 'Should have a label with help text if status is warning or error and helpText is provided',
    renderer: () => render(<Input onChange={() => {}} status='error' helpText='Error' />),
    test: (element) => {
      const helpTextLabel = element.querySelector('.help-text');
      expect(helpTextLabel).toBeInTheDocument();
    },
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'Should have a label if provided',
    renderer: () => render(<Input onChange={() => {}} label='Label' />),
    test: (element) => {
      const label = element.querySelector('.input-label');
      expect(label).toBeInTheDocument();
    },
    dataTestId: defaultProps['data-testid'],
  });
});
