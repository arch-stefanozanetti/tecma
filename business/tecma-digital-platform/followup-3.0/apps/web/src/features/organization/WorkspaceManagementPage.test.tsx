import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceManagementPage } from './WorkspaceManagementPage';

const httpMock = vi.fn();

vi.mock('../../lib/http', () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

type HttpInvocation = [string, { method?: string; body?: unknown }];

const installDefaultRoutes = (
  workspaces: Array<{ _id: string; name?: string; mfaRequired?: boolean }>,
) => {
  httpMock.mockImplementation((path: string, options?: { method?: string; body?: unknown }) => {
    const method = options?.method ?? 'GET';
    if (path === '/workspaces' && method === 'GET') {
      return Promise.resolve({ data: workspaces });
    }
    if (path === '/users' && method === 'GET') {
      return Promise.resolve({ data: [] });
    }
    if (path.startsWith('/workspaces/') && path.endsWith('/members') && method === 'GET') {
      return Promise.resolve({ data: [] });
    }
    if (path.startsWith('/projects') && method === 'GET') {
      return Promise.resolve({ data: [] });
    }
    if (path.endsWith('/entitlements') && method === 'GET') {
      return Promise.resolve({ data: [] });
    }
    if (path.endsWith('/ai-config') && method === 'GET') {
      return Promise.resolve({ data: null });
    }
    if (path.endsWith('/additional-infos') && method === 'GET') {
      return Promise.resolve({ data: [] });
    }
    if (path.endsWith('/branding') && method === 'GET') {
      return Promise.resolve({ data: null });
    }
    if (path.endsWith('/assets') && method === 'GET') {
      return Promise.resolve({ data: [] });
    }
    return Promise.resolve({ data: null });
  });
};

describe('WorkspaceManagementPage', () => {
  beforeEach(() => {
    httpMock.mockReset();
  });

  it('renders workspace list and calls patch on save', async () => {
    const user = userEvent.setup();
    const onOpenSetupWizard = vi.fn();
    installDefaultRoutes([
      { _id: 'ws-1', name: 'Workspace Uno', mfaRequired: false },
      { _id: 'ws-2', name: 'Workspace Due', mfaRequired: true },
    ]);

    render(
      <WorkspaceManagementPage
        accessToken="token-test"
        isTecmaAdmin
        onOpenSetupWizard={onOpenSetupWizard}
      />,
    );

    await waitFor(() => expect(screen.getByText('Workspace Uno')).toBeInTheDocument());
    const nameInput = screen.getByLabelText('Nome workspace');
    await user.click(nameInput);
    await user.keyboard('{Control>}a{/Control}{Backspace}');
    await user.type(nameInput, 'Workspace Uno Aggiornato');
    await user.click(screen.getByRole('checkbox', { name: /Richiedi MFA obbligatoria/i }));
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));

    await waitFor(() => {
      const calls = httpMock.mock.calls as HttpInvocation[];
      const patchCall = calls.find(
        ([path, options]) => path === '/workspaces/ws-1' && options?.method === 'PATCH',
      );
      expect(patchCall).toBeDefined();
      expect(patchCall?.[1]?.body).toEqual({
        name: 'Workspace Uno Aggiornato',
        mfaRequired: true,
      });
    });
  });

  it('shows create workspace button only to tecma admin', async () => {
    const onOpenSetupWizard = vi.fn();
    installDefaultRoutes([{ _id: 'ws-1', name: 'Workspace Uno' }]);
    const { rerender } = render(
      <WorkspaceManagementPage
        accessToken="token-test"
        isTecmaAdmin={false}
        onOpenSetupWizard={onOpenSetupWizard}
      />,
    );

    await waitFor(() => expect(screen.getByText('Workspace Uno')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Crea workspace' })).not.toBeInTheDocument();

    rerender(
      <WorkspaceManagementPage
        accessToken="token-test"
        isTecmaAdmin
        onOpenSetupWizard={onOpenSetupWizard}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Crea workspace' })).toBeInTheDocument(),
    );
  });

  it('renders advanced workspace panel with default tab Branding', async () => {
    installDefaultRoutes([{ _id: 'ws-1', name: 'Workspace Uno' }]);
    render(
      <WorkspaceManagementPage
        accessToken="token-test"
        isTecmaAdmin
        onOpenSetupWizard={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Workspace Uno')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByTestId('workspace-advanced-panel')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('workspace-advanced-tab-branding')).toBeInTheDocument();
    expect(screen.getByTestId('branding-save-button')).toBeInTheDocument();
  });

  it('switches advanced tab to AI Config and triggers PUT on save', async () => {
    const user = userEvent.setup();
    installDefaultRoutes([{ _id: 'ws-1', name: 'Workspace Uno' }]);
    render(
      <WorkspaceManagementPage
        accessToken="token-test"
        isTecmaAdmin
        onOpenSetupWizard={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Workspace Uno')).toBeInTheDocument());
    await user.click(screen.getByTestId('workspace-advanced-tab-ai'));

    const apiKeyInput = screen.getByTestId('ai-apikey-input');
    await user.type(apiKeyInput, 'sk-test');
    await user.click(screen.getByTestId('ai-save-button'));

    await waitFor(() => {
      const calls = httpMock.mock.calls as HttpInvocation[];
      const putCall = calls.find(
        ([path, options]) =>
          path === '/workspaces/ws-1/ai-config' && options?.method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const body = putCall?.[1]?.body as { apiKey?: string; provider?: string } | undefined;
      expect(body?.apiKey).toBe('sk-test');
      expect(body?.provider).toBe('openai');
    });
  });
});
