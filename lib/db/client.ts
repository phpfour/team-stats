import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "./schema";

export type DB = MySql2Database<typeof schema>;

// Module-level singleton. Next.js server components create many concurrent
// requests; we want one mysql pool per process, not per request.
let _db: DB | null = null;
let _pool: mysql.Pool | null = null;

function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Expected e.g. mysql://user:pass@host:3306/github_stats",
    );
  }
  _pool = mysql.createPool({
    uri: url,
    connectionLimit: 10,
    waitForConnections: true,
    // GitHub IDs fit in JS Number; tell mysql2 to return numeric types as
    // numbers (default returns DECIMAL/BIGINT as strings).
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: false,
  });
  return drizzle(_pool, { schema, mode: "default" });
}

/** Returns a shared drizzle handle. Safe to call from anywhere. */
export async function getDb(): Promise<DB> {
  if (!_db) _db = createDb();
  return _db;
}

/** Close the pool. Call from one-shot scripts (sync, backfill) before exit. */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}
