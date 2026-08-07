import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({ type: 'mock-jwks' })),
  jwtVerify: vi.fn(),
}));

import { createRemoteJWKSet, jwtVerify } from 'jose';

import { verifySsoAccessToken } from './ssoVerify.js';

const baseConfig = {
  SSO_JWKS_URI: 'https://idp.example/.well-known/jwks.json',
  SSO_JWT_ISSUER: undefined as string | undefined,
  SSO_JWT_AUDIENCE: undefined as string | undefined,
};

const verifiedToken = (payload: Record<string, unknown>): Awaited<ReturnType<typeof jwtVerify>> =>
  ({
    payload,
    protectedHeader: { alg: 'RS256' },
  }) as unknown as Awaited<ReturnType<typeof jwtVerify>>;

describe('verifySsoAccessToken', () => {
  beforeEach(() => {
    vi.mocked(createRemoteJWKSet).mockClear();
    vi.mocked(jwtVerify).mockReset();
  });

  it('rejects when JWKS URI is missing', async () => {
    await expect(
      verifySsoAccessToken('any.token.here', {
        SSO_JWKS_URI: undefined,
        SSO_JWT_ISSUER: undefined,
        SSO_JWT_AUDIENCE: undefined,
      }),
    ).rejects.toThrow('SSO not configured');
  });

  it('rejects when JWKS URI is only whitespace', async () => {
    await expect(
      verifySsoAccessToken('any', {
        SSO_JWKS_URI: '   ',
        SSO_JWT_ISSUER: undefined,
        SSO_JWT_AUDIENCE: undefined,
      }),
    ).rejects.toThrow('SSO not configured');
  });

  it('passes trimmed JWKS URL to createRemoteJWKSet', async () => {
    vi.mocked(jwtVerify).mockResolvedValue(verifiedToken({ sub: 'u1', email: 'a@b.co' }));

    await verifySsoAccessToken('raw', {
      ...baseConfig,
      SSO_JWKS_URI: '  https://idp/jwks  ',
    });

    expect(createRemoteJWKSet).toHaveBeenCalledWith(new URL('https://idp/jwks'));
  });

  it('omits issuer and audience when unset or empty', async () => {
    vi.mocked(jwtVerify).mockResolvedValue(verifiedToken({ sub: 's', email: 'e@x.com' }));

    await verifySsoAccessToken('t', {
      ...baseConfig,
      SSO_JWT_ISSUER: '',
      SSO_JWT_AUDIENCE: '',
    });

    expect(jwtVerify).toHaveBeenCalledWith('t', { type: 'mock-jwks' }, {});
  });

  it('sets issuer and audience when provided', async () => {
    vi.mocked(jwtVerify).mockResolvedValue(verifiedToken({ sub: 's', email: 'e@x.com' }));

    await verifySsoAccessToken('t', {
      ...baseConfig,
      SSO_JWT_ISSUER: 'https://issuer',
      SSO_JWT_AUDIENCE: 'my-api',
    });

    expect(jwtVerify).toHaveBeenCalledWith(
      't',
      { type: 'mock-jwks' },
      { issuer: 'https://issuer', audience: 'my-api' },
    );
  });

  it('rejects when sub is missing', async () => {
    vi.mocked(jwtVerify).mockResolvedValue(verifiedToken({ email: 'e@x.com' }));

    await expect(verifySsoAccessToken('t', baseConfig)).rejects.toThrow('Missing sub');
  });

  it('rejects when sub is empty string', async () => {
    vi.mocked(jwtVerify).mockResolvedValue(verifiedToken({ sub: '', email: 'e@x.com' }));

    await expect(verifySsoAccessToken('t', baseConfig)).rejects.toThrow('Missing sub');
  });

  it('normalizes email to lowercase', async () => {
    vi.mocked(jwtVerify).mockResolvedValue(verifiedToken({ sub: 's1', email: 'User@DOMAIN.COM' }));

    await expect(verifySsoAccessToken('t', baseConfig)).resolves.toEqual({
      sub: 's1',
      email: 'user@domain.com',
    });
  });

  it('uses preferred_username when email absent', async () => {
    vi.mocked(jwtVerify).mockResolvedValue(
      verifiedToken({ sub: 's1', preferred_username: 'AliasUser' }),
    );

    await expect(verifySsoAccessToken('t', baseConfig)).resolves.toEqual({
      sub: 's1',
      email: 'aliasuser',
    });
  });

  it('falls back to sub@sso.local when email and preferred_username absent', async () => {
    vi.mocked(jwtVerify).mockResolvedValue(verifiedToken({ sub: 'ext-42' }));

    await expect(verifySsoAccessToken('t', baseConfig)).resolves.toEqual({
      sub: 'ext-42',
      email: 'ext-42@sso.local',
    });
  });

  it('propagates jwtVerify errors (expired, bad signature, issuer mismatch)', async () => {
    vi.mocked(jwtVerify).mockRejectedValue(new Error('jwt expired'));

    await expect(verifySsoAccessToken('t', baseConfig)).rejects.toThrow('jwt expired');
  });
});
