import { describe, expect, it } from 'vitest';

import { loggerRedactPaths } from './index.js';

describe('logger redaction', () => {
  it('covers secrets, auth headers and PII paths used by API domains', () => {
    expect(loggerRedactPaths).toEqual(
      expect.arrayContaining([
        'headers.authorization',
        'headers["x-api-key"]',
        'headers["x-workspace-platform-key"]',
        'req.headers.authorization',
        'req.headers["x-api-key"]',
        'req.headers["x-workspace-platform-key"]',
        'passwordHash',
        'refreshTokenHash',
        'token',
        '*.token',
        'tokenHash',
        'apiKey',
        'email',
        '*.email',
        'contactEmail',
        '*.contactEmail',
        'contactPhone',
        '*.contactPhone',
        'permissionsOverride',
        '*.permissionsOverride',
      ]),
    );
  });
});
