import React from 'react';

import { render } from '@testing-library/react';

import Divider from '../components/Divider/Divider';
import performStandardTest, { performTest } from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-divider',
};

describe('Divider Component', () => {
  performStandardTest(Divider, defaultProps, 'tecma-divider');

  performTest({
    description: 'Should render the divider vertically',
    renderer: () => render(<Divider type='vertical' />),
    test: (element) => expect(element.classList.contains('outlined')).toBeTruthy(),
    dataTestId: defaultProps['data-testid'],
  });
});
