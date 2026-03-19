import { Db, MongoClient } from "mongodb";
import { ENV } from "./env.js";
import { logger } from "../observability/logger.js";

let client: MongoClient | null = null;
let db: Db | null = null;
let connectedUri: string | null = null;
let connectedDbName: string | null = null;

function targetUri(): string {
  return process.env.MONGO_URI || ENV.MONGO_URI;
}

function targetDbName(): string {
  return process.env.MONGO_DB_NAME || ENV.MONGO_DB_NAME;
}

export const connectDb = async (): Promise<Db> => {
  const uri = targetUri();
  const name = targetDbName();
  if (
    db &&
    client &&
    connectedUri === uri &&
    connectedDbName === name
  ) {
    return db;
  }
  if (client) {
    await client.close().catch((err) => {
      logger.warn({ err }, "[db] close previous client failed during reconnect");
    });
    client = null;
    db = null;
    connectedUri = null;
    connectedDbName = null;
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(name);
  connectedUri = uri;
  connectedDbName = name;
  return db;
};

export const getDb = (): Db => {
  if (!db) throw new Error("Database not initialized");
  return db;
};

export const getMongoClient = (): MongoClient => {
  if (!client) throw new Error("Database not initialized");
  return client;
};

/** Chiude la connessione (per test integration che cambiano MONGO_URI tra file). */
export const disconnectDb = async (): Promise<void> => {
  if (client) {
    await client.close().catch((err) => {
      logger.warn({ err }, "[db] close client failed during disconnect");
    });
    client = null;
    db = null;
    connectedUri = null;
    connectedDbName = null;
  }
};
