import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceManagementPage } from './WorkspaceManagementPage';

const httpMock = vi.fn();

vi.mock('../../lib/http', () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

describe('WorkspaceManagementPage', () => {
  beforeEach(() => {
    httpMock.mockReset();
  });

  it('renders workspace list and calls patch on save', async () => {
    const user = userEvent.setup();
    const onOpenSetupWizard = vi.fn();
    httpMock
      .mockResolvedValueOnce({
        data: [
          { _id: 'ws-1', name: 'Workspace Uno', mfaRequired: false },
          { _id: 'ws-2', name: 'Workspace Due', mfaRequired: true },
        ],
      })
      .mockResolvedValueOnce({
        data: { _id: 'ws-1', name: 'Workspace Uno Aggiornato', mfaRequired: true },
      });

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
      expect(httpMock).toHaveBeenCalledWith('/workspaces/ws-1', {
        method: 'PATCH',
        accessToken: 'token-test',
        body: { name: 'Workspace Uno Aggiornato', mfaRequired: true },
      });
    });
  });

  it('shows create workspace button only to tecma admin', async () => {
    httpMock.mockResolvedValueOnce({ data: [{ _id: 'ws-1', name: 'Workspace Uno' }] });
    const onOpenSetupWizard = vi.fn();
    const { rerender } = render(
      <WorkspaceManagementPage
        accessToken="token-test"
        isTecmaAdmin={false}
        onOpenSetupWizard={onOpenSetupWizard}
      />,
    );

    await waitFor(() => expect(screen.getByText('Workspace Uno')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Crea workspace' })).not.toBeInTheDocument();

    httpMock.mockResolvedValueOnce({ data: [{ _id: 'ws-1', name: 'Workspace Uno' }] });
    rerender(
      <WorkspaceManagementPage
        accessToken="token-test"
        isTecmaAdmin
        onOpenSetupWizard={onOpenSetupWizard}
      />,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crea workspace' })).toBeInTheDocument());
  });
});
