import { createPublicClient, getAddress, http, isAddress, type Address, type Hash } from 'viem';
import {
  communityEventsAbi,
  communityFactoryEventsAbi,
  COMMUNITY_EVENT_NAMES,
  FACTORY_EVENT_NAMES,
  GOVERNANCE_EVENT_NAMES,
  governanceEventsAbi,
} from './abis.js';
import {
  resolveCommunityFactoryAddress,
  resolveGovernanceAddress,
  resolveIndexerBlockSpan,
  resolveIndexerPollIntervalMs,
  resolveIndexerRpcUrl,
  resolveIndexerStartBlock,
  resolveIndexerStoreKind,
} from './env.js';
import { getIndexerStore, type IndexerStore } from './store.js';
import type {
  DecodedIndexerLog,
  IndexedCommunity,
  IndexedEvent,
  IndexerHealth,
  IndexerLogInput,
  IndexerPublicClient,
} from './types.js';

export type IndexerHandle = {
  stop: () => void;
  store: IndexerStore;
};

/** `undefined` = use env RPC; `null` = force no client (even if env is set). */
let testClient: IndexerPublicClient | null | undefined;

export function __setIndexerPublicClientForTests(
  client: IndexerPublicClient | null | undefined
): void {
  testClient = client;
}

export function __resetIndexerPublicClientForTests(): void {
  testClient = undefined;
}

export function getIndexerPublicClient(): IndexerPublicClient | null {
  if (testClient !== undefined) {
    return testClient;
  }

  const rpcUrl = resolveIndexerRpcUrl();
  if (!rpcUrl) return null;
  return createPublicClient({ transport: http(rpcUrl) });
}

export function eventId(transactionHash: string, logIndex: number): string {
  return `${transactionHash.toLowerCase()}:${logIndex}`;
}

export function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        jsonSafe(nested),
      ])
    );
  }
  return value;
}

function asRecord(args: DecodedIndexerLog['args'] | IndexerLogInput['args']): Record<string, unknown> {
  if (!args || Array.isArray(args) || typeof args !== 'object') return {};
  return jsonSafe(args) as Record<string, unknown>;
}

function optionalAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null;
  return getAddress(value);
}

function toBlockNumber(value: bigint | number): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

function communityFromDeployed(log: IndexerLogInput, args: Record<string, unknown>): IndexedCommunity | null {
  const address = optionalAddress(args.communityAddress);
  if (!address) return null;
  const founders = Array.isArray(args.founders)
    ? args.founders
        .filter((value): value is string => typeof value === 'string' && isAddress(value))
        .map((value) => getAddress(value))
    : [];
  const timestampRaw = args.timestamp;
  const timestamp =
    typeof timestampRaw === 'string' || typeof timestampRaw === 'number'
      ? Number(timestampRaw)
      : null;

  return {
    address,
    name: typeof args.name === 'string' ? args.name : 'Unnamed',
    founders,
    deployedAtBlock: toBlockNumber(log.blockNumber),
    deployedAtTimestamp: Number.isFinite(timestamp) ? timestamp : null,
    transactionHash: log.transactionHash as Hash,
    logIndex: log.logIndex,
  };
}

function communityAddressForEvent(
  eventName: string,
  contractAddress: Address,
  args: Record<string, unknown>
): Address | null {
  if (eventName === 'CommunityDeployed') {
    return optionalAddress(args.communityAddress);
  }
  if (FACTORY_EVENT_NAMES.includes(eventName as (typeof FACTORY_EVENT_NAMES)[number])) {
    return optionalAddress(args.communityAddress);
  }
  if (GOVERNANCE_EVENT_NAMES.includes(eventName as (typeof GOVERNANCE_EVENT_NAMES)[number])) {
    return optionalAddress(args.community);
  }
  if (COMMUNITY_EVENT_NAMES.includes(eventName as (typeof COMMUNITY_EVENT_NAMES)[number])) {
    return contractAddress;
  }
  return optionalAddress(args.communityAddress) ?? optionalAddress(args.community);
}

export async function ingestLogs(
  store: IndexerStore,
  logs: IndexerLogInput[],
  options?: { advanceCursorTo?: number }
): Promise<{ ingested: number; lastBlock: number | null }> {
  let ingested = 0;
  let maxBlock: number | null = null;

  for (const log of logs) {
    if (!log.eventName || log.logIndex == null || !log.transactionHash) continue;
    const blockNumber = toBlockNumber(log.blockNumber);
    if (!Number.isFinite(blockNumber)) continue;

    const args = asRecord(log.args);
    const contractAddress = getAddress(log.address);
    const event: IndexedEvent = {
      id: eventId(log.transactionHash, log.logIndex),
      eventName: log.eventName,
      contractAddress,
      communityAddress: communityAddressForEvent(log.eventName, contractAddress, args),
      blockNumber,
      transactionHash: log.transactionHash as Hash,
      logIndex: log.logIndex,
      args,
    };

    await store.putEvent(event);
    ingested += 1;

    if (log.eventName === 'CommunityDeployed') {
      const community = communityFromDeployed(log, args);
      if (community) await store.putCommunity(community);
    }

    if (maxBlock === null || blockNumber > maxBlock) {
      maxBlock = blockNumber;
    }
  }

  const cursor = options?.advanceCursorTo ?? maxBlock;
  if (cursor !== null && cursor !== undefined) {
    await store.setLastBlock(cursor);
  }

  return { ingested, lastBlock: (await store.getLastBlock()) };
}

function toInputLogs(logs: DecodedIndexerLog[]): IndexerLogInput[] {
  return logs.flatMap((log) => {
    if (!log.eventName || log.blockNumber == null || !log.transactionHash || log.logIndex == null) {
      return [];
    }
    return [
      {
        eventName: log.eventName,
        address: log.address,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        args: asRecord(log.args),
      },
    ];
  });
}

export async function catchUp(params: {
  store: IndexerStore;
  client: IndexerPublicClient;
  startBlock?: number;
  toBlock?: number;
  blockSpan?: number;
}): Promise<{ fromBlock: number; toBlock: number; ingested: number }> {
  const startBlock = params.startBlock ?? resolveIndexerStartBlock();
  const last = await params.store.getLastBlock();
  const fromBlock = last === null ? startBlock : last + 1;
  const head =
    params.toBlock ??
    Number(await params.client.getBlockNumber());
  const span = params.blockSpan ?? resolveIndexerBlockSpan();

  if (fromBlock > head) {
    return { fromBlock, toBlock: head, ingested: 0 };
  }

  const factory = resolveCommunityFactoryAddress();
  const governance = resolveGovernanceAddress();
  let ingested = 0;

  for (let from = fromBlock; from <= head; from += span) {
    const to = Math.min(from + span - 1, head);
    const fromBig = BigInt(from);
    const toBig = BigInt(to);

    if (factory) {
      const factoryLogs = await params.client.getLogs({
        address: factory,
        events: communityFactoryEventsAbi,
        fromBlock: fromBig,
        toBlock: toBig,
      });
      ingested += (await ingestLogs(params.store, toInputLogs(factoryLogs))).ingested;
    }

    const communities = await params.store.listCommunityAddresses();
    if (communities.length > 0) {
      const communityLogs = await params.client.getLogs({
        address: communities,
        events: communityEventsAbi,
        fromBlock: fromBig,
        toBlock: toBig,
      });
      ingested += (await ingestLogs(params.store, toInputLogs(communityLogs))).ingested;
    }

    if (governance) {
      const governanceLogs = await params.client.getLogs({
        address: governance,
        events: governanceEventsAbi,
        fromBlock: fromBig,
        toBlock: toBig,
      });
      ingested += (await ingestLogs(params.store, toInputLogs(governanceLogs))).ingested;
    }

    await params.store.setLastBlock(to);
  }

  return { fromBlock, toBlock: head, ingested };
}

function startWatches(params: {
  store: IndexerStore;
  client: IndexerPublicClient;
  pollMs: number;
}): Array<() => void> {
  const unwatchers: Array<() => void> = [];
  const watchedCommunities = new Set<string>();

  const onLogs = (logs: DecodedIndexerLog[]) => {
    void ingestLogs(params.store, toInputLogs(logs)).then(async () => {
      await watchNewCommunities();
    }).catch((error) => {
      console.error('[indexer] live ingest failed', error);
    });
  };

  const watchCommunity = (address: Address) => {
    const key = address.toLowerCase();
    if (watchedCommunities.has(key)) return;
    watchedCommunities.add(key);
    for (const eventName of COMMUNITY_EVENT_NAMES) {
      unwatchers.push(
        params.client.watchContractEvent({
          address,
          abi: communityEventsAbi,
          eventName,
          pollingInterval: params.pollMs,
          onLogs,
          onError: (error) => console.error(`[indexer] ${eventName} watch failed`, error),
        })
      );
    }
  };

  const watchNewCommunities = async () => {
    for (const address of await params.store.listCommunityAddresses()) {
      watchCommunity(address);
    }
  };

  const factory = resolveCommunityFactoryAddress();
  if (factory) {
    for (const eventName of FACTORY_EVENT_NAMES) {
      unwatchers.push(
        params.client.watchContractEvent({
          address: factory,
          abi: communityFactoryEventsAbi,
          eventName,
          pollingInterval: params.pollMs,
          onLogs,
          onError: (error) => console.error(`[indexer] ${eventName} watch failed`, error),
        })
      );
    }
  }

  const governance = resolveGovernanceAddress();
  if (governance) {
    for (const eventName of GOVERNANCE_EVENT_NAMES) {
      unwatchers.push(
        params.client.watchContractEvent({
          address: governance,
          abi: governanceEventsAbi,
          eventName,
          pollingInterval: params.pollMs,
          onLogs,
          onError: (error) => console.error(`[indexer] ${eventName} watch failed`, error),
        })
      );
    }
  }

  void watchNewCommunities();
  return unwatchers;
}

export async function getIndexerHealth(store = getIndexerStore()): Promise<IndexerHealth> {
  const lastBlockProcessed = await store.getLastBlock();
  return {
    status: resolveIndexerRpcUrl() || testClient ? 'ok' : 'idle',
    rpcConfigured: Boolean(resolveIndexerRpcUrl() || testClient),
    lastBlockProcessed,
    startBlock: resolveIndexerStartBlock(),
    store: resolveIndexerStoreKind(),
    factoryAddress: resolveCommunityFactoryAddress(),
    governanceAddress: resolveGovernanceAddress(),
    communitiesIndexed: await store.countCommunities(),
    eventsIndexed: await store.countEvents(),
  };
}

export function startIndexer(options?: {
  store?: IndexerStore;
  client?: IndexerPublicClient | null;
}): IndexerHandle {
  const store = options?.store ?? getIndexerStore();
  const client = options?.client !== undefined ? options.client : getIndexerPublicClient();
  const unwatchers: Array<() => void> = [];
  let stopped = false;

  if (!client) {
    console.log('[indexer] idle — set AQUARIUS_RPC_URL or RPC_URL to catch up and watch events');
    return { stop() {}, store };
  }

  const run = async () => {
    try {
      const result = await catchUp({ store, client });
      console.log(
        `[indexer] catch-up ${result.fromBlock}→${result.toBlock} ingested=${result.ingested}`
      );
    } catch (error) {
      console.error('[indexer] catch-up failed', error);
    }

    if (stopped) return;
    unwatchers.push(
      ...startWatches({
        store,
        client,
        pollMs: resolveIndexerPollIntervalMs(),
      })
    );
  };

  void run();

  return {
    store,
    stop() {
      stopped = true;
      for (const unwatch of unwatchers) {
        try {
          unwatch();
        } catch {
          /* ignore */
        }
      }
    },
  };
}
