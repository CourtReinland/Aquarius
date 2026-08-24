import { getAddress, isAddress, type Address, type Hash } from 'viem';
import { API_BASE } from '../config/api';

/**
 * Public indexer client for community discovery.
 *
 * Routes are session-optional (`GET /api/indexer/health`, `GET /api/indexer/communities`).
 * Timeouts and non-2xx responses throw so callers can fall back to chain reads.
 */

export const INDEXER_TIMEOUT_MS = 4000;

export type IndexerHealth = {
  status: 'ok' | 'idle' | string;
  rpcConfigured: boolean;
  lastBlockProcessed: number | null;
  startBlock?: number;
  store?: string;
  factoryAddress?: string | null;
  governanceAddress?: string | null;
  communitiesIndexed?: number;
  eventsIndexed?: number;
};

export type IndexedCommunity = {
  address: Address;
  name: string;
  founders: Address[];
  deployedAtBlock: number;
  deployedAtTimestamp: number | null;
  transactionHash?: Hash;
  logIndex?: number;
};

export type IndexerCommunitiesResponse = {
  communities: IndexedCommunity[];
  total: number;
};

export type CommunityListSource = 'indexer' | 'chain' | 'indexer+chain';

/**
 * Prefer the indexer when it has processed a block or has an RPC configured.
 * Idle / unconfigured health should fall back to factory `getAllCommunities`.
 */
export function isIndexerReady(health: IndexerHealth): boolean {
  return health.rpcConfigured || health.lastBlockProcessed != null;
}

export async function fetchIndexerHealth(
  timeoutMs = INDEXER_TIMEOUT_MS
): Promise<IndexerHealth> {
  const raw = await fetchIndexerJson('/api/indexer/health', timeoutMs);
  const health = parseIndexerHealth(raw);
  if (!health) {
    throw new Error('Indexer health response was malformed');
  }
  return health;
}

export async function fetchIndexedCommunities(
  timeoutMs = INDEXER_TIMEOUT_MS
): Promise<IndexedCommunity[]> {
  const raw = await fetchIndexerJson('/api/indexer/communities', timeoutMs);
  const list = parseIndexedCommunities(raw);
  if (!list) {
    throw new Error('Indexer communities response was malformed');
  }
  return list;
}

/**
 * Returns indexed communities when the stub is usable and non-empty.
 * Returns null on idle/unconfigured health, empty list, timeout, 5xx, or parse errors.
 */
export async function tryLoadIndexedCommunities(
  timeoutMs = INDEXER_TIMEOUT_MS
): Promise<IndexedCommunity[] | null> {
  try {
    const health = await fetchIndexerHealth(timeoutMs);
    if (!isIndexerReady(health)) return null;
    const communities = await fetchIndexedCommunities(timeoutMs);
    return communities.length > 0 ? communities : null;
  } catch {
    return null;
  }
}

export function indexedCommunityMap(
  communities: IndexedCommunity[]
): Map<string, IndexedCommunity> {
  return new Map(communities.map((community) => [community.address.toLowerCase(), community]));
}

export function mergeCommunityAddresses(
  indexed: IndexedCommunity[],
  factoryAddresses: Address[]
): Address[] {
  const seen = new Set<string>();
  const merged: Address[] = [];

  for (const community of indexed) {
    const key = community.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(community.address);
  }

  for (const address of factoryAddresses) {
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(address);
  }

  return merged;
}

async function fetchIndexerJson(path: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Indexer HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function parseIndexerHealth(value: unknown): IndexerHealth | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.rpcConfigured !== 'boolean') return null;

  const lastBlockProcessed = parseOptionalNumber(record.lastBlockProcessed);
  if (record.lastBlockProcessed != null && lastBlockProcessed === undefined) {
    return null;
  }

  return {
    status: typeof record.status === 'string' ? record.status : 'ok',
    rpcConfigured: record.rpcConfigured,
    lastBlockProcessed: lastBlockProcessed ?? null,
    startBlock: typeof record.startBlock === 'number' ? record.startBlock : undefined,
    store: typeof record.store === 'string' ? record.store : undefined,
    factoryAddress: optionalString(record.factoryAddress),
    governanceAddress: optionalString(record.governanceAddress),
    communitiesIndexed:
      typeof record.communitiesIndexed === 'number' ? record.communitiesIndexed : undefined,
    eventsIndexed: typeof record.eventsIndexed === 'number' ? record.eventsIndexed : undefined,
  };
}

export function parseIndexedCommunities(value: unknown): IndexedCommunity[] | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.communities)) return null;

  const communities: IndexedCommunity[] = [];
  for (const item of record.communities) {
    const parsed = parseIndexedCommunity(item);
    if (!parsed) return null;
    communities.push(parsed);
  }
  return communities;
}

function parseIndexedCommunity(value: unknown): IndexedCommunity | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.address !== 'string' || !isAddress(record.address)) return null;
  if (typeof record.name !== 'string') return null;

  const founders = Array.isArray(record.founders)
    ? record.founders.filter((item): item is string => typeof item === 'string' && isAddress(item))
    : [];

  return {
    address: getAddress(record.address),
    name: record.name,
    founders: founders.map((founder) => getAddress(founder)),
    deployedAtBlock: typeof record.deployedAtBlock === 'number' ? record.deployedAtBlock : 0,
    deployedAtTimestamp:
      typeof record.deployedAtTimestamp === 'number' ? record.deployedAtTimestamp : null,
    transactionHash:
      typeof record.transactionHash === 'string' && record.transactionHash.startsWith('0x')
        ? (record.transactionHash as Hash)
        : undefined,
    logIndex: typeof record.logIndex === 'number' ? record.logIndex : undefined,
  };
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  return undefined;
}
