import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { OrganizationSetupPage } from './OrganizationSetupPage';

const httpMock = vi.fn();

vi.mock('../../lib/http', () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

describe('OrganizationSetupPage', () => {
  beforeEach(() => {
    httpMock.mockReset();
    window.sessionStorage.clear();
  });

  it('does not render wizard when no access token is stored', () => {
    render(
      <MemoryRouter initialEntries={['/organization/setup']}>
        <OrganizationSetupPage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('heading', { name: /Configura la tua organizzazione/i })).not.toBeInTheDocument();
  });

  it('submits workspace step and advances to project step', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem('followup.auth.accessToken', 'tok-test');
    httpMock.mockResolvedValueOnce({ data: { _id: 'ws-new-1' } });

    render(
      <MemoryRouter>
        <OrganizationSetupPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText(/Nord Milano/i), 'Il mio workspace');
    await user.click(screen.getByRole('button', { name: /Continua/i }));

    await waitFor(() => {
      expect(httpMock).toHaveBeenCalledWith(
        '/workspaces',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ name: 'Il mio workspace' }),
        }),
      );
    });

    expect(screen.getByPlaceholderText(/Arborea/i)).toBeInTheDocument();
  });
});
