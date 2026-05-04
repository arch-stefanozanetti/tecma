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
  constructor(private readonly collection: Collection<T>) {}

  async findOne(filter: Filter<T>): Promise<any> {
    return this.collection.findOne(filter as any);
  }

  async findMany(filter: Filter<T>): Promise<any[]> {
    return this.collection.find(filter as any).toArray();
  }

  async create(doc: OptionalUnlessRequiredId<T>): Promise<InsertOneResult<T>> {
    assertWritableDatabase(this.collection, 'insertOne');
    return this.collection.insertOne(doc);
  }

  async updateOne(filter: Filter<T>, update: UpdateFilter<T>): Promise<UpdateResult<T>> {
    assertWritableDatabase(this.collection, 'updateOne');
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<T>): Promise<{ deletedCount: number }> {
    assertWritableDatabase(this.collection, 'deleteOne');
    const result = await this.collection.deleteOne(filter);
    return { deletedCount: result.deletedCount };
  }
}
