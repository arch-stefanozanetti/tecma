import React from 'react';

import { act, cleanup, render, RenderResult, screen } from '@testing-library/react';

import Carousel, { CarouselProps } from '../components/Carousel/Carousel';
import LazyImage from '../components/LazyImage/LazyImage';
import performStandardTest from '../helpers/performStandardTest';
import { MockImageSuccess } from '../mock/Image';

const imagesChildren = [
  <LazyImage.Image key='0' src='/test/url.png' alt='Test 0' />,
  <LazyImage.Image key='1' src='/test/url.png' alt='Test 1' />,
  <LazyImage.Image key='2' src='/test/url.png' alt='Test 2' />,
  <LazyImage.Image key='3' src='/test/url.png' alt='Test 3' />,
];

let renderResult: RenderResult;

const defaultProps = {
  'data-testid': 'tecma-carousel',
  children: imagesChildren,
  selectedItemIndex: 0,
};

const renderComponent = async (props: Partial<CarouselProps>) => {
  const mergedProps = {
    ...defaultProps,
    ...props,
  };
  await act(async () => {
    renderResult = render(<Carousel {...mergedProps} />);
  });
};

describe('Perform standard test Carousel Component', () => {
  performStandardTest(Carousel, defaultProps, 'tecma-carousel');
});

describe('Carousel Component class logic', () => {
  beforeAll(() => {
    global.Image = MockImageSuccess as jest.Mock;
  });
  describe('Carousel Component selected item from props', () => {
    beforeEach(async () => {
      await renderComponent({
        selectedItemIndex: 2,
      });
    });
    it('Should set active class to selectItem as 2', () => {
      const elementSelected = renderResult.getByAltText('Test 2');
      expect(elementSelected?.parentElement).toHaveClass('selected');
    });
    it('Should set previous class to item before selectItem item', () => {
      const elementSelected = renderResult.getByAltText('Test 1');
      expect(elementSelected?.parentElement).toHaveClass('previous');
    });
    it('Should set next class to item after selectItem item', () => {
      const elementSelected = renderResult.getByAltText('Test 3');
      expect(elementSelected?.parentElement).toHaveClass('next');
    });
    afterEach(() => {
      cleanup();
    });
  });

  describe('Change selectItem', () => {
    beforeEach(async () => {
      await renderComponent({ selectedItemIndex: 0 });
    });

    it('Should check that selectItem is correct', async () => {
      const controlPagination1 = renderResult.getByLabelText('image item 1');
      const controlPagination2 = renderResult.getByLabelText('image item 2');
      expect(controlPagination1).toHaveClass('selected');
      expect(controlPagination2).not.toHaveClass('selected');
      expect(screen.getByAltText('Test 0').parentElement).toHaveClass('selected');
      expect(screen.getByAltText('Test 1').parentElement).toHaveClass('next');
      await act(async () => {
        await renderResult.rerender(<Carousel {...defaultProps} selectedItemIndex={1} />);
      });
      const newControlPagination1 = renderResult.getByLabelText('image item 1');
      const newControlPagination2 = renderResult.getByLabelText('image item 2');
      expect(newControlPagination1).not.toHaveClass('selected');
      expect(newControlPagination2).toHaveClass('selected');
      expect(screen.getByAltText('Test 0').parentElement).toHaveClass('previous');
      expect(screen.getByAltText('Test 1').parentElement).toHaveClass('selected');
    });
    afterEach(() => {
      cleanup();
    });
  });
});
