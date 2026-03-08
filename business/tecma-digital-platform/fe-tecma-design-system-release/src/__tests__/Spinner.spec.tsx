import React from 'react';

import { render } from '@testing-library/react';

import Spinner from '../components/Spinner/Spinner';
import checkSizeProp from '../helpers/checkSizeProp';
import performStandardTest, { performTest } from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-spinner',
};

describe('Spinner Component', () => {
  performStandardTest(Spinner, defaultProps, 'tecma-spinner');
  checkSizeProp(Spinner, defaultProps);

  performTest({
    description: 'Should render the gradient spinner if gradient prop is provided',
    renderer: () => render(<Spinner gradient />),
    test: (element) => expect(element.classList.contains('gradient')).toBeTruthy(),
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'should show three dot if type is dotted',
    renderer: () => render(<Spinner type='dotted' />),
    test: (element) => expect(element.classList.contains('dotted')).toBeTruthy(),
    dataTestId: defaultProps['data-testid'],
  });
});
