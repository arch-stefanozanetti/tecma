import type { Collection, Document } from 'mongodb';

import { getAllowedWriteDbName } from './constants.js';
import { ForbiddenDatabaseWriteError } from './errors.js';

export const assertWritableDatabase = <T extends Document>(
  collection: Collection<T>,
  operation: string,
): void => {
  const allowed = getAllowedWriteDbName();
  if (collection.dbName !== allowed) {
    throw new ForbiddenDatabaseWriteError(
      collection.dbName,
      allowed,
      operation,
      collection.collectionName,
    );
  }
};
