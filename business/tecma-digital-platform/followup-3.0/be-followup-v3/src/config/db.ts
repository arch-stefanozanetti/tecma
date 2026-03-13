import { Db, MongoClient } from "mongodb";
import { ENV } from "./env.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export const connectDb = async (): Promise<Db> => {
  if (db) return db;

  client = new MongoClient(ENV.MONGO_URI);
  await client.connect();
  db = client.db(ENV.MONGO_DB_NAME);
  return db;
};

export const getDb = (): Db => {
  if (!db) throw new Error("Database not initialized");
  return db;
};
