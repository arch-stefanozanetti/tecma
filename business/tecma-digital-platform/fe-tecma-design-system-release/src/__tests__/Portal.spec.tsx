import React from 'react';

import { render } from '@testing-library/react';

import Portal from '../components/_Portal/Portal';

describe('Portal Component', () => {
  test('it should be in the document', () => {
    const { container, getByTestId, getByText } = render(<Portal id='tecma-portal'>foo</Portal>);
    document.body.appendChild(container);

    expect(getByText('foo')).toBeInTheDocument();
    expect(document.body.contains(getByTestId('tecma-portal'))).toBe(true);
  });
});
