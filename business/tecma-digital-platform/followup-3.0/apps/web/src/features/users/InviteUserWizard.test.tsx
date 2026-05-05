import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InviteUserWizard } from './InviteUserWizard';

const httpMock = vi.fn();
vi.mock('../../lib/http', () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

const workspaces = [
  { _id: 'ws-1', name: 'Workspace A' },
  { _id: 'ws-2', name: 'Workspace B' },
];

const existingUsers = [{ _id: 'user-1', email: 'a@b.it', fullName: 'A B' }];

const sampleCatalog = {
  data: {
    groups: [
      {
        module: 'users',
        label: 'Utenti',
        permissions: [
          {
            id: 'users.invite',
            module: 'users',
            action: 'invite',
            actionLabel: 'Invito',
            label: 'Utenti — Invito',
          },
        ],
      },
    ],
  },
};

const sampleProjects = {
  data: [
    { _id: 'proj-1', displayName: 'Progetto 1', code: 'P1' },
    { _id: 'proj-2', displayName: 'Progetto 2' },
  ],
};

const sampleRolePermissions = (role: string) => ({
  data: {
    roleKey: role,
    permissions: role === 'viewer' ? ['projects.read'] : [],
  },
});

const setupHttpMock = () => {
  httpMock.mockImplementation(async (path: string) => {
    if (path === '/rbac/permission-catalog') return sampleCatalog;
    if (path.startsWith('/rbac/roles/')) {
      const role = path.split('/')[3] ?? 'viewer';
      return sampleRolePermissions(role);
    }
    if (path.startsWith('/projects')) return sampleProjects;
    if (path === '/users')
      return {
        data: { _id: 'new-user-id', email: 'new@ex.it' },
      };
    return { data: {} };
  });
};

describe('InviteUserWizard', () => {
  beforeEach(() => {
    httpMock.mockReset();
    setupHttpMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('blocca avanzamento step 3 senza email/nome validi', async () => {
    render(
      <InviteUserWizard
        accessToken="token"
        workspaces={workspaces}
        existingUsers={existingUsers}
        onCancel={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    expect(
      await screen.findByText(/Email e nome completo .* sono obbligatori\./),
    ).toBeInTheDocument();
  });

  it('completa il flusso invite -> POST /users -> assignment progetti', async () => {
    const onCompleted = vi.fn();
    render(
      <InviteUserWizard
        accessToken="token"
        workspaces={workspaces}
        existingUsers={existingUsers}
        onCancel={vi.fn()}
        onCompleted={onCompleted}
      />,
    );
    await waitFor(() => expect(httpMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    await waitFor(() => screen.getByTestId('wizard-project-proj-1'));
    fireEvent.click(screen.getByTestId('wizard-project-proj-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));

    fireEvent.change(screen.getByPlaceholderText('nome@azienda.it'), {
      target: { value: 'invitato@ex.it' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nome Cognome'), {
      target: { value: 'Tester Wizard' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));

    fireEvent.click(screen.getByRole('button', { name: /Conferma e invita/ }));

    await waitFor(() =>
      expect(onCompleted).toHaveBeenCalledWith({
        userId: 'new-user-id',
        workspaceId: 'ws-1',
        mode: 'invite',
      }),
    );

    const calls = httpMock.mock.calls.map((call) => call[0] as string);
    expect(calls).toContain('/users');
    expect(calls.some((c) => c.startsWith('/workspaces/ws-1/members/new-user-id/projects'))).toBe(
      true,
    );
  });

  it('mostra modalita esistente solo se allowExisting=true', () => {
    render(
      <InviteUserWizard
        accessToken="token"
        workspaces={workspaces}
        existingUsers={existingUsers}
        allowExisting
        onCancel={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );
    expect(screen.getByTestId('wizard-mode-invite')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-mode-existing')).toBeInTheDocument();
  });
});
