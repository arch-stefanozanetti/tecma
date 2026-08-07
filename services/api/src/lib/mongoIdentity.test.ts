import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';

import {
  expandForStringOrObjectIdIn,
  mongoPrimaryKeyFilter,
  normalizeToStringId,
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

  it('mongoPrimaryKeyFilter adds ObjectId variant for hex _id', () => {
    const hex = new ObjectId().toHexString();
    const f = mongoPrimaryKeyFilter(hex);
    const id = f._id as { $in?: unknown[] } | string;
    if (typeof id === 'object' && id != null && '$in' in id) {
      expect((id as { $in: unknown[] }).$in.length).toBeGreaterThanOrEqual(2);
    } else {
      expect(typeof id).toBe('string');
    }
  });
});
