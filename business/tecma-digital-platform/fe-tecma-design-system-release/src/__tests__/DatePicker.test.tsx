import React from 'react';

import { render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';

import DatePicker from '../components/DatePicker/DatePicker';

const defaultProps = {
  localeLang: 'en-GB',
  dataTestId: 'tecma-datePicker',
};

describe('generateRangePicker', () => {
  // Renders a date range picker component with default props and styles
  it('should render a date range picker component with default props and styles', () => {
    render(<DatePicker {...defaultProps} />);
    expect(screen.getByTestId(defaultProps.dataTestId)).toMatchSnapshot();
  });

  // Allows setting a label for the date range picker
  it('should display two dates values in input text fields', () => {
    const startDate = DateTime.now();
    const endDate = DateTime.now().plus({ day: 1 });
    render(<DatePicker {...defaultProps} value={[startDate, endDate]} />);
    expect(screen.getByDisplayValue(startDate.toFormat('MMM dd yyyy'))).toBeInTheDocument();
    expect(screen.getByDisplayValue(endDate.toFormat('MMM dd yyyy'))).toBeInTheDocument();
  });

  // Allows setting a label for the date range picker
  it('should allow setting a label for the date range picker', () => {
    const label = 'Date Range';
    render(<DatePicker {...defaultProps} label={label} />);
    const labelElement = screen.getByText(label);
    expect(labelElement).toBeInTheDocument();
    expect(labelElement).toHaveTextContent(label);
  });
});
