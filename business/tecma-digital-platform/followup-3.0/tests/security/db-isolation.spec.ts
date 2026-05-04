import { describe, expect, it } from 'vitest';

import { getAllowedWriteDbName } from '../../packages/db/src/constants';
import { ForbiddenDatabaseWriteError } from '../../packages/db/src/errors';
import { assertWritableDatabase } from '../../packages/db/src/assertWritableDatabase';

describe('DB isolation policy', () => {
  it('allows writes only on test-zanetti', () => {
    const allowed = { dbName: getAllowedWriteDbName(), collectionName: 'tz_users' } as any;
    expect(() => assertWritableDatabase(allowed, 'insertOne')).not.toThrow();
  });

  it.each(['admin', 'config', 'test', 'analytics'])('blocks write on %s db', (dbName) => {
    const blocked = { dbName, collectionName: 'tz_users' } as any;
    expect(() => assertWritableDatabase(blocked, 'insertOne')).toThrow(ForbiddenDatabaseWriteError);
  });
});
