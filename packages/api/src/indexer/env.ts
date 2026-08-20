import { getAddress, isAddress, type Address } from 'viem';
import { isDatabaseConfigured } from '../db/client.js';
import { isProductionEnv } from '../lib/env.js';

/** First CREATE address on a fresh Anvil — matches mobile/web local config. */
export const ANVIL_COMMUNITY_FACTORY = getAddress('0x5FbDB2315678afecb367f032d93F642f64180aa3');
export const ANVIL_GOVERNANCE_MODULE = getAddress('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');

export const DEFAULT_INDEXER_CURSOR_ID = 'default';
export const DEFAULT_INDEXER_POLL_MS = 4_000;
export const DEFAULT_INDEXER_BLOCK_SPAN = 2_000;

export function resolveIndexerRpcUrl(): string | undefined {
  const url = process.env.AQUARIUS_RPC_URL?.trim() || process.env.RPC_URL?.trim();
  return url || undefined;
}

export function resolveIndexerStartBlock(): number {
  const raw = process.env.INDEXER_START_BLOCK?.trim();
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function optionalAddress(...candidates: Array<string | undefined>): Address | null {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && isAddress(value)) return getAddress(value);
  }
  return null;
}

/**
 * Factory to watch for CommunityDeployed.
 * Explicit env always wins. In non-production, fall back to the local Anvil
 * first-deploy address so `pnpm --filter @aquarius/api dev` works after forge script.
 */
export function resolveCommunityFactoryAddress(): Address | null {
  const configured = optionalAddress(
    process.env.AQUARIUS_COMMUNITY_FACTORY_ADDRESS,
    process.env.COMMUNITY_FACTORY_ADDRESS
  );
  if (configured) return configured;
  if (!isProductionEnv()) return ANVIL_COMMUNITY_FACTORY;
  return null;
}

export function resolveGovernanceAddress(): Address | null {
  const configured = optionalAddress(
    process.env.AQUARIUS_GOVERNANCE_ADDRESS,
    process.env.GOVERNANCE_MODULE_ADDRESS
  );
  if (configured) return configured;
  if (!isProductionEnv()) return ANVIL_GOVERNANCE_MODULE;
  return null;
}

export function resolveIndexerPollIntervalMs(): number {
  const raw = process.env.INDEXER_POLL_INTERVAL_MS?.trim();
  if (!raw) return DEFAULT_INDEXER_POLL_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 500) return DEFAULT_INDEXER_POLL_MS;
  return parsed;
}

export function resolveIndexerBlockSpan(): number {
  const raw = process.env.INDEXER_BLOCK_SPAN?.trim();
  if (!raw) return DEFAULT_INDEXER_BLOCK_SPAN;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_INDEXER_BLOCK_SPAN;
  return parsed;
}

export function resolveIndexerStoreKind(): 'memory' | 'postgres' {
  return isDatabaseConfigured() ? 'postgres' : 'memory';
}

export function isIndexerDisabled(): boolean {
  return process.env.INDEXER_DISABLED === 'true';
}
