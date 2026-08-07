import type {
  Collection,
  Document,
  Filter,
  InsertOneResult,
  OptionalUnlessRequiredId,
  Sort,
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

  async count(filter: Filter<T>): Promise<number> {
    return this.collectionRef.countDocuments(filter);
  }

  async listPaginated(
    filter: Filter<T>,
    options: {
      skip: number;
      limit: number;
      sort: Sort;
    },
  ): Promise<T[]> {
    return this.collectionRef
      .find(filter)
      .sort(options.sort)
      .skip(options.skip)
      .limit(options.limit)
      .toArray() as Promise<T[]>;
  }

  async create(doc: OptionalUnlessRequiredId<T>): Promise<InsertOneResult<T>> {
    assertWritableDatabase(this.collectionRef, 'insertOne');
    return this.collectionRef.insertOne(doc);
  }

  async updateOne(filter: Filter<T>, update: UpdateFilter<T>): Promise<UpdateResult<T>> {
    assertWritableDatabase(this.collectionRef, 'updateOne');
    return this.collectionRef.updateOne(filter, update);
  }

  async updateMany(filter: Filter<T>, update: UpdateFilter<T>): Promise<UpdateResult<T>> {
    assertWritableDatabase(this.collectionRef, 'updateMany');
    return this.collectionRef.updateMany(filter, update);
  }

  async deleteOne(filter: Filter<T>): Promise<{ deletedCount: number }> {
    assertWritableDatabase(this.collectionRef, 'deleteOne');
    const result = await this.collectionRef.deleteOne(filter);
    return { deletedCount: result.deletedCount };
  }

  async deleteMany(filter: Filter<T>): Promise<{ deletedCount: number }> {
    assertWritableDatabase(this.collectionRef, 'deleteMany');
    const result = await this.collectionRef.deleteMany(filter);
    return { deletedCount: result.deletedCount };
  }
}
