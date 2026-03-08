import React from 'react';

import { render, screen } from '@testing-library/react';

import { DropDown } from '../components/DropDown';
import DropDownDivider from '../components/DropDown/DropDownDivider';
import DropDownItem from '../components/DropDown/DropDownItem';
import performStandardTest, { performTest } from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-DropDown',
  isOpen: true,
};

describe('DropDown Component', () => {
  performStandardTest(DropDown, defaultProps, 'tecma-dropDown');

  describe('DropDownItem component', () => {
    performStandardTest(DropDownItem, { 'data-testid': 'tecma-dropDown-button' }, 'tecma-dropDown-button');

    performTest({
      description: 'should render a li element which include a button element',
      renderer: () => render(<DropDownItem onClick={jest.fn()}>foo</DropDownItem>),
      test: () => {
        expect(screen.getByRole('listitem')).toBeTruthy();
        expect(screen.getByRole('button')).toBeTruthy();
      },
      dataTestId: 'tecma-dropDown-button',
    });
  });

  describe('DropDownDivider component', () => {
    performStandardTest(DropDownDivider, { 'data-testid': 'tecma-dropDown-divider' }, 'tecma-dropDown-divider');
  });

  describe('DropDownLink component', () => {
    performStandardTest(DropDownDivider, { 'data-testid': 'tecma-dropDown-link' }, 'tecma-dropDown-link');
  });
});
