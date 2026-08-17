import { eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { getAddress, type Address } from 'viem';
import { getDb, isDatabaseConfigured } from '../db/client.js';
import * as schema from '../db/schema.js';
import { indexedCommunities, indexedEvents, indexerCursors } from '../db/schema.js';
import { DEFAULT_INDEXER_CURSOR_ID } from './env.js';
import type { IndexedCommunity, IndexedEvent } from './types.js';

export type IndexerDb = PgDatabase<any, typeof schema>;

export interface IndexerStore {
  getLastBlock(): Promise<number | null>;
  setLastBlock(block: number): Promise<void>;
  putCommunity(community: IndexedCommunity): Promise<void>;
  listCommunities(): Promise<IndexedCommunity[]>;
  listCommunityAddresses(): Promise<Address[]>;
  putEvent(event: IndexedEvent): Promise<void>;
  listEvents(limit?: number): Promise<IndexedEvent[]>;
  countEvents(): Promise<number>;
  countCommunities(): Promise<number>;
  clear(): Promise<void>;
}

function normalizeAddress(value: string): Address {
  return getAddress(value);
}

export class MemoryIndexerStore implements IndexerStore {
  private lastBlock: number | null = null;
  private readonly communities = new Map<string, IndexedCommunity>();
  private readonly events = new Map<string, IndexedEvent>();

  async getLastBlock(): Promise<number | null> {
    return this.lastBlock;
  }

  async setLastBlock(block: number): Promise<void> {
    if (this.lastBlock === null || block > this.lastBlock) {
      this.lastBlock = block;
    }
  }

  async putCommunity(community: IndexedCommunity): Promise<void> {
    const address = normalizeAddress(community.address);
    this.communities.set(address.toLowerCase(), { ...community, address });
  }

  async listCommunities(): Promise<IndexedCommunity[]> {
    return [...this.communities.values()].sort((a, b) => a.deployedAtBlock - b.deployedAtBlock);
  }

  async listCommunityAddresses(): Promise<Address[]> {
    return (await this.listCommunities()).map((row) => row.address);
  }

  async putEvent(event: IndexedEvent): Promise<void> {
    if (this.events.has(event.id)) return;
    this.events.set(event.id, event);
  }

  async listEvents(limit = 100): Promise<IndexedEvent[]> {
    return [...this.events.values()]
      .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex)
      .slice(0, limit);
  }

  async countEvents(): Promise<number> {
    return this.events.size;
  }

  async countCommunities(): Promise<number> {
    return this.communities.size;
  }

  async clear(): Promise<void> {
    this.lastBlock = null;
    this.communities.clear();
    this.events.clear();
  }
}

export class PostgresIndexerStore implements IndexerStore {
  constructor(
    private readonly db: IndexerDb,
    private readonly cursorId = DEFAULT_INDEXER_CURSOR_ID
  ) {}

  async getLastBlock(): Promise<number | null> {
    const rows = await this.db
      .select({ lastBlock: indexerCursors.lastBlock })
      .from(indexerCursors)
      .where(eq(indexerCursors.id, this.cursorId))
      .limit(1);
    return rows[0]?.lastBlock ?? null;
  }

  async setLastBlock(block: number): Promise<void> {
    const current = await this.getLastBlock();
    if (current !== null && block <= current) return;

    await this.db
      .insert(indexerCursors)
      .values({
        id: this.cursorId,
        lastBlock: block,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: indexerCursors.id,
        set: {
          lastBlock: block,
          updatedAt: new Date(),
        },
      });
  }

  async putCommunity(community: IndexedCommunity): Promise<void> {
    const address = normalizeAddress(community.address);
    await this.db
      .insert(indexedCommunities)
      .values({
        address,
        name: community.name,
        founders: community.founders,
        deployedAtBlock: community.deployedAtBlock,
        deployedAtTimestamp: community.deployedAtTimestamp,
        transactionHash: community.transactionHash,
        logIndex: community.logIndex,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: indexedCommunities.address,
        set: {
          name: community.name,
          founders: community.founders,
          deployedAtBlock: community.deployedAtBlock,
          deployedAtTimestamp: community.deployedAtTimestamp,
          transactionHash: community.transactionHash,
          logIndex: community.logIndex,
        },
      });
  }

  async listCommunities(): Promise<IndexedCommunity[]> {
    const rows = await this.db
      .select()
      .from(indexedCommunities)
      .orderBy(indexedCommunities.deployedAtBlock);
    return rows.map(communityFromRow);
  }

  async listCommunityAddresses(): Promise<Address[]> {
    return (await this.listCommunities()).map((row) => row.address);
  }

  async putEvent(event: IndexedEvent): Promise<void> {
    await this.db
      .insert(indexedEvents)
      .values({
        id: event.id,
        eventName: event.eventName,
        contractAddress: event.contractAddress,
        communityAddress: event.communityAddress,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        args: event.args,
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: indexedEvents.id });
  }

  async listEvents(limit = 100): Promise<IndexedEvent[]> {
    const rows = await this.db
      .select()
      .from(indexedEvents)
      .orderBy(indexedEvents.blockNumber, indexedEvents.logIndex)
      .limit(limit);
    return rows.map(eventFromRow);
  }

  async countEvents(): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(indexedEvents);
    return count ?? 0;
  }

  async countCommunities(): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(indexedCommunities);
    return count ?? 0;
  }

  async clear(): Promise<void> {
    await this.db.delete(indexedEvents);
    await this.db.delete(indexedCommunities);
    await this.db.delete(indexerCursors);
  }
}

function communityFromRow(row: typeof indexedCommunities.$inferSelect): IndexedCommunity {
  const founders = Array.isArray(row.founders)
    ? (row.founders as string[]).filter((value) => typeof value === 'string')
    : [];
  return {
    address: normalizeAddress(row.address),
    name: row.name,
    founders: founders.map((value) => normalizeAddress(value)),
    deployedAtBlock: row.deployedAtBlock,
    deployedAtTimestamp: row.deployedAtTimestamp,
    transactionHash: row.transactionHash as IndexedCommunity['transactionHash'],
    logIndex: row.logIndex,
  };
}

function eventFromRow(row: typeof indexedEvents.$inferSelect): IndexedEvent {
  return {
    id: row.id,
    eventName: row.eventName,
    contractAddress: normalizeAddress(row.contractAddress),
    communityAddress: row.communityAddress ? normalizeAddress(row.communityAddress) : null,
    blockNumber: row.blockNumber,
    transactionHash: row.transactionHash as IndexedEvent['transactionHash'],
    logIndex: row.logIndex,
    args: (row.args ?? {}) as Record<string, unknown>,
  };
}

let store: IndexerStore | null = null;

export function getIndexerStore(): IndexerStore {
  if (!store) {
    store = createIndexerStore();
  }
  return store;
}

export function createIndexerStore(): IndexerStore {
  const db = getDb();
  if (db && isDatabaseConfigured()) {
    return new PostgresIndexerStore(db);
  }
  return new MemoryIndexerStore();
}

export function __setIndexerStoreForTests(next: IndexerStore): void {
  store = next;
}

export async function __resetIndexerStoreForTests(): Promise<void> {
  if (store) {
    await store.clear();
  }
  store = new MemoryIndexerStore();
}
