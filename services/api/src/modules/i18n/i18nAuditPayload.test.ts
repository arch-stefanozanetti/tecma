import { describe, expect, it } from 'vitest';

import { i18nAuditPayloadFromBody } from './i18nAuditPayload.js';

describe('i18nAuditPayloadFromBody', () => {
  it('derives bytes and sha prefix from messages', () => {
    const out = i18nAuditPayloadFromBody({ messages: { a: 'b' } });
    expect(out.messagesBytes).toBeGreaterThan(0);
    expect(out.messagesSha256Prefix).toHaveLength(16);
  });

  it('derives from patch for PATCH body', () => {
    const out = i18nAuditPayloadFromBody({ patch: { x: 1 } });
    expect(out.messagesBytes).toBeGreaterThan(0);
    expect(out.messagesSha256Prefix).toHaveLength(16);
  });

  it('returns zeros for invalid body', () => {
    expect(i18nAuditPayloadFromBody(null)).toEqual({ messagesBytes: 0, messagesSha256Prefix: '' });
    expect(i18nAuditPayloadFromBody({})).toEqual({ messagesBytes: 0, messagesSha256Prefix: '' });
  });
});
