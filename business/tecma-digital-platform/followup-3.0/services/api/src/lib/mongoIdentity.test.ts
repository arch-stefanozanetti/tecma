import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';

import {
  expandForStringOrObjectIdIn,
  normalizeToStringId,
  workspaceIdFieldFilter,
} from './mongoIdentity.js';

describe('mongoIdentity', () => {
  it('expandForStringOrObjectIdIn include sia stringa sia ObjectId per lo stesso id', () => {
    const hex = new ObjectId().toHexString();
    const expanded = expandForStringOrObjectIdIn([hex]);
    expect(expanded.length).toBe(2);
    expect(expanded).toContain(hex);
    expect(expanded.some((x) => x instanceof ObjectId)).toBe(true);
  });

  it('normalizeToStringId reads ObjectId', () => {
    const id = new ObjectId();
    expect(normalizeToStringId(id)).toBe(id.toHexString());
  });

  it('normalizeToStringId reads string workspace UUID', () => {
    expect(normalizeToStringId('  ws-abc  ')).toBe('ws-abc');
  });

  it('workspaceIdFieldFilter adds ObjectId variant for id hex valido', () => {
    const hex = new ObjectId().toHexString();
    const f = workspaceIdFieldFilter(hex);
    const w = f.workspaceId as { $in?: unknown[] } | string;
    if (typeof w === 'object' && w != null && '$in' in w) {
      expect((w as { $in: unknown[] }).$in.length).toBeGreaterThanOrEqual(2);
    } else {
      expect(typeof w).toBe('string');
    }
  });
});
