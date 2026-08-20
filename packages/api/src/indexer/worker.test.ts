import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAddress, type Address, type Hash } from 'viem';
import { createApp } from '../app.js';
import {
  ANVIL_COMMUNITY_FACTORY,
  ANVIL_GOVERNANCE_MODULE,
} from './env.js';
import { MemoryIndexerStore, __resetIndexerStoreForTests, __setIndexerStoreForTests } from './store.js';
import {
  catchUp,
  getIndexerHealth,
  ingestLogs,
  __resetIndexerPublicClientForTests,
  __setIndexerPublicClientForTests,
} from './worker.js';
import type { DecodedIndexerLog, IndexerPublicClient } from './types.js';

const factory = ANVIL_COMMUNITY_FACTORY;
const governance = ANVIL_GOVERNANCE_MODULE;
const community = getAddress('0x1111111111111111111111111111111111111111');
const founder = getAddress('0x2222222222222222222222222222222222222222');
const txA = `0x${'aa'.repeat(32)}` as Hash;
const txB = `0x${'bb'.repeat(32)}` as Hash;
const txC = `0x${'cc'.repeat(32)}` as Hash;

function deployedLog(block: bigint): DecodedIndexerLog {
  return {
    eventName: 'CommunityDeployed',
    address: factory,
    blockNumber: block,
    transactionHash: txA,
    logIndex: 0,
    args: {
      communityAddress: community,
      name: 'Skateville',
      founders: [founder],
      timestamp: 1_700_000_012n,
    },
  };
}

function memberLog(block: bigint): DecodedIndexerLog {
  return {
    eventName: 'MemberAdded',
    address: community,
    blockNumber: block,
    transactionHash: txB,
    logIndex: 1,
    args: {
      member: founder,
      timestamp: 1_700_000_040n,
    },
  };
}

function proposalLog(block: bigint): DecodedIndexerLog {
  return {
    eventName: 'ProposalCreated',
    address: governance,
    blockNumber: block,
    transactionHash: txC,
    logIndex: 2,
    args: {
      proposalId: 1n,
      community,
      proposer: founder,
      title: 'Paint the ramp',
      startTime: 10n,
      endTime: 20n,
    },
  };
}

function mockClient(options: {
  head: bigint;
  onGetLogs?: (args: {
    address?: Address | Address[];
    fromBlock?: bigint;
    toBlock?: bigint;
  }) => DecodedIndexerLog[];
}): IndexerPublicClient & { calls: Array<{ fromBlock?: bigint; toBlock?: bigint; address?: Address | Address[] }> } {
  const calls: Array<{ fromBlock?: bigint; toBlock?: bigint; address?: Address | Address[] }> = [];
  return {
    calls,
    async getBlockNumber() {
      return options.head;
    },
    async getLogs(args) {
      calls.push({
        fromBlock: args.fromBlock,
        toBlock: args.toBlock,
        address: args.address,
      });
      return options.onGetLogs?.(args) ?? [];
    },
    watchContractEvent() {
      return () => {};
    },
  };
}

describe('indexer ingest + catch-up', () => {
  let store: MemoryIndexerStore;

  beforeEach(async () => {
    store = new MemoryIndexerStore();
    __setIndexerStoreForTests(store);
    __resetIndexerPublicClientForTests();
    delete process.env.AQUARIUS_RPC_URL;
    delete process.env.RPC_URL;
    delete process.env.INDEXER_START_BLOCK;
    delete process.env.AQUARIUS_COMMUNITY_FACTORY_ADDRESS;
    delete process.env.AQUARIUS_GOVERNANCE_ADDRESS;
    delete process.env.DATABASE_URL;
    delete process.env.AQUARIUS_ENV;
    delete process.env.NODE_ENV;
  });

  afterEach(async () => {
    await __resetIndexerStoreForTests();
    __resetIndexerPublicClientForTests();
    delete process.env.AQUARIUS_RPC_URL;
    delete process.env.RPC_URL;
    delete process.env.INDEXER_START_BLOCK;
  });

  it('ingests CommunityDeployed into the public community list', async () => {
    const result = await ingestLogs(store, [
      {
        eventName: 'CommunityDeployed',
        address: factory,
        blockNumber: 12n,
        transactionHash: txA,
        logIndex: 0,
        args: {
          communityAddress: community,
          name: 'Skateville',
          founders: [founder],
          timestamp: '1700000012',
        },
      },
    ]);

    expect(result.ingested).toBe(1);
    expect(result.lastBlock).toBe(12);
    const communities = await store.listCommunities();
    expect(communities).toHaveLength(1);
    expect(communities[0]).toMatchObject({
      address: community,
      name: 'Skateville',
      founders: [founder],
      deployedAtBlock: 12,
    });
  });

  it('resumes getLogs from last stored block + 1', async () => {
    process.env.INDEXER_START_BLOCK = '0';
    await store.setLastBlock(40);

    const client = mockClient({
      head: 50n,
      onGetLogs: ({ fromBlock, address }) =>
        fromBlock === 41n && address === factory ? [deployedLog(45n)] : [],
    });

    const result = await catchUp({ store, client, blockSpan: 2_000 });

    expect(result.fromBlock).toBe(41);
    expect(result.toBlock).toBe(50);
    expect(result.ingested).toBe(1);
    expect(await store.getLastBlock()).toBe(50);
    expect(client.calls[0]?.fromBlock).toBe(41n);
    expect(await store.listCommunities()).toHaveLength(1);
  });

  it('starts from INDEXER_START_BLOCK when no cursor exists', async () => {
    process.env.INDEXER_START_BLOCK = '10';
    const client = mockClient({ head: 12n });

    const result = await catchUp({ store, client });

    expect(result.fromBlock).toBe(10);
    expect(client.calls[0]?.fromBlock).toBe(10n);
    expect(await store.getLastBlock()).toBe(12);
  });

  it('pulls community and governance logs after discovering a factory deploy', async () => {
    const client = mockClient({
      head: 20n,
      onGetLogs: ({ address }) => {
        if (address === factory) return [deployedLog(8n)];
        if (Array.isArray(address) && address.includes(community)) return [memberLog(9n)];
        if (address === governance) return [proposalLog(10n)];
        return [];
      },
    });

    await catchUp({ store, client });

    expect(await store.countCommunities()).toBe(1);
    const events = await store.listEvents();
    expect(events.map((row) => row.eventName).sort()).toEqual([
      'CommunityDeployed',
      'MemberAdded',
      'ProposalCreated',
    ]);
    expect(events.find((row) => row.eventName === 'ProposalCreated')?.communityAddress).toBe(
      community
    );
  });

  it('builds a health payload with last block and rpc configured flag', async () => {
    await store.setLastBlock(77);
    const idle = await getIndexerHealth(store);
    expect(idle.rpcConfigured).toBe(false);
    expect(idle.status).toBe('idle');
    expect(idle.lastBlockProcessed).toBe(77);
    expect(idle.startBlock).toBe(0);
    expect(idle.store).toBe('memory');

    process.env.AQUARIUS_RPC_URL = 'http://127.0.0.1:8545';
    process.env.INDEXER_START_BLOCK = '5';
    const ready = await getIndexerHealth(store);
    expect(ready.rpcConfigured).toBe(true);
    expect(ready.status).toBe('ok');
    expect(ready.startBlock).toBe(5);
    expect(ready.factoryAddress).toBe(factory);
  });
});

describe('GET /api/indexer', () => {
  beforeEach(async () => {
    await __resetIndexerStoreForTests();
    __resetIndexerPublicClientForTests();
    delete process.env.AQUARIUS_RPC_URL;
    delete process.env.RPC_URL;
    delete process.env.INDEXER_START_BLOCK;
    delete process.env.DATABASE_URL;
  });

  afterEach(async () => {
    await __resetIndexerStoreForTests();
    __resetIndexerPublicClientForTests();
    delete process.env.AQUARIUS_RPC_URL;
    delete process.env.INDEXER_START_BLOCK;
  });

  it('exposes public community list and health without a session', async () => {
    const store = new MemoryIndexerStore();
    __setIndexerStoreForTests(store);
    await ingestLogs(store, [
      {
        eventName: 'CommunityDeployed',
        address: factory,
        blockNumber: 3,
        transactionHash: txA,
        logIndex: 0,
        args: {
          communityAddress: community,
          name: 'Public DAO',
          founders: [founder],
          timestamp: 99,
        },
      },
    ]);

    const app = createApp();

    const healthRes = await app.request('/api/indexer/health');
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json();
    expect(health.lastBlockProcessed).toBe(3);
    expect(health.rpcConfigured).toBe(false);
    expect(health.communitiesIndexed).toBe(1);

    const listRes = await app.request('/api/indexer/communities');
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.total).toBe(1);
    expect(list.communities[0].name).toBe('Public DAO');
    expect(list.communities[0].address).toBe(community);
  });
});
