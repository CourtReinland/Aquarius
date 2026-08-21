import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { Hash } from 'viem';
import type { AquariusAgentPassportV1 } from '@aquarius/shared';
import { getDb, isDatabaseConfigured } from './client.js';
import * as schema from './schema.js';
import {
  agentCapabilities,
  agentContractWatchers,
  agentEconomics,
  agentEvents,
  agentLineage,
  agentMemoryRecords,
  agentPassports,
  agentRuntimeConfigs,
  agentSigningRequests,
  agents,
} from './schema.js';

/** Drizzle Postgres database (postgres-js in production, pglite in tests). */
export type AgentDb = PgDatabase<any, typeof schema>;

const DEFAULT_AGENT_STORE_FILE = fileURLToPath(new URL('../../data/agents.json', import.meta.url));

export type WalletStorageType = 'local-encrypted' | 'kms' | 'lit' | 'smart-account-session';

export interface EncryptedPrivateKey {
  algorithm: 'aes-256-gcm';
  ciphertext: string;
  iv: string;
  tag: string;
}

export interface AgentWalletPolicy {
  storage: {
    type: WalletStorageType;
    keyRef: string | null;
    configured: boolean;
  };
  signer: 'eoa' | 'kms' | 'lit' | 'smart-account';
  humanApprovalRequired: boolean;
  riskyActions: string[];
  sessionKey: {
    enabled: boolean;
    expiresAt: string | null;
  };
}

export interface AgentSigningRequest {
  id: string;
  agentId: string;
  action: 'send-transaction' | 'contract-call' | 'message-signature';
  to: `0x${string}` | null;
  valueEth: string;
  data: string | null;
  risk: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  status: 'pending-human-approval' | 'approved-not-signed' | 'rejected-by-policy';
  humanApprovalRequired: boolean;
  approvedBy: `0x${string}` | null;
  transactionHash: Hash | null;
  createdAt: string;
}

export interface AgentMemoryRecord {
  id: string;
  agentId: string;
  type: 'chat-turn' | 'contract-event';
  visibility: 'community' | 'private' | 'session';
  summary: string;
  sourceEventId: string;
  createdAt: string;
}

export interface ContractWatcherState {
  status: 'reserved' | 'connected';
  lastTransactionHash: string | null;
  lastEventName: string | null;
  lastBlockNumber: number | null;
}

export interface AgentRuntimeEvent {
  id: string;
  agentId: string;
  type: 'chat.user_message' | 'chat.agent_message' | 'runtime.signing_request' | 'contract.event';
  actorAddress: `0x${string}` | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AgentCard {
  schemaVersion: 'aquarius.agent-card.v1';
  standard: 'ERC-8004';
  agentId: string;
  name: string;
  description: string;
  role: string;
  capabilities: string[];
  communityAddress: `0x${string}`;
  communityName: string | null;
  paymentAddress: `0x${string}`;
  wallet: {
    type: 'EOA';
    chain: string;
  };
  runtime: {
    provider: string;
    model: string;
    status: 'configured' | 'pending-orchestrator';
  };
  endpoints: {
    card: string;
    a2a: string;
    mcp: string;
  };
  promptHash: string;
  createdAt: string;
}

export interface RegistrationResult {
  mode: 'on-chain' | 'skipped' | 'failed';
  transactionHash: Hash | null;
  reason?: string;
}

export interface FundingResult {
  requestedEth: string;
  transactionHash: Hash | null;
  status: 'sent' | 'skipped' | 'failed';
  reason?: string;
}

export interface StoredAgent {
  agentId: string;
  communityAddress: `0x${string}`;
  communityName: string | null;
  creatorAddress: `0x${string}` | null;
  walletAddress: `0x${string}`;
  agentCard: AgentCard;
  passport: AquariusAgentPassportV1;
  metadataUri: string;
  encryptedPrivateKey: EncryptedPrivateKey | null;
  keyStorage: 'encrypted-memory' | 'not-stored';
  walletPolicy: AgentWalletPolicy;
  registration: RegistrationResult;
  initialFunding: FundingResult;
  promptHash: string;
  promptTemplate: string;
  events: AgentRuntimeEvent[];
  signingRequests: AgentSigningRequest[];
  memoryRecords: AgentMemoryRecord[];
  contractWatcher: ContractWatcherState;
  createdAt: string;
}

export type PublicStoredAgent = Omit<StoredAgent, 'encryptedPrivateKey' | 'promptTemplate'>;

export interface PrivateRuntimeConfig {
  agentId: string;
  promptTemplate: string;
  encryptedPrivateKey: EncryptedPrivateKey | null;
  runtimeConfig: StoredRuntimeConfig;
  updatedAt: string;
}

/** Extra public fields that do not have dedicated columns live next to private runtime config. */
export interface StoredRuntimeConfig {
  harness: string;
  provider: string;
  model: string;
  promptHash: string;
  keyStorage: StoredAgent['keyStorage'];
  walletStorage: AgentWalletPolicy['storage'];
  agentCard?: AgentCard;
  registration?: RegistrationResult;
  initialFunding?: FundingResult;
}

export interface AgentStoreDocumentV2 {
  version: 2;
  publicAgents: PublicStoredAgent[];
  privateRuntimeConfigs: PrivateRuntimeConfig[];
}

export interface AgentListFilter {
  creatorAddress?: string;
  communityAddress?: string;
}

export interface AgentStore {
  put(agent: StoredAgent): Promise<void>;
  get(agentId: string): Promise<StoredAgent | null>;
  list(filter?: AgentListFilter): Promise<StoredAgent[]>;
  clear(): Promise<void>;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function defaultContractWatcherState(): ContractWatcherState {
  return {
    status: 'reserved',
    lastTransactionHash: null,
    lastEventName: null,
    lastBlockNumber: null,
  };
}

function defaultWalletPolicy(hasEncryptedKey: boolean): AgentWalletPolicy {
  return {
    storage: {
      type: 'local-encrypted',
      keyRef: null,
      configured: hasEncryptedKey,
    },
    signer: 'eoa',
    humanApprovalRequired: true,
    riskyActions: ['send-transaction', 'contract-call', 'trade-crypto', 'manage-treasury', 'vote'],
    sessionKey: {
      enabled: false,
      expiresAt: null,
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asEncryptedPrivateKey(value: unknown): EncryptedPrivateKey | null {
  const record = asRecord(value);
  if (!record) return null;
  if (record.algorithm !== 'aes-256-gcm') return null;
  if (
    typeof record.ciphertext !== 'string' ||
    typeof record.iv !== 'string' ||
    typeof record.tag !== 'string'
  ) {
    return null;
  }
  return {
    algorithm: 'aes-256-gcm',
    ciphertext: record.ciphertext,
    iv: record.iv,
    tag: record.tag,
  };
}

function asRuntimeConfig(value: unknown): StoredRuntimeConfig | null {
  const record = asRecord(value);
  if (!record) return null;
  if (
    typeof record.harness !== 'string' ||
    typeof record.provider !== 'string' ||
    typeof record.model !== 'string' ||
    typeof record.promptHash !== 'string'
  ) {
    return null;
  }
  return record as unknown as StoredRuntimeConfig;
}

function matchesFilter(agent: StoredAgent, filter?: AgentListFilter): boolean {
  if (
    filter?.creatorAddress &&
    agent.creatorAddress?.toLowerCase() !== filter.creatorAddress.toLowerCase()
  ) {
    return false;
  }
  if (
    filter?.communityAddress &&
    agent.communityAddress.toLowerCase() !== filter.communityAddress.toLowerCase()
  ) {
    return false;
  }
  return true;
}

function loadAgentsFromFile(storeFile: string | null): Map<string, StoredAgent> {
  if (!storeFile || !existsSync(storeFile)) return new Map();

  const raw = readFileSync(storeFile, 'utf8').trim();
  if (!raw) return new Map();

  const parsed = JSON.parse(raw) as StoredAgent[] | AgentStoreDocumentV2;

  if (Array.isArray(parsed)) {
    return new Map(parsed.map((agent) => [agent.agentId, { ...agent, events: agent.events ?? [] }]));
  }

  const runtimeConfigs = new Map(parsed.privateRuntimeConfigs.map((config) => [config.agentId, config]));
  return new Map(parsed.publicAgents.map((publicAgent) => {
    const runtimeConfig = runtimeConfigs.get(publicAgent.agentId);
    const restoredAgent: StoredAgent = {
      ...publicAgent,
      encryptedPrivateKey: runtimeConfig?.encryptedPrivateKey ?? null,
      promptTemplate: runtimeConfig?.promptTemplate ?? '',
      events: publicAgent.events ?? [],
      signingRequests: publicAgent.signingRequests ?? [],
      memoryRecords: publicAgent.memoryRecords ?? [],
      contractWatcher: publicAgent.contractWatcher ?? defaultContractWatcherState(),
      walletPolicy:
        publicAgent.walletPolicy ??
        defaultWalletPolicy(Boolean(runtimeConfig?.encryptedPrivateKey)),
    };
    return [restoredAgent.agentId, restoredAgent];
  }));
}

function toStoreDocument(records: Iterable<StoredAgent>): AgentStoreDocumentV2 {
  const list = [...records];
  return {
    version: 2,
    publicAgents: list.map((agent) => {
      const { encryptedPrivateKey: _encryptedPrivateKey, promptTemplate: _promptTemplate, ...publicAgent } =
        agent;
      return publicAgent;
    }),
    privateRuntimeConfigs: list.map((agent) => ({
      agentId: agent.agentId,
      promptTemplate: agent.promptTemplate,
      encryptedPrivateKey: agent.encryptedPrivateKey,
      runtimeConfig: runtimeConfigFromAgent(agent),
      updatedAt: agent.passport.updatedAt,
    })),
  };
}

function runtimeConfigFromAgent(agent: StoredAgent): StoredRuntimeConfig {
  return {
    harness: agent.passport.runtime.harness,
    provider: agent.passport.runtime.provider,
    model: agent.passport.runtime.model,
    promptHash: agent.promptHash,
    keyStorage: agent.keyStorage,
    walletStorage: agent.walletPolicy.storage,
    agentCard: agent.agentCard,
    registration: agent.registration,
    initialFunding: agent.initialFunding,
  };
}

export function reconstructAgentCard(agent: Pick<
  StoredAgent,
  'agentId' | 'communityAddress' | 'communityName' | 'walletAddress' | 'passport' | 'promptHash' | 'createdAt'
>): AgentCard {
  const passport = agent.passport;
  return {
    schemaVersion: 'aquarius.agent-card.v1',
    standard: 'ERC-8004',
    agentId: agent.agentId,
    name: passport.identity.name,
    description: passport.identity.description,
    role: passport.identity.role,
    capabilities: passport.capabilities.public,
    communityAddress: agent.communityAddress,
    communityName: agent.communityName,
    paymentAddress: agent.walletAddress,
    wallet: {
      type: 'EOA',
      chain: passport.wallet.chain,
    },
    runtime: {
      provider: passport.runtime.provider,
      model: passport.runtime.model,
      status: passport.runtime.status === 'configured' ? 'configured' : 'pending-orchestrator',
    },
    endpoints: {
      card: passport.runtime.endpoints.card,
      a2a: passport.runtime.endpoints.a2a,
      mcp: passport.runtime.endpoints.mcp,
    },
    promptHash: agent.promptHash,
    createdAt: agent.createdAt,
  };
}

function skippedRegistration(): RegistrationResult {
  return { mode: 'skipped', transactionHash: null };
}

function skippedFunding(): FundingResult {
  return { requestedEth: '0', transactionHash: null, status: 'skipped' };
}

/**
 * JSON file + in-memory bridge used when DATABASE_URL is unset.
 * Same document shape as the previous Agent Foundry store.
 */
export class JsonFileAgentStore implements AgentStore {
  private readonly records: Map<string, StoredAgent>;

  constructor(private readonly storeFile: string | null) {
    this.records = loadAgentsFromFile(storeFile);
  }

  async put(agent: StoredAgent): Promise<void> {
    this.records.set(agent.agentId, agent);
    this.persist();
  }

  async get(agentId: string): Promise<StoredAgent | null> {
    return this.records.get(agentId) ?? null;
  }

  async list(filter?: AgentListFilter): Promise<StoredAgent[]> {
    return [...this.records.values()].filter((agent) => matchesFilter(agent, filter));
  }

  async clear(): Promise<void> {
    this.records.clear();
    this.persist();
  }

  private persist(): void {
    if (!this.storeFile) return;
    mkdirSync(dirname(this.storeFile), { recursive: true });
    writeFileSync(this.storeFile, JSON.stringify(toStoreDocument(this.records.values()), null, 2));
  }
}

export class PostgresAgentStore implements AgentStore {
  constructor(private readonly db: AgentDb) {}

  async put(agent: StoredAgent): Promise<void> {
    const createdAt = new Date(agent.createdAt);
    const updatedAt = new Date(agent.passport.updatedAt);
    const runtimeConfig = runtimeConfigFromAgent(agent);
    const passport = agent.passport;

    await this.db.transaction(async (tx) => {
      await tx
        .insert(agents)
        .values({
          agentId: agent.agentId,
          communityAddress: agent.communityAddress,
          communityName: agent.communityName,
          creatorAddress: agent.creatorAddress,
          walletAddress: agent.walletAddress,
          metadataUri: agent.metadataUri,
          keyStorage: agent.keyStorage,
          walletPolicy: agent.walletPolicy,
          promptHash: agent.promptHash,
          memoryPolicy: passport.memoryPolicy,
          createdAt,
        })
        .onConflictDoUpdate({
          target: agents.agentId,
          set: {
            communityAddress: agent.communityAddress,
            communityName: agent.communityName,
            creatorAddress: agent.creatorAddress,
            walletAddress: agent.walletAddress,
            metadataUri: agent.metadataUri,
            keyStorage: agent.keyStorage,
            walletPolicy: agent.walletPolicy,
            promptHash: agent.promptHash,
            memoryPolicy: passport.memoryPolicy,
          },
        });

      await tx
        .insert(agentPassports)
        .values({
          agentId: agent.agentId,
          schemaVersion: passport.schemaVersion,
          passport,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: agentPassports.agentId,
          set: {
            schemaVersion: passport.schemaVersion,
            passport,
            updatedAt,
          },
        });

      await tx
        .insert(agentRuntimeConfigs)
        .values({
          agentId: agent.agentId,
          promptTemplate: agent.promptTemplate,
          encryptedPrivateKey: agent.encryptedPrivateKey,
          runtimeConfig,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: agentRuntimeConfigs.agentId,
          set: {
            promptTemplate: agent.promptTemplate,
            encryptedPrivateKey: agent.encryptedPrivateKey,
            runtimeConfig,
            updatedAt,
          },
        });

      await tx
        .insert(agentCapabilities)
        .values({
          agentId: agent.agentId,
          permissionClass: passport.capabilities.permissionClass,
          capabilities: passport.capabilities.public,
          permissionPolicyUri: passport.capabilities.permissionPolicyUri,
          permissionPolicyHash: passport.capabilities.permissionPolicyHash,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: agentCapabilities.agentId,
          set: {
            permissionClass: passport.capabilities.permissionClass,
            capabilities: passport.capabilities.public,
            permissionPolicyUri: passport.capabilities.permissionPolicyUri,
            permissionPolicyHash: passport.capabilities.permissionPolicyHash,
            updatedAt,
          },
        });

      await tx
        .insert(agentLineage)
        .values({
          agentId: agent.agentId,
          originMode: passport.origin.mode,
          parentAgentId: passport.origin.parentAgentId,
          templateId: passport.origin.templateId,
          lineageHash: passport.origin.lineageHash,
        })
        .onConflictDoUpdate({
          target: agentLineage.agentId,
          set: {
            originMode: passport.origin.mode,
            parentAgentId: passport.origin.parentAgentId,
            templateId: passport.origin.templateId,
            lineageHash: passport.origin.lineageHash,
          },
        });

      await tx
        .insert(agentEconomics)
        .values({
          agentId: agent.agentId,
          hireable: passport.economics.hireable,
          cloneable: passport.economics.cloneable,
          license: passport.economics.license,
          feeRecipient: passport.economics.feeRecipient,
          hirePrice: passport.economics.hirePrice,
          clonePrice: passport.economics.clonePrice,
          revenueSplitBps: passport.economics.revenueSplitBps,
          feeMode: passport.economics.feeMode,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: agentEconomics.agentId,
          set: {
            hireable: passport.economics.hireable,
            cloneable: passport.economics.cloneable,
            license: passport.economics.license,
            feeRecipient: passport.economics.feeRecipient,
            hirePrice: passport.economics.hirePrice,
            clonePrice: passport.economics.clonePrice,
            revenueSplitBps: passport.economics.revenueSplitBps,
            feeMode: passport.economics.feeMode,
            updatedAt,
          },
        });

      await tx
        .insert(agentContractWatchers)
        .values({
          agentId: agent.agentId,
          status: agent.contractWatcher.status,
          lastTransactionHash: agent.contractWatcher.lastTransactionHash,
          lastEventName: agent.contractWatcher.lastEventName,
          lastBlockNumber: agent.contractWatcher.lastBlockNumber,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: agentContractWatchers.agentId,
          set: {
            status: agent.contractWatcher.status,
            lastTransactionHash: agent.contractWatcher.lastTransactionHash,
            lastEventName: agent.contractWatcher.lastEventName,
            lastBlockNumber: agent.contractWatcher.lastBlockNumber,
            updatedAt,
          },
        });

      await tx.delete(agentEvents).where(eq(agentEvents.agentId, agent.agentId));
      if (agent.events.length > 0) {
        await tx.insert(agentEvents).values(
          agent.events.map((event) => ({
            id: event.id,
            agentId: event.agentId,
            type: event.type,
            actorAddress: event.actorAddress,
            payload: event.payload,
            createdAt: new Date(event.createdAt),
          }))
        );
      }

      await tx.delete(agentSigningRequests).where(eq(agentSigningRequests.agentId, agent.agentId));
      if (agent.signingRequests.length > 0) {
        await tx.insert(agentSigningRequests).values(
          agent.signingRequests.map((request) => ({
            id: request.id,
            agentId: request.agentId,
            action: request.action,
            targetAddress: request.to,
            valueEth: request.valueEth,
            risk: request.risk,
            status: request.status,
            humanApprovalRequired: request.humanApprovalRequired,
            approvedBy: request.approvedBy,
            transactionHash: request.transactionHash,
            payload: {
              data: request.data,
              reason: request.reason,
            },
            createdAt: new Date(request.createdAt),
          }))
        );
      }

      await tx.delete(agentMemoryRecords).where(eq(agentMemoryRecords.agentId, agent.agentId));
      if (agent.memoryRecords.length > 0) {
        await tx.insert(agentMemoryRecords).values(
          agent.memoryRecords.map((record) => ({
            id: record.id,
            agentId: record.agentId,
            type: record.type,
            visibility: record.visibility,
            summary: record.summary,
            sourceEventId: record.sourceEventId,
            createdAt: new Date(record.createdAt),
          }))
        );
      }
    });
  }

  async get(agentId: string): Promise<StoredAgent | null> {
    const assembled = await this.assemble([agentId]);
    return assembled[0] ?? null;
  }

  async list(filter?: AgentListFilter): Promise<StoredAgent[]> {
    const conditions = [];
    if (filter?.creatorAddress) {
      conditions.push(sql`lower(${agents.creatorAddress}) = ${filter.creatorAddress.toLowerCase()}`);
    }
    if (filter?.communityAddress) {
      conditions.push(sql`lower(${agents.communityAddress}) = ${filter.communityAddress.toLowerCase()}`);
    }

    const rows = conditions.length
      ? await this.db.select({ agentId: agents.agentId }).from(agents).where(and(...conditions))
      : await this.db.select({ agentId: agents.agentId }).from(agents);

    return this.assemble(rows.map((row) => row.agentId));
  }

  async clear(): Promise<void> {
    await this.db.delete(agents);
  }

  private async assemble(agentIds: string[]): Promise<StoredAgent[]> {
    if (agentIds.length === 0) return [];

    const [coreRows, passportRows, runtimeRows, watcherRows, eventRows, signingRows, memoryRows] =
      await Promise.all([
        this.db.select().from(agents).where(inArray(agents.agentId, agentIds)),
        this.db.select().from(agentPassports).where(inArray(agentPassports.agentId, agentIds)),
        this.db.select().from(agentRuntimeConfigs).where(inArray(agentRuntimeConfigs.agentId, agentIds)),
        this.db.select().from(agentContractWatchers).where(inArray(agentContractWatchers.agentId, agentIds)),
        this.db.select().from(agentEvents).where(inArray(agentEvents.agentId, agentIds)),
        this.db.select().from(agentSigningRequests).where(inArray(agentSigningRequests.agentId, agentIds)),
        this.db.select().from(agentMemoryRecords).where(inArray(agentMemoryRecords.agentId, agentIds)),
      ]);

    const passports = new Map(passportRows.map((row) => [row.agentId, row]));
    const runtimes = new Map(runtimeRows.map((row) => [row.agentId, row]));
    const watchers = new Map(watcherRows.map((row) => [row.agentId, row]));
    const eventsByAgent = groupBy(eventRows, (row) => row.agentId);
    const signingByAgent = groupBy(signingRows, (row) => row.agentId);
    const memoryByAgent = groupBy(memoryRows, (row) => row.agentId);
    const order = new Map(agentIds.map((id, index) => [id, index]));

    return coreRows
      .map((core) =>
        this.agentFromRow(
          core,
          passports.get(core.agentId) ?? null,
          runtimes.get(core.agentId) ?? null,
          watchers.get(core.agentId) ?? null,
          eventsByAgent,
          signingByAgent,
          memoryByAgent
        )
      )
      .filter((agent): agent is StoredAgent => agent !== null)
      .sort((a, b) => (order.get(a.agentId) ?? 0) - (order.get(b.agentId) ?? 0));
  }

  private agentFromRow(
    core: typeof agents.$inferSelect,
    passportRow: typeof agentPassports.$inferSelect | null,
    runtimeRow: typeof agentRuntimeConfigs.$inferSelect | null,
    watcher: typeof agentContractWatchers.$inferSelect | null,
    eventsByAgent: Map<string, Array<typeof agentEvents.$inferSelect>>,
    signingByAgent: Map<string, Array<typeof agentSigningRequests.$inferSelect>>,
    memoryByAgent: Map<string, Array<typeof agentMemoryRecords.$inferSelect>>
  ): StoredAgent | null {
    if (!passportRow) return null;

    const passport = passportRow.passport as AquariusAgentPassportV1;
    const runtimeConfig = asRuntimeConfig(runtimeRow?.runtimeConfig);
    const encryptedPrivateKey = asEncryptedPrivateKey(runtimeRow?.encryptedPrivateKey);
    const createdAt = toIso(core.createdAt);
    const base = {
      agentId: core.agentId,
      communityAddress: core.communityAddress as `0x${string}`,
      communityName: core.communityName,
      walletAddress: core.walletAddress as `0x${string}`,
      passport,
      promptHash: core.promptHash,
      createdAt,
    };

    return {
      ...base,
      creatorAddress: (core.creatorAddress as `0x${string}` | null) ?? null,
      agentCard: runtimeConfig?.agentCard ?? reconstructAgentCard(base),
      metadataUri: core.metadataUri,
      encryptedPrivateKey,
      keyStorage: (core.keyStorage as StoredAgent['keyStorage']) ?? 'not-stored',
      walletPolicy: (core.walletPolicy as AgentWalletPolicy) ?? defaultWalletPolicy(Boolean(encryptedPrivateKey)),
      registration: runtimeConfig?.registration ?? skippedRegistration(),
      initialFunding: runtimeConfig?.initialFunding ?? skippedFunding(),
      promptTemplate: runtimeRow?.promptTemplate ?? '',
      events: (eventsByAgent.get(core.agentId) ?? [])
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((event) => ({
          id: event.id,
          agentId: event.agentId,
          type: event.type as AgentRuntimeEvent['type'],
          actorAddress: (event.actorAddress as `0x${string}` | null) ?? null,
          payload: (event.payload ?? {}) as Record<string, unknown>,
          createdAt: toIso(event.createdAt),
        })),
      signingRequests: (signingByAgent.get(core.agentId) ?? [])
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((request) => signingFromRow(request)),
      memoryRecords: (memoryByAgent.get(core.agentId) ?? [])
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((record) => ({
          id: record.id,
          agentId: record.agentId,
          type: record.type as AgentMemoryRecord['type'],
          visibility: record.visibility as AgentMemoryRecord['visibility'],
          summary: record.summary,
          sourceEventId: record.sourceEventId ?? '',
          createdAt: toIso(record.createdAt),
        })),
      contractWatcher: watcher
        ? {
            status: watcher.status as ContractWatcherState['status'],
            lastTransactionHash: watcher.lastTransactionHash,
            lastEventName: watcher.lastEventName,
            lastBlockNumber: watcher.lastBlockNumber,
          }
        : defaultContractWatcherState(),
    };
  }
}

function signingFromRow(row: typeof agentSigningRequests.$inferSelect): AgentSigningRequest {
  const payload = asRecord(row.payload) ?? {};
  return {
    id: row.id,
    agentId: row.agentId,
    action: row.action as AgentSigningRequest['action'],
    to: (row.targetAddress as `0x${string}` | null) ?? null,
    valueEth: row.valueEth,
    data: typeof payload.data === 'string' ? payload.data : null,
    risk: row.risk as AgentSigningRequest['risk'],
    reason: typeof payload.reason === 'string' ? payload.reason : '',
    status: row.status as AgentSigningRequest['status'],
    humanApprovalRequired: row.humanApprovalRequired,
    approvedBy: (row.approvedBy as `0x${string}` | null) ?? null,
    transactionHash: (row.transactionHash as Hash | null) ?? null,
    createdAt: toIso(row.createdAt),
  };
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const list = grouped.get(id);
    if (list) list.push(row);
    else grouped.set(id, [row]);
  }
  return grouped;
}

let store: AgentStore | null = null;

export function getAgentStore(): AgentStore {
  if (!store) {
    store = createAgentStore();
  }
  return store;
}

export function createAgentStore(): AgentStore {
  const db = getDb();
  if (db && isDatabaseConfigured()) {
    return new PostgresAgentStore(db);
  }
  return new JsonFileAgentStore(process.env.AGENT_STORE_FILE ?? DEFAULT_AGENT_STORE_FILE);
}

export function resetAgentStoreForTests(storeFile: string | null): void {
  store = new JsonFileAgentStore(storeFile);
}

export function __setAgentStoreForTests(next: AgentStore): void {
  store = next;
}

export async function __resetAgentsForTests(): Promise<void> {
  if (store) {
    await store.clear();
  }
  store = new JsonFileAgentStore(null);
}
