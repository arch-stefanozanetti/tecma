import type {
  Collection,
  Document,
  Filter,
  InsertOneResult,
  OptionalUnlessRequiredId,
  UpdateFilter,
  UpdateResult,
} from 'mongodb';

import { assertWritableDatabase } from './assertWritableDatabase.js';

export class MongoRepository<T extends Document> {
  constructor(protected readonly collectionRef: Collection<T>) {}

  async findOne(filter: Filter<T>): Promise<any> {
    return this.collectionRef.findOne(filter as any);
  }

  async findMany(filter: Filter<T>): Promise<any[]> {
    return this.collectionRef.find(filter as any).toArray();
  }

  async create(doc: OptionalUnlessRequiredId<T>): Promise<InsertOneResult<T>> {
    assertWritableDatabase(this.collectionRef, 'insertOne');
    return this.collectionRef.insertOne(doc);
  }

  async updateOne(filter: Filter<T>, update: UpdateFilter<T>): Promise<UpdateResult<T>> {
    assertWritableDatabase(this.collectionRef, 'updateOne');
    return this.collectionRef.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<T>): Promise<{ deletedCount: number }> {
    assertWritableDatabase(this.collectionRef, 'deleteOne');
    const result = await this.collectionRef.deleteOne(filter);
    return { deletedCount: result.deletedCount };
  }
}
