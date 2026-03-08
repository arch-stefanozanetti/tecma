import React from 'react';

import { render } from '@testing-library/react';

import LazyImage from '../components/LazyImage/LazyImage';
import { DefaultProps } from '../declarations/defaultProps';
import performStandardTest, { performTest } from '../helpers/performStandardTest';
import { MockImageError, MockImageLoad, MockImageSuccess } from '../mock/Image';

const defaultProps: DefaultProps = {
  'data-testid': 'tecma-lazyImage',
};

describe('LazyImage.Background Component', () => {
  performStandardTest(LazyImage.Background, defaultProps, 'tecma-lazyImage');

  performTest({
    description: 'Should render a loading element',
    renderer: () => render(<LazyImage.Background src='/test/url.png' />),
    test: (element) => expect(element).toMatchSnapshot(),
    dataTestId: 'tecma-lazyImage',
    before: () => {
      global.Image = MockImageLoad as jest.Mock;
    },
  });

  performTest({
    description: 'Should render a div with background-image rule',
    renderer: () => render(<LazyImage.Background src='/test/url.png' />),
    test: (element) => {
      expect(element).not.toBeNull();
      expect(element.children.length).toBe(0);
      expect(element).toMatchSnapshot();
    },
    dataTestId: 'tecma-lazyImage',
    before: () => {
      global.Image = MockImageSuccess as jest.Mock;
    },
  });

  performTest({
    description: 'Should render a div with error fallback',
    renderer: () => render(<LazyImage.Background src='/test/url.png' />),
    test: (element) => {
      expect(element).not.toBeNull();
      expect((console.error as jest.Mock).mock.calls.length).toBe(1);
      expect(element.innerHTML.trim()).toEqual('Error');
      expect(element).toMatchSnapshot();
    },
    dataTestId: 'tecma-lazyImage',

    before: () => {
      global.Image = MockImageError as jest.Mock;
      jest.spyOn(global.console, 'error').mockImplementation(() => {});
    },
  });
});

describe('LazyImage.Image Component', () => {
  performStandardTest(LazyImage.Image, defaultProps, 'tecma-lazyImage');

  performTest({
    description: 'Should render a loading element',
    renderer: () => render(<LazyImage.Image src='/test/url.png' />),
    test: (element) => expect(element).toMatchSnapshot(),
    dataTestId: 'tecma-lazyImage',
    before: () => {
      global.Image = MockImageLoad as jest.Mock;
    },
  });

  performTest({
    description: 'Should render a div with src rule',
    renderer: () => render(<LazyImage.Image src='/test/url.png' />),
    test: (element) => {
      expect(element).not.toBeNull();
      expect(element.children.length).toBe(0);
      expect(element).toMatchSnapshot();
    },
    dataTestId: 'tecma-lazyImage',
    before: () => {
      global.Image = MockImageSuccess as jest.Mock;
    },
  });

  performTest({
    description: 'Should render a div with error fallback',
    renderer: () => render(<LazyImage.Image src='/test/url.png' />),
    test: (element) => {
      expect(element).not.toBeNull();
      expect((console.error as jest.Mock).mock.calls.length).toBe(1);
      expect(element.innerHTML.trim()).toEqual('Error');
      expect(element).toMatchSnapshot();
    },
    dataTestId: 'tecma-lazyImage',
    before: () => {
      global.Image = MockImageError as jest.Mock;
      jest.spyOn(global.console, 'error').mockImplementation(() => {});
    },
  });
});
