import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

export interface InMemoryMongoContext {
  mongoServer: MongoMemoryServer;
  client: MongoClient;
  uri: string;
}

export const startInMemoryMongo = async (): Promise<InMemoryMongoContext> => {
  const mongoServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });
  const uri = mongoServer.getUri();
  const client = new MongoClient(uri);
  await client.connect();
  process.env.ENABLE_POC_TZ_WRITES = '1';
  await client.db('test-zanetti').command({ ping: 1 });
  return { mongoServer, client, uri };
};

export const stopInMemoryMongo = async (ctx: InMemoryMongoContext): Promise<void> => {
  await ctx.client.close();
  await ctx.mongoServer.stop();
};
