import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Input } from './input';

describe('Input', () => {
  it('renders invalid state with icon when requested', () => {
    render(<Input aria-label="email" invalid showErrorIcon />);
    const input = screen.getByLabelText('email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(document.querySelector('svg')).toBeTruthy();
  });

  it('supports typing and endAdornment', async () => {
    const user = userEvent.setup();
    render(
      <Input
        aria-label="search"
        endAdornment={<span data-testid="adornment">!</span>}
        defaultValue=""
      />,
    );
    const input = screen.getByLabelText('search');
    await user.type(input, 'ciao');
    expect(input).toHaveValue('ciao');
    expect(screen.getByTestId('adornment')).toBeInTheDocument();
  });
});
