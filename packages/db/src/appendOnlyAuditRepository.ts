import type {
  Collection,
  Document,
  Filter,
  InsertOneResult,
  OptionalUnlessRequiredId,
  UpdateFilter,
  UpdateResult,
} from 'mongodb';

import { AppendOnlyAuditMutationError } from './errors.js';
import { MongoRepository } from './repository.js';

/**
 * Repository append-only per trail di audit (`tz_authEvents`): vietate mutazioni
 * dopo insert (coerenza PR40 / integrità forense).
 */
export class AppendOnlyAuditRepository<T extends Document> extends MongoRepository<T> {
  private readonly auditCollectionName: string;

  constructor(collection: Collection<T>) {
    super(collection);
    this.auditCollectionName = collection.collectionName;
  }

  override async updateOne(_filter: Filter<T>, _update: UpdateFilter<T>): Promise<UpdateResult<T>> {
    throw new AppendOnlyAuditMutationError(this.auditCollectionName, 'updateOne');
  }

  override async deleteOne(_filter: Filter<T>): Promise<{ deletedCount: number }> {
    throw new AppendOnlyAuditMutationError(this.auditCollectionName, 'deleteOne');
  }

  /**
   * Mantiene la stessa API di `MongoRepository` (insert permesso).
   */
  override async create(doc: OptionalUnlessRequiredId<T>): Promise<InsertOneResult<T>> {
    return super.create(doc);
  }
}
