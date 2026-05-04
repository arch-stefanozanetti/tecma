import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectAccessPage } from './ProjectAccessPage';

const httpMock = vi.fn();

vi.mock('../../lib/http', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    http: (...args: unknown[]) => httpMock(...args),
  };
});

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

  it('Tecma SuperAdmin: carica GET /projects senza workspaceId (elenco globale)', async () => {
    window.sessionStorage.setItem('followup.workspaceId', '');
    const calls: string[] = [];
    httpMock.mockImplementation((path: string) => {
      calls.push(path);
      if (path === '/auth/me') {
        return Promise.resolve({
          data: { id: 'admin-id', email: 'admin@tecma.test', systemRole: 'tecma_admin' },
        });
      }
      if (path === '/workspaces') {
        return Promise.resolve({ data: [{ _id: 'ws-1', name: 'WS' }] });
      }
      if (path === '/projects') {
        return Promise.resolve({
          data: [
            { _id: 'p1', name: 'P1', displayName: 'P1', mode: 'sell' },
            { _id: 'p2', name: 'P2', displayName: 'P2', mode: 'rent' },
          ],
        });
      }
      if (path === '/session/preferences') {
        return Promise.resolve({ data: { projectIds: [] } });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <ProjectAccessPage
        accessToken="access-token"
        initialProfile={{
          id: 'admin-id',
          email: 'admin@tecma.test',
          systemRole: 'tecma_admin',
        }}
        onContinue={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(calls).toContain('/projects');
    });
    expect(calls.some((c) => c.startsWith('/projects?workspaceId='))).toBe(false);
    await waitFor(() => {
      expect(screen.getByText('P1')).toBeInTheDocument();
    });
    expect(screen.getByText('P2')).toBeInTheDocument();
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
