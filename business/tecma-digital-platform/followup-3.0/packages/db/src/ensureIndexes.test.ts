import { afterEach, describe, expect, it, vi } from 'vitest';

import { ensureCoreIndexes } from './ensureIndexes.js';

const makeDb = (createIndex = vi.fn().mockResolvedValue('ok')) =>
  ({
    collection: vi.fn((name: string) => ({
      collectionName: name,
      createIndex,
    })),
  }) as any;

describe('ensureCoreIndexes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the core indexes in order', async () => {
    const createIndex = vi.fn().mockResolvedValue('ok');
    const db = makeDb(createIndex);

    await ensureCoreIndexes(db);

    expect(createIndex).toHaveBeenCalledTimes(19);
    expect(db.collection).toHaveBeenNthCalledWith(1, 'tz_users');
    expect(createIndex).toHaveBeenNthCalledWith(
      1,
      { email: 1 },
      { unique: true, name: 'tz_users_email_unique' },
    );
    expect(db.collection).toHaveBeenNthCalledWith(18, 'tz_roleDefinitions');
    expect(db.collection).toHaveBeenNthCalledWith(19, 'tz_users');
  });

  it('ignores benign existing index name conflicts', async () => {
    const createIndex = vi
      .fn()
      .mockRejectedValueOnce({
        codeName: 'IndexOptionsConflict',
        message: 'Index already exists with a different name',
      })
      .mockResolvedValue('ok');

    await expect(ensureCoreIndexes(makeDb(createIndex))).resolves.toBeUndefined();
    expect(createIndex).toHaveBeenCalledTimes(19);
  });

  it('logs and continues when duplicate data blocks a unique index build', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const createIndex = vi
      .fn()
      .mockRejectedValueOnce({
        code: 11000,
        message: 'Index build failed: duplicate key error collection: tz_projects index',
      })
      .mockResolvedValue('ok');

    await expect(ensureCoreIndexes(makeDb(createIndex))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('indice unique non creato'));
    expect(createIndex).toHaveBeenCalledTimes(19);
  });

  it('rethrows unexpected index creation errors', async () => {
    const error = new Error('network down');
    const createIndex = vi.fn().mockRejectedValue(error);

    await expect(ensureCoreIndexes(makeDb(createIndex))).rejects.toBe(error);
  });
});
