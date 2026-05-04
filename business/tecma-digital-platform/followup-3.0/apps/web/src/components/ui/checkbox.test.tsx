import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox, CheckboxWithLabel } from './checkbox';

describe('Checkbox', () => {
  it('fires onCheckedChange when toggled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="notify" onCheckedChange={onCheckedChange} />);
    const checkbox = screen.getByRole('checkbox', { name: 'notify' });
    await user.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('supports label click via CheckboxWithLabel', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<CheckboxWithLabel label="Accetto" onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByText('Accetto'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
