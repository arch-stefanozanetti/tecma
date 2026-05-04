import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

import { getAllowedWriteDbName } from '../constants.js';

export interface InMemoryMongoContext {
  mongoServer: MongoMemoryServer;
  client: MongoClient;
  uri: string;
}

export const startInMemoryMongo = async (): Promise<InMemoryMongoContext> => {
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  const client = new MongoClient(uri);
  await client.connect();
  await client.db(getAllowedWriteDbName()).command({ ping: 1 });
  return { mongoServer, client, uri };
};

export const stopInMemoryMongo = async (ctx: InMemoryMongoContext): Promise<void> => {
  await ctx.client.close();
  await ctx.mongoServer.stop();
};
