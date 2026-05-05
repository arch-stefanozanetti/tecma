import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectAccessPage } from './ProjectAccessPage';
import { HttpApiError } from '../../lib/httpError';

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
      expect(
        screen.getByRole('heading', { name: /Seleziona workspace e progetti/i }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Reindirizzamento al login/i)).not.toBeInTheDocument();
  });

  it('se /auth/me restituisce token invalido pulisce e torna al login', async () => {
    const onSessionInvalid = vi.fn();
    window.sessionStorage.setItem('followup.auth.accessToken', 'expired-token');
    httpMock.mockImplementation((path: string) => {
      if (path === '/auth/me') {
        return Promise.reject(
          new HttpApiError('Missing or invalid token', {
            kind: 'unauthorized',
            path: '/auth/me',
            status: 401,
            serverMessage: 'Missing or invalid token',
            unauthorizedBecause: 'session',
          }),
        );
      }
      if (path === '/workspaces') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    render(
      <ProjectAccessPage
        accessToken="expired-token"
        initialProfile={{ id: 'user-id-1', email: 'user@tecma.test', systemRole: 'user' }}
        onContinue={vi.fn()}
        onSessionInvalid={onSessionInvalid}
      />,
    );

    await waitFor(() => {
      expect(onSessionInvalid).toHaveBeenCalledWith({
        reason: 'invalid_token',
        message: 'La sessione è scaduta. Accedi di nuovo per continuare.',
      });
    });
    expect(window.sessionStorage.getItem('followup.auth.accessToken')).toBeNull();
  });

  it('se /workspaces restituisce token scaduto pulisce e torna al login', async () => {
    const onSessionInvalid = vi.fn();
    window.sessionStorage.setItem('followup.auth.accessToken', 'expired-token');
    httpMock.mockImplementation((path: string) => {
      if (path === '/auth/me') {
        return Promise.resolve({
          data: { id: 'user-id-1', email: 'user@tecma.test', systemRole: 'user' },
        });
      }
      if (path === '/workspaces') {
        return Promise.reject(
          new HttpApiError('jwt expired', {
            kind: 'unauthorized',
            path: '/workspaces',
            status: 401,
            serverMessage: 'jwt expired',
            unauthorizedBecause: 'session',
          }),
        );
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <ProjectAccessPage
        accessToken="expired-token"
        initialProfile={{ id: 'user-id-1', email: 'user@tecma.test', systemRole: 'user' }}
        onContinue={vi.fn()}
        onSessionInvalid={onSessionInvalid}
      />,
    );

    await waitFor(() => {
      expect(onSessionInvalid).toHaveBeenCalledWith({
        reason: 'session_expired',
        message: 'La sessione è scaduta. Accedi di nuovo per continuare.',
      });
    });
    expect(window.sessionStorage.getItem('followup.auth.accessToken')).toBeNull();
  });

  it('errore rete non-sessione mostra recovery senza testo tecnico', async () => {
    httpMock.mockImplementation((path: string) => {
      if (path === '/auth/me') {
        return Promise.resolve({
          data: { id: 'user-id-1', email: 'user@tecma.test', systemRole: 'user' },
        });
      }
      if (path === '/workspaces') {
        return Promise.reject(
          new HttpApiError('Impossibile raggiungere le API (/v1).', {
            kind: 'network',
            path: '/workspaces',
            serverMessage: 'Failed to fetch',
          }),
        );
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
      expect(screen.getByText('Qualcosa non ha funzionato.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Segnala problema' })).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });

  it('Tecma SuperAdmin: se workspaceId è selezionato carica progetti filtrati per workspace', async () => {
    window.sessionStorage.setItem('followup.workspaceId', 'ws-1');
    const calls: string[] = [];
    httpMock.mockImplementation((path: string) => {
      calls.push(path);
      if (path === '/auth/me') {
        return Promise.resolve({
          data: { id: 'admin-id', email: 'admin@tecma.test', systemRole: 'tecma_admin' },
        });
      }
      if (path === '/workspaces') {
        return Promise.resolve({ data: [{ _id: 'ws-1', name: 'WS 1' }] });
      }
      if (path === '/projects?workspaceId=ws-1&userId=admin-id') {
        return Promise.resolve({
          data: [
            { _id: 'p-ws-1', name: 'Project WS 1', displayName: 'Project WS 1', mode: 'sell' },
          ],
        });
      }
      if (path === '/projects') {
        return Promise.resolve({
          data: [{ _id: 'global', name: 'Global Project', displayName: 'Global Project' }],
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
      expect(calls).toContain('/projects?workspaceId=ws-1&userId=admin-id');
    });
    expect(calls).not.toContain('/projects');
    expect(screen.getByText('Project WS 1')).toBeInTheDocument();
    expect(screen.queryByText('Global Project')).not.toBeInTheDocument();
  });

  it('Tecma SuperAdmin: senza workspaceId usa GET /projects come fallback globale', async () => {
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

  it('Tecma SuperAdmin: cambiando workspace aggiorna la lista progetti', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem('followup.workspaceId', 'ws-1');
    const calls: string[] = [];
    httpMock.mockImplementation((path: string) => {
      calls.push(path);
      if (path === '/auth/me') {
        return Promise.resolve({
          data: { id: 'admin-id', email: 'admin@tecma.test', systemRole: 'tecma_admin' },
        });
      }
      if (path === '/workspaces') {
        return Promise.resolve({
          data: [
            { _id: 'ws-1', name: 'Workspace 1' },
            { _id: 'ws-2', name: 'Workspace 2' },
          ],
        });
      }
      if (path === '/projects?workspaceId=ws-1&userId=admin-id') {
        return Promise.resolve({
          data: [{ _id: 'p-ws-1', name: 'Project WS 1', displayName: 'Project WS 1' }],
        });
      }
      if (path === '/projects?workspaceId=ws-2&userId=admin-id') {
        return Promise.resolve({
          data: [{ _id: 'p-ws-2', name: 'Project WS 2', displayName: 'Project WS 2' }],
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
      expect(screen.getByText('Project WS 1')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('combobox', { name: /workspace/i }));
    await user.click(await screen.findByText('Workspace 2'));

    await waitFor(() => {
      expect(calls).toContain('/projects?workspaceId=ws-2&userId=admin-id');
    });
    await waitFor(() => {
      expect(screen.getByText('Project WS 2')).toBeInTheDocument();
    });
    expect(screen.queryByText('Project WS 1')).not.toBeInTheDocument();
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
      expect(
        screen.getByRole('heading', { name: /Seleziona workspace e progetti/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/Il backend non ha restituito id\/email in \/auth\/me/i),
    ).not.toBeInTheDocument();
  });
});
