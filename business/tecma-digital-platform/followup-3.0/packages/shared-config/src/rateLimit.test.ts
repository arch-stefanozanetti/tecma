import { describe, expect, it } from 'vitest';

import { loadEnv, resolveRateLimitMax } from './index.js';

describe('resolveRateLimitMax', () => {
  it('usa default 2000 in development se API_RATE_LIMIT_MAX assente', () => {
    const c = loadEnv({
      ...minimalEnv(),
      NODE_ENV: 'development',
    });
    expect(resolveRateLimitMax(c)).toBe(2000);
  });

  it('usa default 100 in production se API_RATE_LIMIT_MAX assente', () => {
    const c = loadEnv({
      ...minimalEnv(),
      NODE_ENV: 'production',
    });
    expect(resolveRateLimitMax(c)).toBe(100);
  });

  it('rispetta API_RATE_LIMIT_MAX quando impostato', () => {
    const c = loadEnv({
      ...minimalEnv(),
      NODE_ENV: 'development',
      API_RATE_LIMIT_MAX: '500',
    });
    expect(resolveRateLimitMax(c)).toBe(500);
  });
});

function minimalEnv(): Record<string, string> {
  return {
    NODE_ENV: 'development',
    APP_ENV: 'dev-1',
    PORT: '8080',
    MONGO_URI: 'mongodb://localhost:27017/x',
    MONGO_DB_NAME: 'test-zanetti',
    ALLOWED_WRITE_DB: 'test-zanetti',
    AUTH_JWT_SECRET: 'x'.repeat(32),
    INTERNAL_API_KEY: '1234567890123456',
  };
}
