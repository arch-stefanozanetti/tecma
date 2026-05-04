import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PageTemplate } from './PageTemplate';

const httpMock = vi.fn();

vi.mock('../lib/http', () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

describe('PageTemplate', () => {
  beforeEach(() => {
    httpMock.mockReset();
    window.sessionStorage.clear();
    window.sessionStorage.setItem('followup3.lastEmail', 'user@tecma.test');
    window.sessionStorage.setItem('followup.auth.accessToken', 'access-token');
    window.sessionStorage.setItem(
      'followup3.projectsCache',
      JSON.stringify([
        { id: 'p1', name: 'Progetto Uno', displayName: 'Progetto Uno', mode: 'rent' },
        { id: 'p2', name: 'Progetto Due', displayName: 'Progetto Due', mode: 'sell' },
      ]),
    );
    httpMock.mockResolvedValue({ data: [{ _id: 'ws-1', name: 'Workspace Uno' }] });
  });

  it('renders workspace dropdown next to All projects label', async () => {
    render(
      <PageTemplate accessToken="access-token">
        <div>Dashboard content</div>
      </PageTemplate>,
    );

    expect(screen.getByText('All projects')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Workspace Uno')).toBeInTheDocument());
  });
});
