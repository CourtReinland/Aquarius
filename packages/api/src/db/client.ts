import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

export type AquariusDb = PostgresJsDatabase<typeof schema>;

let sql: ReturnType<typeof postgres> | null = null;
let db: AquariusDb | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Shared Drizzle client for Agent Foundry (agents), durable auth, and indexer.
 * Returns null when DATABASE_URL is unset so callers can fall back to
 * JSON/in-memory stores.
 */
export function getDb(): AquariusDb | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  if (!db) {
    sql = postgres(url, { max: 8 });
    db = drizzle(sql, { schema });
  }

  return db;
}

/** Test helper — drop the cached client so the next getDb() reconnects. */
export async function __resetDbClientForTests(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 1 });
  }
  sql = null;
  db = null;
}
