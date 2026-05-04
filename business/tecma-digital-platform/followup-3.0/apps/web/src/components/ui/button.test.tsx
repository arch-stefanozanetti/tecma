import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('renders label and default styles', () => {
    render(<Button>Conferma</Button>);
    const button = screen.getByRole('button', { name: 'Conferma' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-primary');
  });

  it('applies variant and size classes', () => {
    render(
      <Button variant="outline" size="sm">
        Azione
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Azione' });
    expect(button).toHaveClass('border');
    expect(button).toHaveClass('h-8');
  });
});
