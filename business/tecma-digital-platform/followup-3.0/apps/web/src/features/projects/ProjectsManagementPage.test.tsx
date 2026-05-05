import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectsManagementPage } from './ProjectsManagementPage';

const httpMock = vi.fn();

vi.mock('../../lib/http', () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

describe('ProjectsManagementPage', () => {
  beforeEach(() => {
    httpMock.mockReset();
  });

  it('loads workspaces and projects for selected workspace', async () => {
    httpMock
      .mockResolvedValueOnce({
        data: [{ _id: 'ws-1', name: 'Workspace Uno' }],
      })
      .mockResolvedValueOnce({
        data: [{ _id: 'proj-1', name: 'Progetto Uno', code: 'PRJ1', workspaceId: 'ws-1' }],
      })
      .mockResolvedValueOnce({ data: [] });

    render(<ProjectsManagementPage accessToken="token-test" isTecmaAdmin />);

    await waitFor(() => expect(screen.getByText('Progetto Uno')).toBeInTheDocument());
    expect(httpMock).toHaveBeenCalledWith('/workspaces', {
      method: 'GET',
      accessToken: 'token-test',
    });
    expect(httpMock).toHaveBeenCalledWith('/projects?workspaceId=ws-1', {
      method: 'GET',
      accessToken: 'token-test',
    });
  });
});
