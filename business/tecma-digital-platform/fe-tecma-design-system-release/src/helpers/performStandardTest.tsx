import React from 'react';

import { act, BoundFunction, Query, render, RenderResult } from '@testing-library/react';

import { DefaultProps } from '../declarations/defaultProps';

/**
 * This function allows you to just perform a single test by specifying how to render your component
 * and which test execute on the rendered HTMLElement that your component produces.
 * @param {Object.<string, any>} conf test configuration
 * @param conf.description - Test description
 * @param conf.renderer Function returning a rendered result (ex. `() => render(<MyComponent />)`)
 * @param conf.test Function on which to perform the test (receives rendered HTMLElement as
 * argument)
 * @param conf.dataTestId `data-testid` attribute of the rendered element
 * @param conf.fetchMockImplementation Async function for mocking `fetch` API calls
 */
export const performTest = ({
  description,
  renderer,
  test,
  dataTestId,
  fetchMockImplementation,
  before,
}: {
  description: string;
  renderer: () => RenderResult;
  test: (element: HTMLElement) => void;
  dataTestId: string;
  fetchMockImplementation?: jest.Mock;
  before?: () => void;
}) => {
  it(description, async () => {
    if (before) {
      before();
    }
    if (fetchMockImplementation) {
      jest.spyOn(global, 'fetch').mockImplementation(fetchMockImplementation);
    }
    let getByTestId!: BoundFunction<Query>;
    await act(async () => {
      ({ getByTestId } = renderer());
    });
    const element = getByTestId(dataTestId);
    test(element as HTMLElement);
  });
};

/**
 * This function will perform a series of default tests that every component should comply to.
 * You can either test a pure component as well as an asynchronous component. Make sure to mock
 * calls to external APIs using `fetchMockImplementation` function.
 * @param Component React component to be tested
 * @param defaultProps
 * @param defaultClassName
 * @param fetchMockImplementation Async function for mocking `fetch` API calls
 */
const performStandardTest = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: React.FunctionComponent<any>,
  defaultProps: DefaultProps,
  defaultClassName: string,
  fetchMockImplementation?: jest.Mock,
) => {
  const doStandardTest = (description: string, renderer: () => RenderResult, test: (element: HTMLElement) => void) => {
    performTest({
      description,
      renderer,
      test,
      dataTestId: defaultProps['data-testid'] as string,
      fetchMockImplementation,
    });
  };

  doStandardTest(
    'should render without exploding',
    () => render(<Component {...defaultProps} />),
    (element) => {
      expect(element).toMatchSnapshot();
    },
  );

  doStandardTest(
    'should accept an "id" prop',
    () => render(<Component {...defaultProps} id='foo-id' />),
    (element) => {
      expect(element?.id).toBe('foo-id');
    },
  );

  doStandardTest(
    'should have default className',
    () => render(<Component {...defaultProps} />),
    (element) => {
      expect(element?.classList.contains(defaultClassName));
    },
  );

  doStandardTest(
    'should allow adding custom classes',
    () => render(<Component {...defaultProps} className='bar' />),
    (element) => {
      expect(element?.classList.contains('bar'));
    },
  );

  doStandardTest(
    'should allow to define custom style',
    () => render(<Component {...defaultProps} style={{ margin: '30px' }} />),
    (element) => {
      expect(element?.getAttribute('style'))?.toContain('margin');
    },
  );
};

export default performStandardTest;
