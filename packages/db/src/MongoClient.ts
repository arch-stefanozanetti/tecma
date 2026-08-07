import { MongoClient, type Db } from 'mongodb';

import { appLogger } from '@followup/logger';

import { getAllowedWriteDbName } from './constants.js';
import { DatabaseGuardConfigurationError } from './errors.js';

interface MongoClientFactoryOptions {
  mongoUri: string;
  mongoDbName: string;
  nodeEnv: string;
}

export class FollowupMongoClient {
  private client: MongoClient | null = null;

  constructor(private readonly options: MongoClientFactoryOptions) {}

  async connect(): Promise<void> {
    const allowed = getAllowedWriteDbName();
    if (this.options.mongoDbName !== allowed) {
      throw new DatabaseGuardConfigurationError(
        `[DB_GUARD] Invalid MONGO_DB_NAME='${this.options.mongoDbName}'. Allowed: '${allowed}'.`,
      );
    }

    this.client = new MongoClient(this.options.mongoUri);
    await this.client.connect();
    await this.checkPrivileges();
  }

  getDb(): Db {
    if (this.client == null)
      throw new DatabaseGuardConfigurationError('Mongo client not connected');
    return this.client.db(this.options.mongoDbName);
  }

  getReadOnlyDb(name: string): Db {
    if (this.client == null)
      throw new DatabaseGuardConfigurationError('Mongo client not connected');
    return this.client.db(name);
  }

  async close(): Promise<void> {
    if (this.client != null) {
      await this.client.close();
      this.client = null;
    }
  }

  private async checkPrivileges(): Promise<void> {
    if (this.client == null) return;
    const status = await this.client
      .db('admin')
      .command({ connectionStatus: 1, showPrivileges: true });
    const privileges = (status.authInfo?.authenticatedUserPrivileges ?? []) as Array<{
      resource?: { db?: string };
      actions?: string[];
    }>;

    const writableOutsideAllowedDb = privileges.some((privilege) => {
      const db = privilege.resource?.db;
      const actions = privilege.actions ?? [];
      const isWrite = actions.some((action) => ['insert', 'update', 'remove'].includes(action));
      return isWrite && db != null && db != '' && db !== getAllowedWriteDbName();
    });

    if (writableOutsideAllowedDb) {
      const message = `[DB_GUARD] Mongo user has write privileges outside '${getAllowedWriteDbName()}'.`;
      if (this.options.nodeEnv === 'production') throw new DatabaseGuardConfigurationError(message);
      appLogger.warn({ event: 'db.privilege.warning', message });
    }
  }
}
