import React, { ReactElement } from 'react';

import { act, render } from '@testing-library/react';

import Icon, { IconURLContext } from '../components/Icon/Icon';
import {
  MOCK_LOCAL_URL,
  mockFetchArrowUp,
  mockFetchSVG,
  MOCK_REMOTE_URL,
  MOCK_UNEXISTING_URL,
} from '../components/Icon/mock/mockFetchIcon';
import checkSizeProp from '../helpers/checkSizeProp';
import performStandardTest, { performTest } from '../helpers/performStandardTest';
import { retrieveSVGElement } from '../icon_utilities';

const defaultProps = {
  'data-testid': 'tecma-icon',
};

jest.mock('./utils/functions', () => {
  const originalModule = jest.requireActual('./utils/functions');
  return {
    __esModule: true,
    ...originalModule,
    getLocalIconUrl: async (iconName: string) => `${MOCK_LOCAL_URL}/${iconName}.svg`,
  };
});

describe('Icon Component', () => {
  performStandardTest(Icon, defaultProps, 'tecma-icon', mockFetchArrowUp as jest.Mock);

  checkSizeProp(Icon, defaultProps, mockFetchArrowUp as jest.Mock);

  beforeEach(() => {
    jest.spyOn(global.console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  performTest({
    description: 'should render local icon if iconName is passed and no remote URL is provided',
    renderer: () => render(<Icon {...defaultProps} iconName='arrow-up' />),
    test: (element) => {
      expect(element).toMatchSnapshot();
    },
    dataTestId: defaultProps['data-testid'],
    fetchMockImplementation: mockFetchSVG as jest.Mock,
  });

  performTest({
    description: 'should render remote icon if iconName is passed and remote URL is provided',
    renderer: () => render(<Icon {...defaultProps} src={MOCK_REMOTE_URL} iconName='arrow-left' />),
    test: (element) => {
      expect(element).toMatchSnapshot();
    },
    dataTestId: defaultProps['data-testid'],
    fetchMockImplementation: mockFetchSVG as jest.Mock,
  });

  performTest({
    description: 'should render remote icon if iconName is passed and remote URL is provided as context',
    renderer: () =>
      render(
        <IconURLContext.Provider value={MOCK_REMOTE_URL}>
          <Icon {...defaultProps} iconName='arrow-left' />
        </IconURLContext.Provider>,
      ),
    test: (element) => {
      expect(element).toMatchSnapshot();
    },
    dataTestId: defaultProps['data-testid'],
    fetchMockImplementation: mockFetchSVG as jest.Mock,
  });

  performTest({
    description: 'should render local icon if iconName is passed and remote URL is invalid',
    renderer: () => render(<Icon {...defaultProps} src={MOCK_UNEXISTING_URL} iconName='arrow-up' />),
    test: (element) => {
      expect(element).toMatchSnapshot();
      expect((console.error as jest.Mock).mock.calls.length).toEqual(1);
    },
    dataTestId: defaultProps['data-testid'],
    fetchMockImplementation: mockFetchSVG as jest.Mock,
  });

  it('retrieveSVGElement should retrieve element and match the SVG', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(mockFetchArrowUp as jest.Mock);

    const reactElement = await retrieveSVGElement('/url/does/not/matter/with/mock/fetch', 'someHash');

    expect(reactElement).not.toBeNull();

    let container;

    await act(() => {
      ({ container } = render(reactElement as ReactElement));
    });

    expect(container).toMatchSnapshot();
  });
});
