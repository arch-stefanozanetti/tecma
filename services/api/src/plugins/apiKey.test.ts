import { afterEach, describe, expect, it, vi } from 'vitest';

import { isDocumentationPath, isPublicApiPath } from './apiKey.js';

describe('isPublicApiPath', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('consente health, login, password recovery, SSO exchange e documentazione Swagger fuori produzione', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('APP_ENV', 'test');
    expect(isPublicApiPath('/v1/health')).toBe(true);
    expect(isPublicApiPath('/v1/health?verbose=1')).toBe(true);
    expect(isPublicApiPath('/v1/auth/login')).toBe(true);
    expect(isPublicApiPath('/v1/auth/forgot-password')).toBe(true);
    expect(isPublicApiPath('/v1/auth/reset-password')).toBe(true);
    expect(isPublicApiPath('/v1/auth/invite-accept')).toBe(true);
    expect(isPublicApiPath('/v1/auth/sso-exchange')).toBe(true);
    expect(isPublicApiPath('/v1/auth/refresh')).toBe(true);
    expect(isPublicApiPath('/v1/auth/logout')).toBe(true);
    expect(isPublicApiPath('/v1/docs')).toBe(true);
    expect(isPublicApiPath('/v1/docs/static/foo.js')).toBe(true);
    expect(isPublicApiPath('/v1/openapi.json')).toBe(true);
  });

  it('protegge Swagger/OpenAPI in produzione', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ENV', 'prod');
    expect(isPublicApiPath('/v1/docs')).toBe(false);
    expect(isPublicApiPath('/v1/docs/static/foo.js')).toBe(false);
    expect(isPublicApiPath('/v1/openapi.json')).toBe(false);
    expect(isPublicApiPath('/v1/health')).toBe(true);
    expect(isPublicApiPath('/v1/auth/login')).toBe(true);
    expect(isPublicApiPath('/v1/auth/invite-accept')).toBe(true);
  });

  it('richiede API key sulle altre route', () => {
    expect(isPublicApiPath('/v1/auth/me')).toBe(false);
    expect(isPublicApiPath('/v1/projects')).toBe(false);
    expect(isPublicApiPath('/v1/auth/refresh')).toBe(false);
  });

  it('riconosce i path documentazione da disabilitare negli ambienti prod-like', () => {
    expect(isDocumentationPath('/v1/docs')).toBe(true);
    expect(isDocumentationPath('/v1/docs/static/foo.js')).toBe(true);
    expect(isDocumentationPath('/v1/openapi.json')).toBe(true);
    expect(isDocumentationPath('/v1/openapi.json?cache=0')).toBe(true);
    expect(isDocumentationPath('/v1/projects')).toBe(false);
  });
});
