import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersManagementPage } from './UsersManagementPage';

const httpMock = vi.fn();

vi.mock('../../lib/http', () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

const baseUsers = [
  {
    _id: 'user-1',
    email: 'alpha@example.com',
    fullName: 'Alpha User',
    role: 'viewer',
    status: 'active',
    permissionsOverride: ['users.read'],
  },
  {
    _id: 'user-2',
    email: 'admin@example.com',
    fullName: 'Tecma Boss',
    role: 'admin',
    status: 'active',
    systemRole: 'tecma_admin',
  },
];

const baseWorkspaces = [{ _id: 'ws-1', name: 'Workspace Uno' }];

const sampleCatalog = {
  data: {
    groups: [
      {
        module: 'users',
        label: 'Utenti',
        permissions: [
          {
            id: 'users.read',
            module: 'users',
            action: 'read',
            actionLabel: 'Lettura',
            label: 'Utenti — Lettura',
          },
          {
            id: 'users.write',
            module: 'users',
            action: 'write',
            actionLabel: 'Scrittura',
            label: 'Utenti — Scrittura',
          },
        ],
      },
    ],
  },
};

const wireDefaultMock = () => {
  httpMock.mockImplementation(async (path: string, options: { method: string }) => {
    if (path === '/users' && options.method === 'GET') return { data: baseUsers };
    if (path === '/workspaces' && options.method === 'GET') return { data: baseWorkspaces };
    if (path === '/rbac/permission-catalog') return sampleCatalog;
    if (path.startsWith('/rbac/roles/')) {
      return { data: { roleKey: 'viewer', permissions: ['projects.read'] } };
    }
    if (path.startsWith('/users/') && options.method === 'PATCH') return { data: baseUsers[0] };
    if (path === '/users' && options.method === 'POST') return { data: { _id: 'new', email: '' } };
    return { data: {} };
  });
};

describe('UsersManagementPage', () => {
  beforeEach(() => {
    httpMock.mockReset();
    wireDefaultMock();
  });

  it('carica utenti e workspaces, mostra badge tecma_admin e ruolo workspace', async () => {
    render(<UsersManagementPage accessToken="token-test" isTecmaAdmin />);

    await waitFor(() => expect(screen.getByText('Alpha User')).toBeInTheDocument());
    expect(screen.getByText('Tecma Boss')).toBeInTheDocument();
    expect(screen.getByTestId('badge-tecma-admin-user-2')).toBeInTheDocument();
    expect(screen.getByTestId('badge-role-user-1')).toHaveTextContent('Viewer');
    expect(screen.getByTestId('badge-role-user-2')).toHaveTextContent('Admin');

    const calls = httpMock.mock.calls.map((call) => call[0] as string);
    expect(calls).toContain('/users');
    expect(calls).toContain('/workspaces');
    expect(calls).toContain('/rbac/permission-catalog');
  });

  it('mostra/chiude wizard di invito tramite toggle', async () => {
    render(<UsersManagementPage accessToken="token-test" isTecmaAdmin />);
    await waitFor(() => expect(screen.getByText('Alpha User')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('toggle-invite-wizard'));
    expect(screen.getByTestId('invite-user-wizard')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-invite-wizard'));
    expect(screen.queryByTestId('invite-user-wizard')).not.toBeInTheDocument();
  });

  it('salva permessi override solo quando dirty e re-fetcha la lista', async () => {
    render(<UsersManagementPage accessToken="token-test" isTecmaAdmin />);
    await waitFor(() => expect(screen.getByText('Alpha User')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByTestId('permission-override-panel')).toBeInTheDocument(),
    );

    const saveButton = screen.getByTestId('save-overrides-button');
    expect(saveButton).toBeDisabled();

    await waitFor(() =>
      expect(screen.getByTestId('permission-checkbox-users.write')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('permission-checkbox-users.write'));
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      const patchCalls = httpMock.mock.calls.filter(
        (call) =>
          (call[0] as string).startsWith('/users/user-1') &&
          (call[1] as { method: string }).method === 'PATCH',
      );
      expect(patchCalls.length).toBeGreaterThan(0);
      const lastCall = patchCalls.at(-1);
      const body = (lastCall?.[1] as { body: { permissionsOverride: string[] } }).body;
      expect(body.permissionsOverride).toEqual(
        expect.arrayContaining(['users.read', 'users.write']),
      );
    });
  });
});
