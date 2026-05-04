import { createRemoteJWKSet, jwtVerify } from 'jose';

import type { AppConfig } from '@followup/shared-config';

export type SsoVerifiedClaims = { sub: string; email: string };

export const verifySsoAccessToken = async (
  rawToken: string,
  config: Pick<AppConfig, 'SSO_JWKS_URI' | 'SSO_JWT_ISSUER' | 'SSO_JWT_AUDIENCE'>,
): Promise<SsoVerifiedClaims> => {
  const jwksUri = config.SSO_JWKS_URI?.trim();
  if (jwksUri == null || jwksUri.length === 0) {
    throw new Error('SSO not configured');
  }

  const JWKS = createRemoteJWKSet(new URL(jwksUri));
  const verifyOptions: Parameters<typeof jwtVerify>[2] = {};
  if (config.SSO_JWT_ISSUER != null && config.SSO_JWT_ISSUER.length > 0) {
    verifyOptions.issuer = config.SSO_JWT_ISSUER;
  }
  if (config.SSO_JWT_AUDIENCE != null && config.SSO_JWT_AUDIENCE.length > 0) {
    verifyOptions.audience = config.SSO_JWT_AUDIENCE;
  }

  const { payload } = await jwtVerify(rawToken, JWKS, verifyOptions);
  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  if (sub.length === 0) {
    throw new Error('Missing sub');
  }

  const emailCandidate =
    (typeof payload.email === 'string' && payload.email.length > 0 && payload.email) ||
    (typeof payload.preferred_username === 'string' &&
      payload.preferred_username.length > 0 &&
      payload.preferred_username) ||
    `${sub}@sso.local`;

  return { sub, email: String(emailCandidate).trim().toLowerCase() };
};
