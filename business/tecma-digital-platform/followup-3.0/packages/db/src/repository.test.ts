import { describe, expect, it, vi } from 'vitest';

import { ForbiddenDatabaseWriteError } from './errors.js';
import { MongoRepository } from './repository.js';

const makeCollection = (overrides: Record<string, unknown> = {}) =>
  ({
    dbName: process.env.ALLOWED_WRITE_DB ?? 'test-zanetti',
    collectionName: 'tz_users',
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
    ...overrides,
  }) as any;

describe('MongoRepository', () => {
  it('delegates reads to the underlying collection', async () => {
    const row = { email: 'user@tecma.test' };
    const rows = [row];
    const collection = makeCollection({
      findOne: vi.fn().mockResolvedValue(row),
      find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(rows) }),
    });
    const repo = new MongoRepository(collection);

    await expect(repo.findOne({ email: row.email })).resolves.toEqual(row);
    await expect(repo.findMany({ status: 'active' })).resolves.toEqual(rows);
    expect(collection.findOne).toHaveBeenCalledWith({ email: row.email });
    expect(collection.find).toHaveBeenCalledWith({ status: 'active' });
  });

  it('guards writes and returns write results', async () => {
    const insertResult = { insertedId: 'u1', acknowledged: true };
    const updateResult = { modifiedCount: 1, acknowledged: true };
    const collection = makeCollection({
      insertOne: vi.fn().mockResolvedValue(insertResult),
      updateOne: vi.fn().mockResolvedValue(updateResult),
      deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    });
    const repo = new MongoRepository(collection);

    await expect(repo.create({ email: 'user@tecma.test' })).resolves.toEqual(insertResult);
    await expect(repo.updateOne({ email: 'user@tecma.test' }, { $set: { status: 'active' } })).resolves.toEqual(
      updateResult,
    );
    await expect(repo.deleteOne({ email: 'user@tecma.test' })).resolves.toEqual({ deletedCount: 1 });
  });

  it('refuses writes outside the allowed database', async () => {
    const repo = new MongoRepository(makeCollection({ dbName: 'legacy-followup' }));

    await expect(repo.create({ email: 'blocked@tecma.test' })).rejects.toBeInstanceOf(
      ForbiddenDatabaseWriteError,
    );
    await expect(repo.updateOne({}, { $set: { status: 'active' } })).rejects.toBeInstanceOf(
      ForbiddenDatabaseWriteError,
    );
    await expect(repo.deleteOne({})).rejects.toBeInstanceOf(ForbiddenDatabaseWriteError);
  });
});
