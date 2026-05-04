import { describe, expect, it } from 'vitest';

import { isPublicApiPath } from './apiKey.js';

describe('isPublicApiPath', () => {
  it('consente health, login e documentazione Swagger', () => {
    expect(isPublicApiPath('/v1/health')).toBe(true);
    expect(isPublicApiPath('/v1/health?verbose=1')).toBe(true);
    expect(isPublicApiPath('/v1/auth/login')).toBe(true);
    expect(isPublicApiPath('/v1/docs')).toBe(true);
    expect(isPublicApiPath('/v1/docs/static/foo.js')).toBe(true);
    expect(isPublicApiPath('/v1/openapi.json')).toBe(true);
  });

  it('richiede API key sulle altre route', () => {
    expect(isPublicApiPath('/v1/auth/me')).toBe(false);
    expect(isPublicApiPath('/v1/projects')).toBe(false);
    expect(isPublicApiPath('/v1/auth/refresh')).toBe(false);
  });
});
