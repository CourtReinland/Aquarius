import { createHash } from 'node:crypto';
import { and, asc, eq, gt, lte, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { getDb, isDatabaseConfigured } from './client.js';
import * as schema from './schema.js';
import { authChallenges, authSessions } from './schema.js';

/** Drizzle Postgres database (postgres-js in production, pglite in tests). */
export type AuthDb = PgDatabase<any, typeof schema>;

export const MAX_CHALLENGES = 2_000;

export interface ChallengeRecord {
  address: `0x${string}`;
  chainId: number;
  nonce: string;
  message: string;
  issuedAt: string;
  expirationTime: string;
}

export interface SessionRecord {
  sessionId: string;
  address: `0x${string}`;
  chainId: number;
  issuedAt: string;
  expiresAt: string;
}

export interface AuthStore {
  putChallenge(record: ChallengeRecord): Promise<void>;
  /** Read without consuming. Expired rows are deleted and treated as missing. */
  getChallenge(nonce: string): Promise<ChallengeRecord | null>;
  /** Atomically delete-and-return so a nonce cannot be verified twice. */
  consumeChallenge(nonce: string): Promise<ChallengeRecord | null>;
  deleteChallenge(nonce: string): Promise<void>;
  putSession(token: string, session: SessionRecord): Promise<void>;
  getSession(token: string): Promise<SessionRecord | null>;
  deleteSession(token: string): Promise<void>;
  purgeExpired(now?: number): Promise<void>;
  clear(): Promise<void>;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export class MemoryAuthStore implements AuthStore {
  private readonly challenges = new Map<string, ChallengeRecord>();
  private readonly sessions = new Map<string, SessionRecord>();

  async putChallenge(record: ChallengeRecord): Promise<void> {
    await this.purgeExpired();

    if (this.challenges.size >= MAX_CHALLENGES) {
      const oldest = [...this.challenges.entries()].sort(
        (a, b) => Date.parse(a[1].issuedAt) - Date.parse(b[1].issuedAt)
      )[0];
      if (oldest) this.challenges.delete(oldest[0]);
    }

    this.challenges.set(record.nonce, record);
  }

  async getChallenge(nonce: string): Promise<ChallengeRecord | null> {
    const record = this.challenges.get(nonce);
    if (!record) return null;
    if (Date.parse(record.expirationTime) <= Date.now()) {
      this.challenges.delete(nonce);
      return null;
    }
    return record;
  }

  async consumeChallenge(nonce: string): Promise<ChallengeRecord | null> {
    const record = await this.getChallenge(nonce);
    if (!record) return null;
    this.challenges.delete(nonce);
    return record;
  }

  async deleteChallenge(nonce: string): Promise<void> {
    this.challenges.delete(nonce);
  }

  async putSession(token: string, session: SessionRecord): Promise<void> {
    await this.purgeExpired();
    this.sessions.set(hashSessionToken(token), session);
  }

  async getSession(token: string): Promise<SessionRecord | null> {
    const key = hashSessionToken(token);
    const record = this.sessions.get(key);
    if (!record) return null;
    if (Date.parse(record.expiresAt) <= Date.now()) {
      this.sessions.delete(key);
      return null;
    }
    return record;
  }

  async deleteSession(token: string): Promise<void> {
    this.sessions.delete(hashSessionToken(token));
  }

  async purgeExpired(now = Date.now()): Promise<void> {
    for (const [nonce, record] of this.challenges) {
      if (Date.parse(record.expirationTime) <= now) {
        this.challenges.delete(nonce);
      }
    }
    for (const [tokenHash, record] of this.sessions) {
      if (Date.parse(record.expiresAt) <= now) {
        this.sessions.delete(tokenHash);
      }
    }
  }

  async clear(): Promise<void> {
    this.challenges.clear();
    this.sessions.clear();
  }
}

export class PostgresAuthStore implements AuthStore {
  constructor(private readonly db: AuthDb) {}

  async putChallenge(record: ChallengeRecord): Promise<void> {
    await this.purgeExpired();

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(authChallenges);

    if ((count ?? 0) >= MAX_CHALLENGES) {
      const oldest = await this.db
        .select({ nonce: authChallenges.nonce })
        .from(authChallenges)
        .orderBy(asc(authChallenges.issuedAt))
        .limit(1);
      if (oldest[0]) {
        await this.db.delete(authChallenges).where(eq(authChallenges.nonce, oldest[0].nonce));
      }
    }

    await this.db.insert(authChallenges).values({
      nonce: record.nonce,
      address: record.address,
      chainId: record.chainId,
      message: record.message,
      issuedAt: new Date(record.issuedAt),
      expirationTime: new Date(record.expirationTime),
    });
  }

  async getChallenge(nonce: string): Promise<ChallengeRecord | null> {
    const rows = await this.db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.nonce, nonce))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.expirationTime.getTime() <= Date.now()) {
      await this.deleteChallenge(nonce);
      return null;
    }
    return this.challengeFromRow(row);
  }

  async consumeChallenge(nonce: string): Promise<ChallengeRecord | null> {
    const deleted = await this.db
      .delete(authChallenges)
      .where(
        and(
          eq(authChallenges.nonce, nonce),
          gt(authChallenges.expirationTime, new Date())
        )
      )
      .returning();
    const row = deleted[0];
    if (!row) {
      await this.deleteChallenge(nonce);
      return null;
    }
    return this.challengeFromRow(row);
  }

  async deleteChallenge(nonce: string): Promise<void> {
    await this.db.delete(authChallenges).where(eq(authChallenges.nonce, nonce));
  }

  async putSession(token: string, session: SessionRecord): Promise<void> {
    await this.purgeExpired();
    await this.db.insert(authSessions).values({
      sessionId: session.sessionId,
      tokenHash: hashSessionToken(token),
      address: session.address,
      chainId: session.chainId,
      issuedAt: new Date(session.issuedAt),
      expiresAt: new Date(session.expiresAt),
    });
  }

  async getSession(token: string): Promise<SessionRecord | null> {
    const tokenHash = hashSessionToken(token);
    const rows = await this.db
      .select()
      .from(authSessions)
      .where(eq(authSessions.tokenHash, tokenHash))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.deleteSession(token);
      return null;
    }
    return this.sessionFromRow(row);
  }

  async deleteSession(token: string): Promise<void> {
    await this.db.delete(authSessions).where(eq(authSessions.tokenHash, hashSessionToken(token)));
  }

  async purgeExpired(now = Date.now()): Promise<void> {
    const cutoff = new Date(now);
    await this.db.delete(authChallenges).where(lte(authChallenges.expirationTime, cutoff));
    await this.db.delete(authSessions).where(lte(authSessions.expiresAt, cutoff));
  }

  async clear(): Promise<void> {
    await this.db.delete(authChallenges);
    await this.db.delete(authSessions);
  }

  private challengeFromRow(row: typeof authChallenges.$inferSelect): ChallengeRecord {
    return {
      address: row.address as `0x${string}`,
      chainId: row.chainId,
      nonce: row.nonce,
      message: row.message,
      issuedAt: toIso(row.issuedAt),
      expirationTime: toIso(row.expirationTime),
    };
  }

  private sessionFromRow(row: typeof authSessions.$inferSelect): SessionRecord {
    return {
      sessionId: row.sessionId,
      address: row.address as `0x${string}`,
      chainId: row.chainId,
      issuedAt: toIso(row.issuedAt),
      expiresAt: toIso(row.expiresAt),
    };
  }
}

let store: AuthStore | null = null;

export function getAuthStore(): AuthStore {
  if (!store) {
    store = createAuthStore();
  }
  return store;
}

export function createAuthStore(): AuthStore {
  const db = getDb();
  if (db && isDatabaseConfigured()) {
    return new PostgresAuthStore(db);
  }
  return new MemoryAuthStore();
}

/** Test helper — swap the process-wide store (memory or injected postgres/pglite). */
export function __setAuthStoreForTests(next: AuthStore): void {
  store = next;
}

export async function __resetAuthStoreForTests(): Promise<void> {
  if (store) {
    await store.clear();
  }
  store = new MemoryAuthStore();
}
