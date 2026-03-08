import React from 'react';

import { act, render } from '@testing-library/react';

import { DefaultProps } from '../declarations/defaultProps';
import { SizeExtended } from '../declarations/size';

// FIXME: Find a better way to require the component to have any props and optional size
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WithSize = React.PropsWithChildren<any> | { size?: SizeExtended };

const checkSizeProp = (Component: React.FC<WithSize>, defaultProps: DefaultProps, fetchMockImplementation?: jest.Mock) => {
  it('should allow to define the component size', async () => {
    if (fetchMockImplementation) {
      jest.spyOn(global, 'fetch').mockImplementation(fetchMockImplementation);
    }

    let getByTestId: any; // FIXME: Missing type
    let element: HTMLElement;
    let rerender: any; // FIXME: Missing type

    await act(() => {
      ({ getByTestId, rerender } = render(<Component size='small' />));
    });

    element = getByTestId(defaultProps['data-testid']);
    expect(element).toHaveClass('small');

    await act(() => {
      rerender(<Component size='large' />);
    });

    element = getByTestId(defaultProps['data-testid']);
    expect(element).toHaveClass('large');

    await act(() => {
      rerender(<Component />);
    });

    element = getByTestId(defaultProps['data-testid']);
    expect(element).not.toHaveClass('small', 'large');
    expect(element).toHaveClass('medium');
  });
};

export default checkSizeProp;
