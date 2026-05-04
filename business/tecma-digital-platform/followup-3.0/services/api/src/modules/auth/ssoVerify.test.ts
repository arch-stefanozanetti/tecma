import { describe, expect, it } from 'vitest';

import { verifySsoAccessToken } from './ssoVerify.js';

describe('verifySsoAccessToken', () => {
  it('rejects when JWKS URI is missing', async () => {
    await expect(
      verifySsoAccessToken('any.token.here', {
        SSO_JWKS_URI: undefined,
        SSO_JWT_ISSUER: undefined,
        SSO_JWT_AUDIENCE: undefined,
      }),
    ).rejects.toThrow('SSO not configured');
  });
});
