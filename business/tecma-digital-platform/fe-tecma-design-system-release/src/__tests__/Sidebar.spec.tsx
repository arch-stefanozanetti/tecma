import React from 'react';

import { render } from '@testing-library/react';

import { Sidebar } from '../components/Sidebar/Sidebar';
import performStandardTest, { performTest } from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-sidebar',
  position: 'right',
  isOpen: true,
  onToggle: () => {},
};

describe('Sidebar Component', () => {
  performStandardTest(Sidebar, defaultProps, 'tecma-sidebar');

  performTest({
    description: 'Should render sidebar on the right',
    renderer: () => render(<Sidebar isOpen onToggle={() => {}} position='right' />),
    test: (element) => expect(element.classList.contains('tecma-sidebar-right')).toBeTruthy(),
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'Should render sidebar on the left',
    renderer: () => render(<Sidebar isOpen onToggle={() => {}} position='left' />),
    test: (element) => expect(element.classList.contains('tecma-sidebar-left')).toBeTruthy(),
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'Should render sidebar on the top',
    renderer: () => render(<Sidebar isOpen onToggle={() => {}} position='top' />),
    test: (element) => expect(element.classList.contains('tecma-sidebar-top')).toBeTruthy(),
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'Should render sidebar on the bottom',
    renderer: () => render(<Sidebar isOpen onToggle={() => {}} position='bottom' />),
    test: (element) => expect(element.classList.contains('tecma-sidebar-bottom')).toBeTruthy(),
    dataTestId: defaultProps['data-testid'],
  });
});
