import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginPage } from './LoginPage';

const httpMock = vi.fn();

vi.mock('../../lib/http', () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

const renderLoginPage = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('LoginPage', () => {
  beforeEach(() => {
    httpMock.mockReset();
  });

  it('shows session notice above login form', () => {
    renderLoginPage(
      <LoginPage
        notice="La sessione è scaduta. Accedi di nuovo per continuare."
        onSuccess={vi.fn()}
      />,
    );

    expect(
      screen.getByText('La sessione è scaduta. Accedi di nuovo per continuare.'),
    ).toBeInTheDocument();
  });

  it('submits login and forwards profile on success', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    httpMock.mockResolvedValueOnce({
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'user-id-1', email: 'user@tecma.test', systemRole: 'user' },
      },
    });

    renderLoginPage(<LoginPage onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText('Email'), 'user@tecma.test');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Accedi' }));

    await waitFor(() => {
      expect(httpMock).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        body: { email: 'user@tecma.test', password: 'Password123!' },
      });
      expect(onSuccess).toHaveBeenCalledWith('access-token', {
        id: 'user-id-1',
        email: 'user@tecma.test',
        systemRole: 'user',
      });
    });
  });

  it('shows user-facing error on failed login', async () => {
    const user = userEvent.setup();
    httpMock.mockRejectedValueOnce(new Error('Credenziali non valide.'));
    renderLoginPage(<LoginPage onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText('Email'), 'user@tecma.test');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Accedi' }));

    await waitFor(() => expect(screen.getByText('Credenziali non valide.')).toBeInTheDocument());
  });

  it('accepts flat body same as wrapped { data: ... } (proxy senza wrapper)', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    httpMock.mockResolvedValueOnce({
      accessToken: 'flat-access',
      refreshToken: 'flat-refresh',
      user: { id: '1', email: 'a@b.c', systemRole: 'user' },
    });

    renderLoginPage(<LoginPage onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText('Email'), 'user@tecma.test');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Accedi' }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('flat-access', {
        id: '1',
        email: 'a@b.c',
        systemRole: 'user',
      });
    });
  });

  it('shows error when response is neither wrapped nor flat tokens', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    httpMock.mockResolvedValueOnce({ foo: 1 });

    renderLoginPage(<LoginPage onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText('Email'), 'user@tecma.test');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Accedi' }));

    await waitFor(() => {
      expect(screen.getByText(/Risposta login non valida/i)).toBeInTheDocument();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  it('shows error when data.user.id is missing even with data wrapper', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    httpMock.mockResolvedValueOnce({
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { email: 'user@tecma.test' },
      },
    });

    renderLoginPage(<LoginPage onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText('Email'), 'user@tecma.test');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Accedi' }));

    await waitFor(() => {
      expect(screen.getByText(/Risposta login non valida/i)).toBeInTheDocument();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
