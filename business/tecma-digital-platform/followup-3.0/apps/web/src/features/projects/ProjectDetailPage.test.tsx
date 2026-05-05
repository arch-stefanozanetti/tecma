import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectDetailPage } from './ProjectDetailPage';
import { AUTH_ACCESS_TOKEN_KEY } from '../../lib/authSession';

const httpMock = vi.fn();

vi.mock('../../lib/http', () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

vi.mock('../../lib/authSession', async (importActual) => {
  const actual = await importActual<typeof import('../../lib/authSession')>();
  return {
    ...actual,
    isTokenExpired: () => false,
  };
});

const installToken = () => {
  sessionStorage.setItem(AUTH_ACCESS_TOKEN_KEY, 'test-token');
};

const renderWithRoute = () =>
  render(
    <MemoryRouter initialEntries={['/projects/proj-1']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

const installRoutes = () => {
  httpMock.mockImplementation((path: string, options?: { method?: string }) => {
    const method = options?.method ?? 'GET';
    if (path === '/projects/proj-1' && method === 'GET') {
      return Promise.resolve({
        data: { _id: 'proj-1', name: 'Project Demo', code: 'demo', workspaceId: 'ws-1' },
      });
    }
    if (path.endsWith('/branding') && method === 'GET') {
      return Promise.resolve({ data: { primaryColor: '#1A2B3C' } });
    }
    if (path.endsWith('/policies') && method === 'GET') return Promise.resolve({ data: null });
    if (path.endsWith('/marketing-settings') && method === 'GET')
      return Promise.resolve({ data: null });
    if (path.endsWith('/workflow-settings') && method === 'GET')
      return Promise.resolve({ data: null });
    if (path.endsWith('/email-config') && method === 'GET') return Promise.resolve({ data: null });
    if (path.endsWith('/email-templates') && method === 'GET')
      return Promise.resolve({ data: [] });
    if (path.endsWith('/pdf-templates') && method === 'GET') return Promise.resolve({ data: [] });
    if (path.endsWith('/legacy-overrides') && method === 'GET')
      return Promise.resolve({ data: null });
    return Promise.resolve({ data: null });
  });
};

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    httpMock.mockReset();
    sessionStorage.clear();
    installToken();
    installRoutes();
  });

  it('renders 11 tabs', async () => {
    renderWithRoute();
    await waitFor(() =>
      expect(screen.getByTestId('project-detail-tabs')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('project-detail-tab-identity')).toBeInTheDocument();
    expect(screen.getByTestId('project-detail-tab-contacts')).toBeInTheDocument();
    expect(screen.getByTestId('project-detail-tab-branding')).toBeInTheDocument();
    expect(screen.getByTestId('project-detail-tab-policies')).toBeInTheDocument();
    expect(screen.getByTestId('project-detail-tab-marketing')).toBeInTheDocument();
    expect(screen.getByTestId('project-detail-tab-workflow')).toBeInTheDocument();
    expect(screen.getByTestId('project-detail-tab-email-config')).toBeInTheDocument();
    expect(screen.getByTestId('project-detail-tab-email-templates')).toBeInTheDocument();
    expect(screen.getByTestId('project-detail-tab-pdf-templates')).toBeInTheDocument();
    expect(screen.getByTestId('project-detail-tab-legacy-overrides')).toBeInTheDocument();
    expect(screen.getByTestId('project-detail-tab-connectors')).toBeInTheDocument();
  });

  it('PATCH project on identity save', async () => {
    const user = userEvent.setup();
    renderWithRoute();
    await waitFor(() =>
      expect(screen.getByTestId('project-identity-form')).toBeInTheDocument(),
    );

    const displayNameInput = screen.getByTestId('project-identity-displayName');
    await user.type(displayNameInput, 'New Name');
    await user.click(screen.getByTestId('project-identity-save'));

    await waitFor(() => {
      const calls = httpMock.mock.calls as Array<[string, { method?: string; body?: unknown }]>;
      const patch = calls.find(
        ([path, options]) => path === '/projects/proj-1' && options?.method === 'PATCH',
      );
      expect(patch).toBeDefined();
      const body = patch?.[1]?.body as { displayName?: string } | undefined;
      expect(body?.displayName).toBe('New Name');
    });
  });

  it('PUT branding on save', async () => {
    const user = userEvent.setup();
    renderWithRoute();
    await user.click(screen.getByTestId('project-detail-tab-branding'));

    await waitFor(() =>
      expect(screen.getByTestId('project-branding-form')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('project-branding-save'));

    await waitFor(() => {
      const calls = httpMock.mock.calls as Array<[string, { method?: string; body?: unknown }]>;
      const put = calls.find(
        ([path, options]) =>
          path === '/projects/proj-1/branding' && options?.method === 'PUT',
      );
      expect(put).toBeDefined();
    });
  });
});
