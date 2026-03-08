import React from 'react';

import { render, screen } from '@testing-library/react';

import { Card } from '../components/Card';
import CardContent from '../components/Card/CardContent';
import CardFooter from '../components/Card/CardFooter';
import CardHeader from '../components/Card/CardHeader';
import CardMedia from '../components/Card/CardMedia';
import performStandardTest, { performTest } from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-card',
};

describe('Card Component', () => {
  performStandardTest(Card, defaultProps, 'tecma-card');
  performTest({
    description: 'Should render an horizontal card',
    renderer: () => render(<Card orientation='horizontal' selected />),
    test: () => {
      expect(screen.getByTestId('tecma-card').classList.contains('horizontal')).toBeTruthy();
      expect(screen.getByTestId('tecma-card').classList.contains('selected')).toBeTruthy();
    },
    dataTestId: 'tecma-card',
  });

  describe('CardMedia component', () => {
    performStandardTest(CardMedia, { 'data-testid': 'tecma-card-media' }, 'tecma-card-media');
  });

  describe('CardHeader component', () => {
    performStandardTest(CardHeader, { 'data-testid': 'tecma-card-header' }, 'tecma-card-header');
  });

  describe('CardContent component', () => {
    performStandardTest(CardContent, { 'data-testid': 'tecma-card-content' }, 'tecma-card-content');
  });

  describe('CardFooter component', () => {
    performStandardTest(CardFooter, { 'data-testid': 'tecma-card-footer' }, 'tecma-card-footer');
  });
});
