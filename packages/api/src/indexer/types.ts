import type { Address, Hash, Hex } from 'viem';
import type { communityEventsAbi, communityFactoryEventsAbi, governanceEventsAbi } from './abis.js';

export type IndexedCommunity = {
  address: Address;
  name: string;
  founders: Address[];
  deployedAtBlock: number;
  deployedAtTimestamp: number | null;
  transactionHash: Hash;
  logIndex: number;
};

export type IndexedEvent = {
  id: string;
  eventName: string;
  contractAddress: Address;
  communityAddress: Address | null;
  blockNumber: number;
  transactionHash: Hash;
  logIndex: number;
  args: Record<string, unknown>;
};

export type IndexerHealth = {
  status: 'ok' | 'idle';
  rpcConfigured: boolean;
  lastBlockProcessed: number | null;
  startBlock: number;
  store: 'memory' | 'postgres';
  factoryAddress: Address | null;
  governanceAddress: Address | null;
  communitiesIndexed: number;
  eventsIndexed: number;
};

export type DecodedIndexerLog = {
  eventName?: string;
  args?: Record<string, unknown> | readonly unknown[];
  address: Address;
  blockNumber: bigint | null;
  transactionHash: Hash | null;
  logIndex: number | null;
};

/**
 * Minimal viem public-client surface used by the indexer.
 * Real `createPublicClient` instances satisfy this; tests inject a mock.
 */
export type IndexerPublicClient = {
  getBlockNumber: () => Promise<bigint>;
  getLogs: (args: {
    address?: Address | Address[];
    events?:
      | typeof communityFactoryEventsAbi
      | typeof communityEventsAbi
      | typeof governanceEventsAbi;
    fromBlock?: bigint;
    toBlock?: bigint;
  }) => Promise<DecodedIndexerLog[]>;
  watchContractEvent: (args: {
    address: Address | Address[];
    abi:
      | typeof communityFactoryEventsAbi
      | typeof communityEventsAbi
      | typeof governanceEventsAbi;
    eventName: string;
    pollingInterval?: number;
    onLogs: (logs: DecodedIndexerLog[]) => void;
    onError?: (error: Error) => void;
  }) => () => void;
};

export type IndexerLogInput = {
  eventName: string;
  address: Address;
  blockNumber: bigint | number;
  transactionHash: Hash | Hex;
  logIndex: number;
  args?: Record<string, unknown>;
};
