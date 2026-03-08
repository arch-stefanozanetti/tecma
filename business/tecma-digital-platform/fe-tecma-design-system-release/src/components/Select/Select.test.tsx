import React from 'react';

import { render, screen } from '@testing-library/react';

import { Select } from '.';
import { SelectProps } from './Select';

const defaultProps: SelectProps = {
  dataTestId: 'tecma-select',
  onChange: jest.fn(),
  value: [],
  options: [
    { value: 'user', label: 'Chrome', icon: 'chrome' },
    { value: 'user1', label: 'Safari', icon: 'safari' },
    { value: 'user2', label: 'Edge', icon: 'microsoft-edge' },
    { value: 'user3', label: 'Firefox', icon: 'firefox' },
    { value: 'user5', label: 'Non lo so' },
  ],
};

describe('Select', () => {
  it('should render a date range picker component with default props and styles', () => {
    render(<Select {...defaultProps} />);
    expect(screen.getByTestId(defaultProps.dataTestId as string)).toMatchSnapshot();
  });

  it('test dropdown indicator returns correct component', () => {
    const props = {
      selectProps: { menuIsOpen: false, isLoading: false },
      ...defaultProps,
    };
    const { container } = render(<Select {...props} />);
    expect(container.querySelector('.dropdownIndicator')).toBeInTheDocument();
    expect(container.querySelector('.isOpen')).not.toBeInTheDocument();
  });
});
