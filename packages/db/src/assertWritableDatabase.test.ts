import { describe, expect, it } from 'vitest';

import { getAllowedWriteDbName } from './constants.js';
import { ForbiddenDatabaseWriteError } from './errors.js';
import { assertWritableDatabase } from './assertWritableDatabase.js';

describe('assertWritableDatabase', () => {
  it('allows writes on allowed db', () => {
    const col = { dbName: getAllowedWriteDbName(), collectionName: 'tz_users' } as any;
    expect(() => assertWritableDatabase(col, 'insertOne')).not.toThrow();
  });

  it('throws outside allowed db', () => {
    const col = { dbName: 'admin', collectionName: 'users' } as any;
    expect(() => assertWritableDatabase(col, 'insertOne')).toThrow(ForbiddenDatabaseWriteError);
  });
});
