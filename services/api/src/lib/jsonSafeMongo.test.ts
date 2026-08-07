import { describe, expect, it } from 'vitest';
import { Long, ObjectId } from 'mongodb';

import { jsonSafeReplacer, serializeRecordForJsonApi } from './jsonSafeMongo.js';

describe('jsonSafeMongo', () => {
  it('jsonSafeReplacer normalizza ObjectId e Date', () => {
    const oid = new ObjectId('65f000000000000000000001');
    const d = new Date('2025-01-01T00:00:00.000Z');
    const out = JSON.parse(JSON.stringify({ oid, d }, jsonSafeReplacer)) as {
      oid: string;
      d: string;
    };
    expect(out.oid).toBe('65f000000000000000000001');
    expect(out.d).toBe('2025-01-01T00:00:00.000Z');
  });

  it('jsonSafeReplacer normalizza bigint e Long BSON', () => {
    const longVal = Long.fromBigInt(9007199254740993n);
    const out = JSON.parse(JSON.stringify({ n: 1n, l: longVal }, jsonSafeReplacer)) as {
      n: string;
      l: string;
    };
    expect(out.n).toBe('1');
    expect(out.l).toBe('9007199254740993');
  });

  it('serializeRecordForJsonApi produce oggetto JSON-serializzabile', () => {
    const row = {
      _id: new ObjectId('65f000000000000000000001'),
      email: 'a@b.test',
      legacyLongField: Long.fromBigInt(42n),
    } as Record<string, unknown>;
    const safe = serializeRecordForJsonApi(row);
    expect(safe._id).toBe('65f000000000000000000001');
    expect(safe.email).toBe('a@b.test');
    expect(safe.legacyLongField).toBe('42');
    expect(() => JSON.stringify(safe)).not.toThrow();
  });

  it('jsonSafeReplacer codifica Binary BSON in base64', () => {
    const buf = new ArrayBuffer(2);
    const view = new Uint8Array(buf);
    view[0] = 0xab;
    view[1] = 0xcd;
    const binaryLike = { _bsontype: 'Binary', buffer: buf } as unknown;
    const out = JSON.parse(JSON.stringify({ b: binaryLike }, jsonSafeReplacer)) as { b: string };
    expect(out.b).toBe(Buffer.from([0xab, 0xcd]).toString('base64'));
  });
});
