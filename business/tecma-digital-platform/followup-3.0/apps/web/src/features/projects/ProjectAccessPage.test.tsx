import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectAccessPage } from './ProjectAccessPage';

const httpMock = vi.fn();

vi.mock('../../lib/http', () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

describe('ProjectAccessPage', () => {
  beforeEach(() => {
    httpMock.mockReset();
    window.sessionStorage.clear();
  });

  it('shows user-facing empty state when no projects are available', async () => {
    window.sessionStorage.setItem('followup.workspaceId', 'ws-1');
    httpMock.mockImplementation((path: string) => {
      if (path === '/auth/me') {
        return Promise.resolve({
          data: { id: 'user-id-1', email: 'user@tecma.test', systemRole: 'user' },
        });
      }
      if (path === '/workspaces') {
        return Promise.resolve({ data: [{ _id: 'ws-1', name: 'Workspace 1' }] });
      }
      if (path.startsWith('/projects?workspaceId=')) {
        return Promise.resolve({ data: [] });
      }
      if (path === '/session/preferences') {
        return Promise.resolve({ data: { projectIds: [] } });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <ProjectAccessPage
        accessToken="access-token"
        initialProfile={{ id: 'user-id-1', email: 'user@tecma.test', systemRole: 'user' }}
        onContinue={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          'Nessun progetto visibile in questo workspace per il tuo utente. Contatta un amministratore per verificare i permessi di accesso ai progetti.',
        ),
      ).toBeInTheDocument(),
    );
  });

  it('resta sulla scelta workspace se /auth/me fallisce subito dopo login (profilo iniziale + 401 generico)', async () => {
    httpMock.mockImplementation((path: string) => {
      if (path === '/auth/me') {
        return Promise.reject(new Error('HTTP 401: /auth/me'));
      }
      if (path === '/workspaces') {
        return Promise.resolve({ data: [] });
      }
      if (path.startsWith('/projects?')) {
        return Promise.resolve({ data: [] });
      }
      if (path === '/session/preferences') {
        return Promise.resolve({ data: { projectIds: [] } });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <ProjectAccessPage
        accessToken="access-token"
        initialProfile={{ id: 'user-id-1', email: 'user@tecma.test', systemRole: 'user' }}
        onContinue={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Seleziona workspace e progetti/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/Reindirizzamento al login/i)).not.toBeInTheDocument();
  });

  it('interpreta /auth/me anche senza wrapper data (nessun banner di profilo incompleto)', async () => {
    window.sessionStorage.setItem('followup.workspaceId', 'ws-1');
    httpMock.mockImplementation((path: string) => {
      if (path === '/auth/me') {
        return Promise.resolve({
          id: 'user-id-1',
          email: 'user@tecma.test',
          systemRole: 'user',
        });
      }
      if (path === '/workspaces') {
        return Promise.resolve({ data: [{ _id: 'ws-1', name: 'Workspace 1' }] });
      }
      if (path.startsWith('/projects?workspaceId=')) {
        return Promise.resolve({ data: [] });
      }
      if (path === '/session/preferences') {
        return Promise.resolve({ data: { projectIds: [] } });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <ProjectAccessPage
        accessToken="access-token"
        initialProfile={{ id: 'user-id-1', email: 'user@tecma.test', systemRole: 'user' }}
        onContinue={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Seleziona workspace e progetti/i })).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/Il backend non ha restituito id\/email in \/auth\/me/i),
    ).not.toBeInTheDocument();
  });
});
