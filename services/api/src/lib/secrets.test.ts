import { afterEach, describe, expect, it } from 'vitest';

import { decryptSecret, encryptSecret } from './secrets.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalAppEnv = process.env.APP_ENV;
const originalSecretsKey = process.env.APP_SECRETS_KEY;

describe('secrets', () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.APP_ENV = originalAppEnv;
    process.env.APP_SECRETS_KEY = originalSecretsKey;
  });

  it('uses fallback key in development/test when APP_SECRETS_KEY is missing', () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_ENV = 'dev-1';
    delete process.env.APP_SECRETS_KEY;
    expect(encryptSecret('demo-secret')).toMatch(/^enc:v1:/);
  });

  it('decrypts encrypted secrets with the configured key', () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_ENV = 'dev-1';
    delete process.env.APP_SECRETS_KEY;
    const encrypted = encryptSecret('totp-secret');
    expect(decryptSecret(encrypted)).toBe('totp-secret');
  });

  it('fails fast in strict environments when APP_SECRETS_KEY is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'prod';
    delete process.env.APP_SECRETS_KEY;
    expect(() => encryptSecret('demo-secret')).toThrow(
      'APP_SECRETS_KEY is required in staging/production environments',
    );
  });
});
