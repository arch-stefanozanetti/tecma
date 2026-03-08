import React from 'react';

import { render } from '@testing-library/react';

import { Avatar } from '../components/Avatar';
import { mockFetchArrow } from '../components/Icon/mock/mockFetchIcon';
import checkSizeProp from '../helpers/checkSizeProp';
import performStandardTest, { performTest } from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-avatar',
};
const mockImgElement = async () =>
  `<img class="tecma-lazyImage" data-testid="tecma-lazyImage" src="https://joeschmoe.io/api/v1/random" alt="ico">`;

describe('Avatar Component', () => {
  performStandardTest(Avatar, defaultProps, 'tecma-avatar');
  checkSizeProp(Avatar, defaultProps);

  performTest({
    description: 'Should render with the text inside if the text prop is provided',
    renderer: () => render(<Avatar text='test' />),
    test: (element) => {
      expect(element.children[0].textContent).toEqual('test');
    },
    dataTestId: defaultProps['data-testid'],
  });

  performTest({
    description: 'Should render with the icon component inside if the icon prop is provided',
    renderer: () => render(<Avatar icon='key' />),
    test: (element) => {
      expect(element).toMatchSnapshot();
    },
    dataTestId: defaultProps['data-testid'],
    fetchMockImplementation: mockFetchArrow as jest.Mock,
  });

  performTest({
    description: 'Should render with the image inside if the src prop is provided',
    renderer: () => render(<Avatar src='https://joeschmoe.io/api/v1/random' />),
    test: (element) => {
      expect(element).toMatchSnapshot();
    },
    dataTestId: defaultProps['data-testid'],
    fetchMockImplementation: mockImgElement as jest.Mock,
  });
});
