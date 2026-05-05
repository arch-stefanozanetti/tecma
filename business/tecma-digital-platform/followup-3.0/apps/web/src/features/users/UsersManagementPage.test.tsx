import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersManagementPage } from './UsersManagementPage';

const httpMock = vi.fn();

vi.mock('../../lib/http', () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

describe('UsersManagementPage', () => {
  beforeEach(() => {
    httpMock.mockReset();
  });

  it('loads users and workspaces on mount', async () => {
    httpMock
      .mockResolvedValueOnce({
        data: [
          {
            _id: 'user-1',
            email: 'alpha@example.com',
            fullName: 'Alpha User',
            role: 'viewer',
            status: 'active',
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [{ _id: 'ws-1', name: 'Workspace Uno' }],
      });

    render(<UsersManagementPage accessToken="token-test" isTecmaAdmin />);

    await waitFor(() => expect(screen.getByText('Alpha User')).toBeInTheDocument());
    expect(screen.getByText('Workspace Uno')).toBeInTheDocument();
    expect(httpMock).toHaveBeenCalledWith('/users', { method: 'GET', accessToken: 'token-test' });
    expect(httpMock).toHaveBeenCalledWith('/workspaces', {
      method: 'GET',
      accessToken: 'token-test',
    });
  });
});
