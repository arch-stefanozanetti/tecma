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
    updateMany: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
    ...overrides,
  }) as any;

describe('MongoRepository', () => {
  it('delegates reads to the underlying collection', async () => {
    const row = { email: 'user@tecma.test' };
    const rows = [row];
    const cursor = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue(rows),
    };
    const collection = makeCollection({
      findOne: vi.fn().mockResolvedValue(row),
      find: vi.fn().mockReturnValue(cursor),
      countDocuments: vi.fn().mockResolvedValue(7),
    });
    const repo = new MongoRepository(collection);

    await expect(repo.findOne({ email: row.email })).resolves.toEqual(row);
    await expect(repo.findMany({ status: 'active' })).resolves.toEqual(rows);
    await expect(repo.count({ status: 'active' })).resolves.toBe(7);
    await expect(
      repo.listPaginated({ status: 'active' }, { skip: 20, limit: 10, sort: { createdAt: -1 } }),
    ).resolves.toEqual(rows);
    expect(collection.findOne).toHaveBeenCalledWith({ email: row.email });
    expect(collection.find).toHaveBeenCalledWith({ status: 'active' });
    expect(collection.countDocuments).toHaveBeenCalledWith({ status: 'active' });
    expect(cursor.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(cursor.skip).toHaveBeenCalledWith(20);
    expect(cursor.limit).toHaveBeenCalledWith(10);
  });

  it('guards writes and returns write results', async () => {
    const insertResult = { insertedId: 'u1', acknowledged: true };
    const updateResult = { modifiedCount: 1, acknowledged: true };
    const updateManyResult = { modifiedCount: 2, acknowledged: true };
    const deleteManyResult = { deletedCount: 3 };
    const collection = makeCollection({
      insertOne: vi.fn().mockResolvedValue(insertResult),
      updateOne: vi.fn().mockResolvedValue(updateResult),
      updateMany: vi.fn().mockResolvedValue(updateManyResult),
      deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
      deleteMany: vi.fn().mockResolvedValue(deleteManyResult),
    });
    const repo = new MongoRepository(collection);

    await expect(repo.create({ email: 'user@tecma.test' })).resolves.toEqual(insertResult);
    await expect(
      repo.updateOne({ email: 'user@tecma.test' }, { $set: { status: 'active' } }),
    ).resolves.toEqual(updateResult);
    await expect(
      repo.updateMany({ status: 'invited' }, { $set: { status: 'active' } }),
    ).resolves.toEqual(updateManyResult);
    await expect(repo.deleteOne({ email: 'user@tecma.test' })).resolves.toEqual({
      deletedCount: 1,
    });
    await expect(repo.deleteMany({ status: 'expired' })).resolves.toEqual(deleteManyResult);
  });

  it('refuses writes outside the allowed database', async () => {
    const repo = new MongoRepository(makeCollection({ dbName: 'legacy-followup' }));

    await expect(repo.create({ email: 'blocked@tecma.test' })).rejects.toBeInstanceOf(
      ForbiddenDatabaseWriteError,
    );
    await expect(repo.updateOne({}, { $set: { status: 'active' } })).rejects.toBeInstanceOf(
      ForbiddenDatabaseWriteError,
    );
    await expect(repo.updateMany({}, { $set: { status: 'active' } })).rejects.toBeInstanceOf(
      ForbiddenDatabaseWriteError,
    );
    await expect(repo.deleteOne({})).rejects.toBeInstanceOf(ForbiddenDatabaseWriteError);
    await expect(repo.deleteMany({})).rejects.toBeInstanceOf(ForbiddenDatabaseWriteError);
  });
});
