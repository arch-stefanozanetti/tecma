import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { http, isHttpApiError } from './http';
import type { HttpApiError } from './httpError';

describe('http() con fetch mock', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('401 JSON lancia HttpApiError', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          error: { message: 'Missing or invalid x-api-key', status: 401 },
        }),
    } as Response);

    try {
      await http('/workspaces', { method: 'GET', accessToken: 'test-token', apiKey: 'short' });
      expect.fail('atteso throw');
    } catch (e: unknown) {
      expect(isHttpApiError(e)).toBe(true);
      expect((e as HttpApiError).kind).toBe('unauthorized');
    }
  });

  it('fallimento fetch lancia HttpApiError di tipo network', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    try {
      await http('/workspaces', { method: 'GET', accessToken: 't' });
      expect.fail('atteso throw');
    } catch (e: unknown) {
      expect(isHttpApiError(e)).toBe(true);
      expect((e as HttpApiError).kind).toBe('network');
    }
  });
});
