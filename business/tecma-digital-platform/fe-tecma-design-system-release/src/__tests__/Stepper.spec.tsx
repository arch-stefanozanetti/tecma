import React from 'react';

import { render } from '@testing-library/react';

import Stepper from '../components/Stepper/Stepper';
import performStandardTest, { performTest } from '../helpers/performStandardTest';

const steps = [
  { title: 'first step', content: 'first step content' },
  { title: 'second step', content: 'second step content' },
  { title: 'third step', content: 'third step content' },
];

const defaultProps = {
  'data-testid': 'tecma-stepper',
};

describe('Stepper Component', () => {
  performStandardTest(Stepper, defaultProps, 'tecma-stepper');

  performTest({
    description: 'Should render a vertical stepper',
    renderer: () => render(<Stepper orientation='vertical' steps={steps} activeStep={1} />),
    test: (element) => expect(element.classList.contains('vertical')).toBeTruthy(),
    dataTestId: defaultProps['data-testid'],
  });
});
