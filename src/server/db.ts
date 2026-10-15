import { type Db, MongoClient } from "mongodb";

/**
 * One MongoDB connection for the whole server, reused across requests (and across hot reloads
 * in development). Reads MONGO_DB_URL, falling back to MONGO_DB_LEGACY_URL (a non-SRV
 * `mongodb://` string for networks that block SRV lookups). Returns null when neither is set,
 * so features that use the database can show "offline" instead of failing.
 */

const globalForMongo = globalThis as unknown as { __mongo?: Promise<MongoClient> };

export async function db(): Promise<Db | null> {
  const url = process.env.MONGO_DB_URL || process.env.MONGO_DB_LEGACY_URL;
  if (!url) return null;
  globalForMongo.__mongo ??= new MongoClient(url, { maxPoolSize: 5, serverSelectionTimeoutMS: 6000 }).connect();
  try {
    const client = await globalForMongo.__mongo;
    return client.db(process.env.MONGO_DB_NAME || "wouroud-city");
  } catch (error) {
    // Let the next request try again instead of caching a failed connection.
    globalForMongo.__mongo = undefined;
    throw error;
  }
}
