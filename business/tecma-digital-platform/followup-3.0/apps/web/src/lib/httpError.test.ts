import { describe, expect, it } from 'vitest';

import {
  buildHttpApiErrorFromFailedFetch,
  buildHttpApiErrorFromResponse,
  formatUserFacingApiCopy,
  isHttpApiError,
  LOCAL_API_SETUP_HINT,
  mapApiErrorToUserCopy,
  toUserFacingApiCopyFromUnknown,
} from './httpError';

describe('buildHttpApiErrorFromResponse', () => {
  it('401 con messaggio x-api-key → unauthorized api_key', async () => {
    const res = {
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          error: { message: 'Missing or invalid x-api-key', code: 'Unauthorized', status: 401 },
        }),
    } as Response;
    const err = await buildHttpApiErrorFromResponse(res, '/workspaces');
    expect(isHttpApiError(err)).toBe(true);
    expect(err.kind).toBe('unauthorized');
    expect(err.unauthorizedBecause).toBe('api_key');
    expect(err.message).toContain('x-api-key');
  });

  it('401 con messaggio token → session (niente hint setup in mapper)', async () => {
    const res = {
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          error: { message: 'Missing or invalid token', status: 401 },
        }),
    } as Response;
    const err = await buildHttpApiErrorFromResponse(res, '/auth/me');
    expect(err.unauthorizedBecause).toBe('session');
    const copy = mapApiErrorToUserCopy(err);
    expect(copy.hint).toBeUndefined();
  });

  it('429 → rate_limited', async () => {
    const res = {
      ok: false,
      status: 429,
      text: async () => '',
    } as Response;
    const err = await buildHttpApiErrorFromResponse(res, '/auth/login');
    expect(err.kind).toBe('rate_limited');
    expect(mapApiErrorToUserCopy(err).hint).toBeDefined();
  });

  it('403 → http senza hint setup', async () => {
    const res = {
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({ error: { message: 'No access to this workspace', status: 403 } }),
    } as Response;
    const err = await buildHttpApiErrorFromResponse(res, '/v1/x');
    expect(err.kind).toBe('http');
    expect(mapApiErrorToUserCopy(err).hint).toBeUndefined();
  });
});

describe('buildHttpApiErrorFromFailedFetch', () => {
  it('incapsula errore di rete', () => {
    const err = buildHttpApiErrorFromFailedFetch('/workspaces', '/v1', new TypeError('Failed to fetch'));
    expect(err.kind).toBe('network');
    expect(err.message).toContain('/v1');
  });
});

describe('mapApiErrorToUserCopy', () => {
  it('401 api_key include hint unico con VITE/INTERNAL (centralizzato)', async () => {
    const res = {
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({ error: { message: 'Missing or invalid x-api-key', status: 401 } }),
    } as Response;
    const err = await buildHttpApiErrorFromResponse(res, '/auth/me');
    const copy = mapApiErrorToUserCopy(err);
    expect(copy.hint).toBe(LOCAL_API_SETUP_HINT);
    const formatted = formatUserFacingApiCopy(copy);
    expect(formatted).toContain('Missing or invalid');
    expect(formatted).toContain('VITE_API_KEY');
    expect(formatted.split('VITE_API_KEY').length - 1).toBe(1);
  });
});

describe('toUserFacingApiCopyFromUnknown', () => {
  it('passa attraverso HttpApiError', async () => {
    const res = {
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({ error: { message: 'Missing or invalid x-api-key', status: 401 } }),
    } as Response;
    const err = await buildHttpApiErrorFromResponse(res, '/x');
    const copy = toUserFacingApiCopyFromUnknown(err);
    expect(copy.hint).toBeDefined();
  });

  it('Error generico → solo titolo', () => {
    const copy = toUserFacingApiCopyFromUnknown(new Error('foo'));
    expect(copy).toEqual({ title: 'foo' });
  });
});
