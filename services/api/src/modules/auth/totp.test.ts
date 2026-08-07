import { describe, expect, it } from 'vitest';

import { buildTotpUri, generateTotpCode, verifyTotpCode } from './totp.js';

describe('totp', () => {
  it('generates RFC 6238 compatible 6-digit code', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const code = generateTotpCode(secret, { now: 1_700_000_000_000 });
    expect(code).toMatch(/^[0-9]{6}$/);
    expect(verifyTotpCode(secret, code, { now: 1_700_000_000_000 })).toBe(true);
  });

  it('rejects malformed or expired codes', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const now = 1_700_000_000_000;
    const code = generateTotpCode(secret, { now });
    expect(verifyTotpCode(secret, 'abcdef', { now })).toBe(false);
    expect(verifyTotpCode(secret, code, { now: now + 120_000 })).toBe(false);
  });

  it('builds otpauth URI for authenticator apps', () => {
    const uri = buildTotpUri({
      issuer: 'Followup 3.0',
      accountName: 'user@example.com',
      secret: 'JBSWY3DPEHPK3PXP',
    });
    expect(uri).toContain('otpauth://totp/Followup%203.0%3Auser%40example.com');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
  });
});
