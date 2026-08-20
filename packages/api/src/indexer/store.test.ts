import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAddress, type Address, type Hash } from 'viem';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../db/schema.js';
import {
  MemoryIndexerStore,
  PostgresIndexerStore,
  type IndexerStore,
} from './store.js';
import type { IndexedCommunity, IndexedEvent } from './types.js';

const communityAddress = getAddress('0x1111111111111111111111111111111111111111');
const founder = getAddress('0x2222222222222222222222222222222222222222');
const txHash = `0x${'ab'.repeat(32)}` as Hash;

function sampleCommunity(overrides: Partial<IndexedCommunity> = {}): IndexedCommunity {
  return {
    address: communityAddress,
    name: 'Skateville',
    founders: [founder],
    deployedAtBlock: 12,
    deployedAtTimestamp: 1_700_000_000,
    transactionHash: txHash,
    logIndex: 0,
    ...overrides,
  };
}

function sampleEvent(overrides: Partial<IndexedEvent> = {}): IndexedEvent {
  return {
    id: `${txHash}:0`,
    eventName: 'CommunityDeployed',
    contractAddress: getAddress('0x5FbDB2315678afecb367f032d93F642f64180aa3'),
    communityAddress,
    blockNumber: 12,
    transactionHash: txHash,
    logIndex: 0,
    args: { communityAddress, name: 'Skateville' },
    ...overrides,
  };
}

function runStoreContract(name: string, createStore: () => Promise<IndexerStore>) {
  describe(name, () => {
    let store: IndexerStore;

    beforeEach(async () => {
      store = await createStore();
      await store.clear();
    });

    it('persists communities and resumes the last block cursor', async () => {
      expect(await store.getLastBlock()).toBeNull();
      await store.putCommunity(sampleCommunity());
      await store.putEvent(sampleEvent());
      await store.setLastBlock(12);

      expect(await store.getLastBlock()).toBe(12);
      expect(await store.countCommunities()).toBe(1);
      expect(await store.countEvents()).toBe(1);
      expect(await store.listCommunityAddresses()).toEqual([communityAddress]);

      const communities = await store.listCommunities();
      expect(communities[0]?.name).toBe('Skateville');
      expect(communities[0]?.founders).toEqual([founder]);

      await store.setLastBlock(11);
      expect(await store.getLastBlock()).toBe(12);
      await store.setLastBlock(40);
      expect(await store.getLastBlock()).toBe(40);
    });

    it('is idempotent for the same event id', async () => {
      await store.putEvent(sampleEvent());
      await store.putEvent(sampleEvent({ args: { name: 'ignored-duplicate' } }));
      expect(await store.countEvents()).toBe(1);
      const events = await store.listEvents();
      expect(events[0]?.args.name).toBe('Skateville');
    });
  });
}

runStoreContract('MemoryIndexerStore', async () => new MemoryIndexerStore());

describe('PostgresIndexerStore (pglite)', () => {
  let client: PGlite | undefined;

  async function createPostgresStore(): Promise<PostgresIndexerStore> {
    await client?.close();
    client = new PGlite();
    const migration = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../drizzle/0003_indexer.sql'),
      'utf8'
    );
    await client.exec(migration);
    const db = drizzle(client, { schema });
    return new PostgresIndexerStore(db);
  }

  runStoreContract('contract', createPostgresStore);

  afterEach(async () => {
    await client?.close();
    client = undefined;
  });
});

describe('address checksum', () => {
  it('normalizes community addresses', async () => {
    const store = new MemoryIndexerStore();
    await store.putCommunity(
      sampleCommunity({
        address: '0x1111111111111111111111111111111111111111' as Address,
      })
    );
    expect(await store.listCommunityAddresses()).toEqual([communityAddress]);
  });
});
