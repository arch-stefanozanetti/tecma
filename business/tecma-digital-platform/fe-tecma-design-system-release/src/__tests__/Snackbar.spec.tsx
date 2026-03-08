import React from 'react';

import { render } from '@testing-library/react';

import Snackbar from '../components/Snackbar/Snackbar';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-snackbar',
  open: true,
  handleClose: jest.fn(),
};
describe('Snackbar', () => {
  performStandardTest(Snackbar, defaultProps, 'tecma-snackbar');

  it('renders without crashing', () => {
    const { getByTestId } = render(<Snackbar open handleClose={jest.fn()} />);
    expect(getByTestId('tecma-snackbar')).toBeInTheDocument();
  });

  it('displays the provided title', () => {
    const { getByText } = render(<Snackbar open handleClose={jest.fn()} title='Test Title' />);
    expect(getByText('Test Title')).toBeInTheDocument();
  });
});
