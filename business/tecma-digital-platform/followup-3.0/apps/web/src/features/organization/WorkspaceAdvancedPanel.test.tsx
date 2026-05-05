import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceAdvancedPanel } from './WorkspaceAdvancedPanel';

const httpMock = vi.fn();

vi.mock('../../lib/http', () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

type Calls = Array<[string, { method?: string; body?: unknown }]>;

const installRoutes = (overrides: Partial<Record<string, unknown>> = {}) => {
  httpMock.mockImplementation((path: string, options?: { method?: string; body?: unknown }) => {
    const method = options?.method ?? 'GET';
    if (path.endsWith('/entitlements') && method === 'GET') {
      return Promise.resolve(
        overrides.entitlements ?? {
          data: [
            { workspaceId: 'ws-1', feature: 'ai', status: 'enabled' },
            { workspaceId: 'ws-1', feature: 'analytics', status: 'disabled' },
          ],
        },
      );
    }
    if (path.endsWith('/ai-config') && method === 'GET') {
      return Promise.resolve(
        overrides.aiConfig ?? {
          data: {
            provider: 'claude',
            apiKey: 'sk-***masked***',
            model: 'claude-3-opus',
            temperature: 0.5,
            enabled: true,
          },
        },
      );
    }
    if (path.endsWith('/additional-infos') && method === 'GET') {
      return Promise.resolve(
        overrides.additionalInfos ?? {
          data: [
            {
              _id: 'info-1',
              workspaceId: 'ws-1',
              label: 'Codice ATECO',
              value: '62.01.00',
              sortOrder: 0,
            },
          ],
        },
      );
    }
    if (path.endsWith('/branding') && method === 'GET') {
      return Promise.resolve(
        overrides.branding ?? {
          data: { logoUrl: 'https://cdn/test.png', primaryColor: '#112233' },
        },
      );
    }
    if (path.endsWith('/assets') && method === 'GET') {
      return Promise.resolve(
        overrides.assets ?? {
          data: [
            {
              _id: 'asset-1',
              workspaceId: 'ws-1',
              fileName: 'logo.png',
              contentType: 'image/png',
              kind: 'workspace.logo',
              status: 'active',
            },
          ],
        },
      );
    }
    return Promise.resolve({ data: null });
  });
};

describe('WorkspaceAdvancedPanel', () => {
  beforeEach(() => {
    httpMock.mockReset();
  });

  it('loads default branding tab and lists branding values', async () => {
    installRoutes();
    render(
      <WorkspaceAdvancedPanel accessToken="token" workspaceId="ws-1" canManage />,
    );

    await waitFor(() => expect(screen.getByTestId('branding-color-input')).toBeInTheDocument());
    const colorInput = screen.getByTestId('branding-color-input') as HTMLInputElement;
    expect(colorInput.value).toBe('#112233');
  });

  it('toggles entitlement feature via PATCH', async () => {
    installRoutes();
    const user = userEvent.setup();
    render(
      <WorkspaceAdvancedPanel accessToken="token" workspaceId="ws-1" canManage />,
    );

    await user.click(screen.getByTestId('workspace-advanced-tab-entitlements'));
    await waitFor(() => expect(screen.getByTestId('feature-toggle-ai')).toBeInTheDocument());

    await user.click(screen.getByTestId('feature-toggle-ai'));

    await waitFor(() => {
      const calls = httpMock.mock.calls as Calls;
      const patchCall = calls.find(
        ([path, options]) =>
          path === '/workspaces/ws-1/entitlements/ai' && options?.method === 'PATCH',
      );
      expect(patchCall).toBeDefined();
      const body = patchCall?.[1]?.body as { status?: string } | undefined;
      expect(body?.status).toBe('disabled');
    });
  });

  it('saves AI configuration via PUT', async () => {
    installRoutes();
    const user = userEvent.setup();
    render(
      <WorkspaceAdvancedPanel accessToken="token" workspaceId="ws-1" canManage />,
    );

    await user.click(screen.getByTestId('workspace-advanced-tab-ai'));
    await waitFor(() => expect(screen.getByTestId('ai-save-button')).toBeInTheDocument());

    await user.click(screen.getByTestId('ai-save-button'));

    await waitFor(() => {
      const calls = httpMock.mock.calls as Calls;
      const putCall = calls.find(
        ([path, options]) =>
          path === '/workspaces/ws-1/ai-config' && options?.method === 'PUT',
      );
      expect(putCall).toBeDefined();
    });
  });

  it('creates and deletes an additional info entry', async () => {
    installRoutes();
    const user = userEvent.setup();
    render(
      <WorkspaceAdvancedPanel accessToken="token" workspaceId="ws-1" canManage />,
    );

    await user.click(screen.getByTestId('workspace-advanced-tab-infos'));
    await waitFor(() => expect(screen.getByTestId('info-create-button')).toBeInTheDocument());

    await user.type(screen.getByTestId('info-new-label'), 'Nuovo campo');
    await user.click(screen.getByTestId('info-create-button'));

    await waitFor(() => {
      const calls = httpMock.mock.calls as Calls;
      const postCall = calls.find(
        ([path, options]) =>
          path === '/workspaces/ws-1/additional-infos' && options?.method === 'POST',
      );
      expect(postCall).toBeDefined();
    });

    await user.click(screen.getByTestId('info-delete-info-1'));
    await waitFor(() => {
      const calls = httpMock.mock.calls as Calls;
      const deleteCall = calls.find(
        ([path, options]) =>
          path === '/workspaces/ws-1/additional-infos/info-1' && options?.method === 'DELETE',
      );
      expect(deleteCall).toBeDefined();
    });
  });

  it('saves branding via PATCH and uploads asset inline', async () => {
    installRoutes();
    const user = userEvent.setup();
    render(
      <WorkspaceAdvancedPanel accessToken="token" workspaceId="ws-1" canManage />,
    );

    const colorInput = screen.getByTestId('branding-color-input') as HTMLInputElement;
    await waitFor(() => expect(colorInput.value).toBe('#112233'));
    fireEvent.change(colorInput, { target: { value: '#445566' } });
    await waitFor(() => expect(colorInput.value).toBe('#445566'));
    await user.click(screen.getByTestId('branding-save-button'));

    await waitFor(() => {
      const calls = httpMock.mock.calls as Calls;
      const patchCall = calls.find(
        ([path, options]) =>
          path === '/workspaces/ws-1/branding' && options?.method === 'PATCH',
      );
      expect(patchCall).toBeDefined();
      const body = patchCall?.[1]?.body as { primaryColor?: string } | undefined;
      expect(body?.primaryColor).toBe('#445566');
    });

    await user.click(screen.getByTestId('workspace-advanced-tab-assets'));
    await waitFor(() => expect(screen.getByTestId('asset-create-button')).toBeInTheDocument());

    const inlineInput = screen.getByTestId('asset-inline-input');
    const nameInput = inlineInput.parentElement?.querySelector(
      'input[placeholder="logo.png"]',
    ) as HTMLInputElement | null;
    expect(nameInput).not.toBeNull();
    if (nameInput != null) await user.type(nameInput, 'logo.png');
    await user.type(inlineInput, 'aGVsbG8=');
    await user.click(screen.getByTestId('asset-create-button'));

    await waitFor(() => {
      const calls = httpMock.mock.calls as Calls;
      const postCall = calls.find(
        ([path, options]) =>
          path === '/workspaces/ws-1/assets' && options?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      const body = postCall?.[1]?.body as { fileName?: string; inlineData?: string } | undefined;
      expect(body?.fileName).toBe('logo.png');
      expect(body?.inlineData).toBe('aGVsbG8=');
    });

    await user.click(screen.getByTestId('asset-delete-asset-1'));
    await waitFor(() => {
      const calls = httpMock.mock.calls as Calls;
      const deleteCall = calls.find(
        ([path, options]) =>
          path === '/workspaces/ws-1/assets/asset-1' && options?.method === 'DELETE',
      );
      expect(deleteCall).toBeDefined();
    });
  });

  it('hides write actions when canManage is false', async () => {
    installRoutes();
    render(
      <WorkspaceAdvancedPanel accessToken="token" workspaceId="ws-1" canManage={false} />,
    );

    await waitFor(() => expect(screen.getByTestId('workspace-advanced-panel')).toBeInTheDocument());
    expect(screen.queryByTestId('branding-save-button')).not.toBeInTheDocument();
  });
});
