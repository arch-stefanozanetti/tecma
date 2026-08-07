import { afterEach, describe, expect, it } from 'vitest';

import { getAllowedWriteDbName } from './constants.js';

const originalAllowedWriteDb = process.env.ALLOWED_WRITE_DB;
const originalMongoDbName = process.env.MONGO_DB_NAME;

afterEach(() => {
  if (originalAllowedWriteDb == null) delete process.env.ALLOWED_WRITE_DB;
  else process.env.ALLOWED_WRITE_DB = originalAllowedWriteDb;

  if (originalMongoDbName == null) delete process.env.MONGO_DB_NAME;
  else process.env.MONGO_DB_NAME = originalMongoDbName;
});

describe('getAllowedWriteDbName', () => {
  it('requires an explicit write database even when MONGO_DB_NAME is set', () => {
    delete process.env.ALLOWED_WRITE_DB;
    process.env.MONGO_DB_NAME = 'legacy-followup';

    expect(() => getAllowedWriteDbName()).toThrow('ALLOWED_WRITE_DB is required');
  });

  it('returns the trimmed explicit write database', () => {
    process.env.ALLOWED_WRITE_DB = ' legacy-followup ';

    expect(getAllowedWriteDbName()).toBe('legacy-followup');
  });
});
