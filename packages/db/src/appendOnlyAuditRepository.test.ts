import { describe, expect, it, vi } from 'vitest';

import { AppendOnlyAuditRepository } from './appendOnlyAuditRepository.js';
import { AppendOnlyAuditMutationError } from './errors.js';

const makeCollection = (name = 'tz_authEvents') =>
  ({
    dbName: process.env.ALLOWED_WRITE_DB ?? 'test-zanetti',
    collectionName: name,
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn().mockResolvedValue({ insertedId: 'e1', acknowledged: true }),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
  }) as any;

describe('AppendOnlyAuditRepository', () => {
  it('allows create (insertOne)', async () => {
    const collection = makeCollection();
    const repo = new AppendOnlyAuditRepository(collection);
    const doc = { _id: 'x', eventType: 'test', userId: 'u', createdAt: new Date().toISOString() };
    await expect(repo.create(doc as any)).resolves.toBeDefined();
    expect(collection.insertOne).toHaveBeenCalled();
  });

  it('rejects updateOne and deleteOne', async () => {
    const repo = new AppendOnlyAuditRepository(makeCollection());
    await expect(repo.updateOne({}, { $set: {} } as any)).rejects.toBeInstanceOf(
      AppendOnlyAuditMutationError,
    );
    await expect(repo.deleteOne({})).rejects.toBeInstanceOf(AppendOnlyAuditMutationError);
  });
});
