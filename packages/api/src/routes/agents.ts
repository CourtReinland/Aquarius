import { Hono } from 'hono';
import { z } from 'zod';
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseEther,
  type Hash,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  createCipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENT_PASSPORT_SCHEMA_VERSION,
  AGENT_STANDARD,
  LEGACY_AGENT_CARD_SCHEMA_VERSION,
  createDefaultAgentPassportInput,
  type AgentCapabilities,
  type AgentEconomics,
  type AgentEmbodiment,
  type AgentIdentity,
  type AgentMemoryPolicy,
  type AgentOrigin,
  type AgentPermissionClass,
  type AgentPersonality,
  type AquariusAgentPassportV1,
} from '@aquarius/shared';
import { getSessionFromAuthorization } from './auth.js';
import { maxInitialFundingEth, operatorActionsAllowed } from '../lib/env.js';

export const agentRoutes = new Hono();

const AGENT_PERMISSION_CLASS_INDEX: Record<AgentPermissionClass, number> = {
  visitor: 0,
  resident: 1,
  worker: 2,
  delegate: 3,
  officer: 4,
  sovereign: 5,
};

export function agentPermissionClassIndex(permissionClass: AgentPermissionClass): number {
  return AGENT_PERMISSION_CLASS_INDEX[permissionClass];
}

const agentRegistrationAbi = [
  {
    type: 'function',
    name: 'registerAIAgent',
    inputs: [
      { name: '_agentAddress', type: 'address', internalType: 'address' },
      { name: '_agentId', type: 'string', internalType: 'string' },
      { name: '_metadataURI', type: 'string', internalType: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'registerAIAgentWithClass',
    inputs: [
      { name: '_agentAddress', type: 'address', internalType: 'address' },
      { name: '_agentId', type: 'string', internalType: 'string' },
      { name: '_metadataURI', type: 'string', internalType: 'string' },
      { name: '_permissionClass', type: 'uint8', internalType: 'enum Community.AgentPermissionClass' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const hashSchema = z.string().regex(/^(0x)?[a-fA-F0-9]{64}$/, 'hash must be a 32-byte hex value');

const originSchema = z.object({
  mode: z.enum(['scratch', 'template', 'clone', 'hire', 'import']).default('scratch'),
  parentAgentId: z.string().max(240).nullable().optional(),
  templateId: z.string().max(160).nullable().optional(),
  lineageHash: hashSchema.nullable().optional(),
}).superRefine((origin, ctx) => {
  if (origin.mode === 'template' && !origin.templateId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['templateId'], message: 'template origin requires templateId' });
  }

  if ((origin.mode === 'clone' || origin.mode === 'hire') && !origin.parentAgentId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parentAgentId'], message: `${origin.mode} origin requires parentAgentId` });
  }

  if (origin.mode === 'scratch' && (origin.parentAgentId || origin.templateId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mode'], message: 'scratch origin cannot include parentAgentId or templateId' });
  }
}).optional();

const identitySchema = z.object({
  biography: z.string().max(2000).default(''),
  pronouns: z.string().max(40).nullable().optional(),
  anthropomorphism: z.enum(['minimal', 'balanced', 'high', 'agent-discretion']).default('agent-discretion'),
}).optional();

const embodimentSchema = z.object({
  avatarUri: z.string().url().nullable().optional(),
  avatarManifestUri: z.string().url().nullable().optional(),
  portraitUri: z.string().url().nullable().optional(),
  portraitProvider: z.string().max(80).default('gemini-nano-banana'),
  portraitSeed: z.string().max(160).nullable().optional(),
  style: z.string().max(160).nullable().optional(),
  bodyArchetype: z.string().max(120).nullable().optional(),
  outfit: z.string().max(160).nullable().optional(),
  voiceId: z.string().max(160).nullable().optional(),
  selfieEndpoint: z.string().url().nullable().optional(),
}).optional();

const personalitySchema = z.object({
  traits: z.record(z.number().min(0).max(1)).default({}),
  greeting: z.string().max(500).nullable().optional(),
  refusalStyle: z.string().max(300).nullable().optional(),
  conflictStyle: z.string().max(300).nullable().optional(),
}).optional();

const permissionPolicySchema = z.object({
  permissionClass: z.enum(['visitor', 'resident', 'worker', 'delegate', 'officer', 'sovereign']).default('worker'),
  permissionPolicyUri: z.string().url().nullable().optional(),
  permissionPolicyHash: hashSchema.nullable().optional(),
}).optional();

const memoryPolicySchema = z.object({
  mode: z.enum(['session-only', 'personal-companion', 'community-memory', 'officer-memory', 'clone-safe']).default('session-only'),
  remembersPrivateChats: z.boolean().optional(),
  remembersCommunityEvents: z.boolean().optional(),
  cloneSafe: z.boolean().optional(),
  retentionDays: z.number().int().min(1).max(3650).nullable().optional(),
  editableAfterCreation: z.boolean().default(true),
}).optional();

const economicsSchema = z.object({
  hireable: z.boolean().default(false),
  cloneable: z.boolean().default(false),
  license: z.string().max(120).nullable().optional(),
  feeRecipient: z.string().refine(isAddress, 'feeRecipient must be an EVM address').nullable().optional(),
  hirePrice: z.string().max(80).nullable().optional(),
  clonePrice: z.string().max(80).nullable().optional(),
  revenueSplitBps: z.number().int().min(0).max(10000).nullable().optional(),
  feeMode: z.enum(['off-chain', 'on-chain']).default('off-chain'),
}).optional();

const walletStorageSchema = z.object({
  type: z.enum(['local-encrypted', 'kms', 'lit', 'smart-account-session']).default('local-encrypted'),
  keyRef: z.string().max(240).nullable().optional(),
  humanApprovalRequired: z.boolean().default(true),
}).optional();

const createAgentSchema = z.object({
  communityAddress: z.string().refine(isAddress, 'communityAddress must be an EVM address'),
  communityName: z.string().min(1).max(100).optional(),
  /** Optional; when present must match the authenticated session address. Session wins. */
  creatorAddress: z.string().refine(isAddress, 'creatorAddress must be an EVM address').optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(1000).default(''),
  role: z.string().max(120).default(''),
  capabilities: z.array(z.string().min(1).max(80)).min(1).max(20),
  promptTemplate: z.string().min(1).max(8000),
  initialFundingEth: z
    .string()
    .regex(/^\d+(\.\d{1,18})?$/, 'initialFundingEth must be an ETH amount string')
    .default('0'),
  registerOnChain: z.boolean().optional(),
  runtime: z
    .object({
      provider: z.string().max(80).default('xai'),
      model: z.string().max(120).default('grok-4'),
      harness: z.enum(['hermes', 'openclaw', 'custom']).default('hermes'),
    })
    .default({ provider: 'xai', model: 'grok-4', harness: 'hermes' }),
  walletStorage: walletStorageSchema,
  origin: originSchema,
  identity: identitySchema,
  embodiment: embodimentSchema,
  personality: personalitySchema,
  memoryPolicy: memoryPolicySchema,
  permissionPolicy: permissionPolicySchema,
  economics: economicsSchema,
});

type CreateAgentInput = z.infer<typeof createAgentSchema>;

const updateAgentSchema = z.object({
  identity: z.object({
    biography: z.string().max(2000).optional(),
    pronouns: z.string().max(40).nullable().optional(),
    anthropomorphism: z.enum(['minimal', 'balanced', 'high', 'agent-discretion']).optional(),
  }).optional(),
  embodiment: z.object({
    avatarUri: z.string().url().nullable().optional(),
    avatarManifestUri: z.string().url().nullable().optional(),
    portraitUri: z.string().url().nullable().optional(),
    portraitProvider: z.string().max(80).optional(),
    portraitSeed: z.string().max(160).nullable().optional(),
    style: z.string().max(160).nullable().optional(),
    bodyArchetype: z.string().max(120).nullable().optional(),
    outfit: z.string().max(160).nullable().optional(),
    voiceId: z.string().max(160).nullable().optional(),
    selfieEndpoint: z.string().url().nullable().optional(),
  }).optional(),
  personality: z.object({
    traits: z.record(z.number().min(0).max(1)).optional(),
    greeting: z.string().max(500).nullable().optional(),
    refusalStyle: z.string().max(300).nullable().optional(),
    conflictStyle: z.string().max(300).nullable().optional(),
  }).optional(),
  memoryPolicy: memoryPolicySchema,
  permissionPolicy: permissionPolicySchema,
  economics: z.object({
    hireable: z.boolean().optional(),
    cloneable: z.boolean().optional(),
    license: z.string().max(120).nullable().optional(),
    feeRecipient: z.string().refine(isAddress, 'feeRecipient must be an EVM address').nullable().optional(),
    hirePrice: z.string().max(80).nullable().optional(),
    clonePrice: z.string().max(80).nullable().optional(),
    revenueSplitBps: z.number().int().min(0).max(10000).nullable().optional(),
    feeMode: z.enum(['off-chain', 'on-chain']).optional(),
  }).optional(),
});

type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

const chatTurnSchema = z.object({
  message: z.string().min(1).max(4000),
  userAddress: z.string().refine(isAddress, 'userAddress must be an EVM address').optional(),
  sessionId: z.string().max(160).optional(),
});

const signingRequestSchema = z.object({
  action: z.enum(['send-transaction', 'contract-call', 'message-signature']),
  to: z.string().refine(isAddress, 'to must be an EVM address').nullable().optional(),
  valueEth: z.string().regex(/^\d+(\.\d{1,18})?$/, 'valueEth must be an ETH amount string').default('0'),
  data: z.string().max(20000).nullable().optional(),
  risk: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  reason: z.string().min(1).max(500),
  humanApproved: z.boolean().default(false),
  approvedBy: z.string().refine(isAddress, 'approvedBy must be an EVM address').nullable().optional(),
});

type SigningRequestInput = z.infer<typeof signingRequestSchema>;

const contractEventSchema = z.object({
  transactionHash: hashSchema,
  eventName: z.string().min(1).max(120),
  blockNumber: z.number().int().nonnegative().optional(),
  payload: z.record(z.unknown()).default({}),
});

type ContractEventInput = z.infer<typeof contractEventSchema>;

type ChatTurnInput = z.infer<typeof chatTurnSchema>;

interface StoredAgent {
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

type PublicStoredAgent = Omit<StoredAgent, 'encryptedPrivateKey' | 'promptTemplate'>;

type WalletStorageType = 'local-encrypted' | 'kms' | 'lit' | 'smart-account-session';

interface AgentWalletPolicy {
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

interface AgentSigningRequest {
  id: string;
  agentId: string;
  action: SigningRequestInput['action'];
  to: `0x${string}` | null;
  valueEth: string;
  data: string | null;
  risk: SigningRequestInput['risk'];
  reason: string;
  status: 'pending-human-approval' | 'approved-not-signed' | 'rejected-by-policy';
  humanApprovalRequired: boolean;
  approvedBy: `0x${string}` | null;
  transactionHash: Hash | null;
  createdAt: string;
}

interface AgentMemoryRecord {
  id: string;
  agentId: string;
  type: 'chat-turn' | 'contract-event';
  visibility: 'community' | 'private' | 'session';
  summary: string;
  sourceEventId: string;
  createdAt: string;
}

interface ContractWatcherState {
  status: 'reserved' | 'connected';
  lastTransactionHash: string | null;
  lastEventName: string | null;
  lastBlockNumber: number | null;
}

interface PrivateRuntimeConfig {
  agentId: string;
  promptTemplate: string;
  encryptedPrivateKey: EncryptedPrivateKey | null;
      runtimeConfig: {
        harness: string;
        provider: string;
        model: string;
        promptHash: string;
        keyStorage: StoredAgent['keyStorage'];
        walletStorage: AgentWalletPolicy['storage'];
      };
  updatedAt: string;
}

interface AgentStoreDocumentV2 {
  version: 2;
  publicAgents: PublicStoredAgent[];
  privateRuntimeConfigs: PrivateRuntimeConfig[];
}

interface AgentRuntimeEvent {
  id: string;
  agentId: string;
  type: 'chat.user_message' | 'chat.agent_message' | 'runtime.signing_request' | 'contract.event';
  actorAddress: `0x${string}` | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface AgentCard {
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

interface EncryptedPrivateKey {
  algorithm: 'aes-256-gcm';
  ciphertext: string;
  iv: string;
  tag: string;
}

interface RegistrationResult {
  mode: 'on-chain' | 'skipped' | 'failed';
  transactionHash: Hash | null;
  reason?: string;
}

interface FundingResult {
  requestedEth: string;
  transactionHash: Hash | null;
  status: 'sent' | 'skipped' | 'failed';
  reason?: string;
}

interface FirstMoment {
  introMessage: string;
  passportUrl: string;
  portraitStatus: 'pending-media-service' | 'configured';
  suggestedCommunityPost: string;
}

const DEFAULT_AGENT_STORE_FILE = fileURLToPath(new URL('../../data/agents.json', import.meta.url));
let agentStoreFile: string | null = process.env.AGENT_STORE_FILE ?? DEFAULT_AGENT_STORE_FILE;
let agents = loadAgentsFromStore();

function loadAgentsFromStore(): Map<string, StoredAgent> {
  if (!agentStoreFile || !existsSync(agentStoreFile)) return new Map();

  const raw = readFileSync(agentStoreFile, 'utf8').trim();
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
      walletPolicy: publicAgent.walletPolicy ?? buildWalletPolicy({ type: 'local-encrypted', humanApprovalRequired: true }, Boolean(runtimeConfig?.encryptedPrivateKey)),
    };
    return [restoredAgent.agentId, restoredAgent];
  }));
}

function persistAgentsToStore() {
  if (!agentStoreFile) return;
  mkdirSync(dirname(agentStoreFile), { recursive: true });
  const document: AgentStoreDocumentV2 = {
    version: 2,
    publicAgents: [...agents.values()].map((agent) => {
      const { encryptedPrivateKey, promptTemplate, ...publicAgent } = agent;
      return publicAgent;
    }),
    privateRuntimeConfigs: [...agents.values()].map((agent) => ({
      agentId: agent.agentId,
      promptTemplate: agent.promptTemplate,
      encryptedPrivateKey: agent.encryptedPrivateKey,
      runtimeConfig: {
        harness: agent.passport.runtime.harness,
        provider: agent.passport.runtime.provider,
        model: agent.passport.runtime.model,
        promptHash: agent.promptHash,
        keyStorage: agent.keyStorage,
        walletStorage: agent.walletPolicy.storage,
      },
      updatedAt: agent.passport.updatedAt,
    })),
  };
  writeFileSync(agentStoreFile, JSON.stringify(document, null, 2));
}

export function resetAgentStoreForTests(storeFile: string | null) {
  agentStoreFile = storeFile;
  agents = loadAgentsFromStore();
}

/** Test helper — clears in-memory agent registry without changing the store path. */
export function __resetAgentsForTests() {
  agents.clear();
}

function wantsOperatorAction(input: CreateAgentInput): boolean {
  try {
    return Boolean(input.registerOnChain) || parseEther(input.initialFundingEth) > 0n;
  } catch {
    return Boolean(input.registerOnChain);
  }
}

function publicApiBaseUrl() {
  return process.env.AQUARIUS_PUBLIC_API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
}

function runtimeBaseUrl() {
  return process.env.AGENT_RUNTIME_BASE_URL ?? `${publicApiBaseUrl()}/api/agents`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'agent';
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function encryptPrivateKey(privateKey: `0x${string}`): EncryptedPrivateKey | null {
  const secret = process.env.AGENT_KEY_ENCRYPTION_SECRET;
  if (!secret) return null;

  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(privateKey, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    algorithm: 'aes-256-gcm',
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function defaultContractWatcherState(): ContractWatcherState {
  return {
    status: 'reserved',
    lastTransactionHash: null,
    lastEventName: null,
    lastBlockNumber: null,
  };
}

function signerForStorage(type: WalletStorageType): AgentWalletPolicy['signer'] {
  if (type === 'kms') return 'kms';
  if (type === 'lit') return 'lit';
  if (type === 'smart-account-session') return 'smart-account';
  return 'eoa';
}

function buildWalletPolicy(input: z.infer<typeof walletStorageSchema>, hasEncryptedKey: boolean): AgentWalletPolicy {
  const requestedType = input?.type ?? 'local-encrypted';
  const configured = requestedType === 'local-encrypted' ? hasEncryptedKey : Boolean(input?.keyRef);
  return {
    storage: {
      type: requestedType,
      keyRef: input?.keyRef ?? null,
      configured,
    },
    signer: signerForStorage(requestedType),
    humanApprovalRequired: input?.humanApprovalRequired ?? true,
    riskyActions: ['send-transaction', 'contract-call', 'trade-crypto', 'manage-treasury', 'vote'],
    sessionKey: {
      enabled: requestedType === 'smart-account-session',
      expiresAt: requestedType === 'smart-account-session' ? null : null,
    },
  };
}

const SAFE_TOOL_CAPABILITIES = new Set(['chat', 'read-community-history', 'monitor-proposals', 'draft-proposals', 'generate-public-posts']);

function sandboxPolicy(agent: StoredAgent) {
  const publicCapabilities = agent.passport.capabilities.public;
  const allowedTools = publicCapabilities.filter((capability) => SAFE_TOOL_CAPABILITIES.has(capability));
  return {
    allowedTools,
    blockedCapabilities: publicCapabilities.filter((capability) => !SAFE_TOOL_CAPABILITIES.has(capability)),
    approvalRequired: true,
    reason: 'Only read/chat/draft tools are enabled in the MVP sandbox; signing and risky actions require explicit human approval.',
  };
}

function shouldPersistCommunityMemory(agent: StoredAgent) {
  return agent.passport.memoryPolicy.remembersCommunityEvents || agent.passport.memoryPolicy.mode === 'community-memory';
}

function addMemoryRecord(agent: StoredAgent, params: Omit<AgentMemoryRecord, 'id' | 'agentId' | 'createdAt'>) {
  const record: AgentMemoryRecord = {
    id: `mem_${randomUUID()}`,
    agentId: agent.agentId,
    createdAt: new Date().toISOString(),
    ...params,
  };
  agent.memoryRecords.push(record);
  return record;
}

function orchestratorStatus(agent: StoredAgent) {
  const policy = sandboxPolicy(agent);
  return {
    agentId: agent.agentId,
    workerService: {
      configured: true,
      active: false,
      reason: 'The API hosts the MVP orchestrator boundary; no external worker process is attached yet.',
    },
    eventQueue: {
      type: 'durable-json-bridge',
      depth: agent.events.length,
      unprocessed: agent.events.length,
    },
    runtimeAdapter: {
      harness: agent.passport.runtime.harness,
      provider: agent.passport.runtime.provider,
      model: agent.passport.runtime.model,
      status: agent.passport.runtime.status,
    },
    memoryStore: {
      mode: agent.passport.memoryPolicy.mode,
      records: agent.memoryRecords.length,
      privateMemoryExposed: false,
    },
    contractWatcher: agent.contractWatcher,
    sandbox: policy,
  };
}

function safeAgent(agent: StoredAgent) {
  const {
    promptTemplate,
    encryptedPrivateKey,
    ...publicAgent
  } = agent;

  return {
    ...publicAgent,
    hasEncryptedKey: Boolean(encryptedPrivateKey),
  };
}

function buildFirstMoment(agent: StoredAgent): FirstMoment {
  const greeting = agent.passport.personality.greeting?.trim();
  const role = agent.passport.identity.role || 'community agent';
  const introMessage = greeting || `Hello, I am ${agent.passport.identity.name}, a ${role} for ${agent.communityName ?? 'this community'}.`;

  return {
    introMessage,
    passportUrl: agent.metadataUri,
    portraitStatus: agent.passport.embodiment.portraitUri ? 'configured' : 'pending-media-service',
    suggestedCommunityPost: `${introMessage} My public passport is available at ${agent.metadataUri}`,
  };
}

function buildPendingOrchestratorChatResponse(agent: StoredAgent, input: ChatTurnInput, persistedMemory: boolean = false) {
  const greeting = agent.passport.personality.greeting;
  const intro = greeting ? `${greeting} ` : `I am ${agent.passport.identity.name}. `;
  const runtime = agent.passport.runtime;
  const policy = sandboxPolicy(agent);

  return {
    success: true,
    agentId: agent.agentId,
    sessionId: input.sessionId ?? `session_${randomUUID()}`,
    received: {
      role: 'user',
      content: input.message,
      userAddress: input.userAddress ?? null,
    },
    message: {
      id: `msg_${randomUUID()}`,
      role: 'agent',
      content: `${intro}${agent.passport.identity.name} is registered and reachable through the MVP ${runtime.harness} orchestrator boundary. A live external worker is not attached yet, but this route queues events, applies sandbox policy, and stores permitted memory without exposing hidden instructions or keys.`,
      createdAt: new Date().toISOString(),
    },
    runtime: {
      harness: runtime.harness,
      provider: runtime.provider,
      model: runtime.model,
      status: runtime.status,
    },
    memoryBoundary: {
      persisted: persistedMemory,
      reason: persistedMemory ? 'Community-safe memory summary was persisted for this chat turn.' : 'This agent memory policy does not persist chat turns yet.',
    },
    toolPolicy: policy,
  };
}

async function registerAgentOnChain(
  input: CreateAgentInput,
  agentAddress: `0x${string}`,
  agentId: string,
  metadataUri: string
): Promise<RegistrationResult> {
  const operatorPrivateKey = process.env.AQUARIUS_OPERATOR_PRIVATE_KEY as `0x${string}` | undefined;
  const rpcUrl = process.env.AQUARIUS_RPC_URL ?? process.env.RPC_URL;
  const shouldRegister = input.registerOnChain ?? Boolean(operatorPrivateKey && rpcUrl);

  if (!shouldRegister) {
    return {
      mode: 'skipped',
      transactionHash: null,
      reason: 'registerOnChain was false and no operator wallet was configured',
    };
  }

  if (!operatorPrivateKey || !rpcUrl) {
    return {
      mode: 'skipped',
      transactionHash: null,
      reason: 'Set AQUARIUS_OPERATOR_PRIVATE_KEY and AQUARIUS_RPC_URL to register on-chain',
    };
  }

  try {
    const operator = privateKeyToAccount(operatorPrivateKey);
    const walletClient = createWalletClient({
      account: operator,
      transport: http(rpcUrl),
    });
    const publicClient = createPublicClient({ transport: http(rpcUrl) });

    const permissionClass = input.permissionPolicy?.permissionClass ?? 'worker';
    const transactionHash = await walletClient.writeContract({
      address: input.communityAddress as `0x${string}`,
      abi: agentRegistrationAbi,
      functionName: 'registerAIAgentWithClass',
      args: [agentAddress, agentId, metadataUri, agentPermissionClassIndex(permissionClass)],
      chain: null,
      account: operator,
    } as any);

    await publicClient.waitForTransactionReceipt({ hash: transactionHash });

    return {
      mode: 'on-chain',
      transactionHash,
    };
  } catch (error: any) {
    return {
      mode: 'failed',
      transactionHash: null,
      reason: error?.shortMessage ?? error?.message ?? 'On-chain registration failed',
    };
  }
}

async function fundAgentWallet(
  input: CreateAgentInput,
  agentAddress: `0x${string}`
): Promise<FundingResult> {
  const requestedWei = parseEther(input.initialFundingEth);

  if (requestedWei === 0n) {
    return {
      requestedEth: input.initialFundingEth,
      transactionHash: null,
      status: 'skipped',
      reason: 'No initial funding requested',
    };
  }

  const operatorPrivateKey = process.env.AQUARIUS_OPERATOR_PRIVATE_KEY as `0x${string}` | undefined;
  const rpcUrl = process.env.AQUARIUS_RPC_URL ?? process.env.RPC_URL;

  if (!operatorPrivateKey || !rpcUrl) {
    return {
      requestedEth: input.initialFundingEth,
      transactionHash: null,
      status: 'skipped',
      reason: 'Set AQUARIUS_OPERATOR_PRIVATE_KEY and AQUARIUS_RPC_URL to fund agent wallets',
    };
  }

  try {
    const operator = privateKeyToAccount(operatorPrivateKey);
    const walletClient = createWalletClient({
      account: operator,
      transport: http(rpcUrl),
    });
    const publicClient = createPublicClient({ transport: http(rpcUrl) });
    const transactionHash = await walletClient.sendTransaction({
      to: agentAddress,
      value: requestedWei,
      chain: null,
    });

    await publicClient.waitForTransactionReceipt({ hash: transactionHash });

    return {
      requestedEth: input.initialFundingEth,
      transactionHash,
      status: 'sent',
    };
  } catch (error: any) {
    return {
      requestedEth: input.initialFundingEth,
      transactionHash: null,
      status: 'failed',
      reason: error?.shortMessage ?? error?.message ?? 'Initial funding failed',
    };
  }
}

function normalizeMemoryPolicy(current: AgentMemoryPolicy, update?: UpdateAgentInput['memoryPolicy']): AgentMemoryPolicy {
  if (!update) return current;
  const mode = update.mode ?? current.mode;
  return {
    ...current,
    ...update,
    mode,
    remembersPrivateChats: update?.remembersPrivateChats
      ?? (mode === 'personal-companion' || mode === 'officer-memory'),
    remembersCommunityEvents: update?.remembersCommunityEvents
      ?? (mode === 'community-memory' || mode === 'officer-memory' || current.remembersCommunityEvents),
    cloneSafe: update?.cloneSafe ?? (mode === 'clone-safe' || current.cloneSafe),
    retentionDays: update?.retentionDays ?? current.retentionDays,
    editableAfterCreation: update?.editableAfterCreation ?? current.editableAfterCreation,
  };
}

function nextUpdatedAt(previous: string) {
  const now = new Date();
  const previousMs = Date.parse(previous);
  if (Number.isFinite(previousMs) && now.getTime() <= previousMs) {
    return new Date(previousMs + 1).toISOString();
  }
  return now.toISOString();
}

function applyAgentUpdate(agent: StoredAgent, update: UpdateAgentInput): StoredAgent {
  const updatedAt = nextUpdatedAt(agent.passport.updatedAt);
  const passport: AquariusAgentPassportV1 = {
    ...agent.passport,
    identity: update.identity ? { ...agent.passport.identity, ...update.identity } : agent.passport.identity,
    embodiment: update.embodiment ? { ...agent.passport.embodiment, ...update.embodiment } : agent.passport.embodiment,
    personality: update.personality
      ? {
          ...agent.passport.personality,
          ...update.personality,
          traits: update.personality.traits
            ? { ...agent.passport.personality.traits, ...update.personality.traits }
            : agent.passport.personality.traits,
        }
      : agent.passport.personality,
    memoryPolicy: normalizeMemoryPolicy(agent.passport.memoryPolicy, update.memoryPolicy),
    capabilities: update.permissionPolicy
      ? {
          ...agent.passport.capabilities,
          permissionClass: update.permissionPolicy.permissionClass ?? agent.passport.capabilities.permissionClass,
          permissionPolicyUri: update.permissionPolicy.permissionPolicyUri ?? agent.passport.capabilities.permissionPolicyUri,
          permissionPolicyHash: update.permissionPolicy.permissionPolicyHash ?? agent.passport.capabilities.permissionPolicyHash,
        }
      : agent.passport.capabilities,
    economics: update.economics ? { ...agent.passport.economics, ...update.economics } : agent.passport.economics,
    updatedAt,
  };

  return {
    ...agent,
    passport,
    agentCard: {
      ...agent.agentCard,
      runtime: {
        ...agent.agentCard.runtime,
      },
      capabilities: passport.capabilities.public,
    },
  };
}

function buildAgentPassport(input: CreateAgentInput, params: {
  agentId: string;
  agentAddress: `0x${string}`;
  cardUrl: string;
  passportUrl: string;
  promptHash: string;
  createdAt: string;
}): AquariusAgentPassportV1 {
  const defaults = createDefaultAgentPassportInput();
  const runtimeA2a = `${runtimeBaseUrl()}/${encodeURIComponent(params.agentId)}/a2a`;
  const runtimeMcp = `${runtimeBaseUrl()}/${encodeURIComponent(params.agentId)}/mcp`;
  const runtimeChat = `${runtimeBaseUrl()}/${encodeURIComponent(params.agentId)}/chat`;

  const origin: AgentOrigin = {
    ...defaults.origin,
    ...input.origin,
    parentAgentId: input.origin?.parentAgentId ?? defaults.origin.parentAgentId,
    templateId: input.origin?.templateId ?? defaults.origin.templateId,
    lineageHash: input.origin?.lineageHash ?? defaults.origin.lineageHash,
  };

  const identity: AgentIdentity = {
    name: input.name,
    role: input.role,
    description: input.description,
    biography: input.identity?.biography ?? defaults.identity.biography,
    pronouns: input.identity?.pronouns ?? defaults.identity.pronouns,
    anthropomorphism: input.identity?.anthropomorphism ?? defaults.identity.anthropomorphism,
  };

  const embodiment: AgentEmbodiment = {
    ...defaults.embodiment,
    ...input.embodiment,
    portraitProvider: input.embodiment?.portraitProvider ?? defaults.embodiment.portraitProvider,
    selfieEndpoint: input.embodiment?.selfieEndpoint ?? `${runtimeBaseUrl()}/${encodeURIComponent(params.agentId)}/selfies`,
  };

  const personality: AgentPersonality = {
    ...defaults.personality,
    ...input.personality,
    traits: input.personality?.traits ?? defaults.personality.traits,
  };

  const memoryPolicy: AgentMemoryPolicy = {
    ...defaults.memoryPolicy,
    ...input.memoryPolicy,
    remembersPrivateChats: input.memoryPolicy?.remembersPrivateChats
      ?? (input.memoryPolicy?.mode === 'personal-companion' || input.memoryPolicy?.mode === 'officer-memory'),
    remembersCommunityEvents: input.memoryPolicy?.remembersCommunityEvents
      ?? (input.memoryPolicy?.mode === 'community-memory' || input.memoryPolicy?.mode === 'officer-memory'),
    cloneSafe: input.memoryPolicy?.cloneSafe ?? (input.memoryPolicy?.mode === 'clone-safe' || defaults.memoryPolicy.cloneSafe),
    retentionDays: input.memoryPolicy?.retentionDays ?? defaults.memoryPolicy.retentionDays,
    editableAfterCreation: input.memoryPolicy?.editableAfterCreation ?? defaults.memoryPolicy.editableAfterCreation,
  };

  const capabilities: AgentCapabilities = {
    public: input.capabilities,
    permissionClass: input.permissionPolicy?.permissionClass ?? defaults.capabilities.permissionClass,
    permissionPolicyUri: input.permissionPolicy?.permissionPolicyUri ?? defaults.capabilities.permissionPolicyUri,
    permissionPolicyHash: input.permissionPolicy?.permissionPolicyHash ?? defaults.capabilities.permissionPolicyHash,
  };

  const economics: AgentEconomics = {
    ...defaults.economics,
    ...input.economics,
    feeRecipient: (input.economics?.feeRecipient as `0x${string}` | undefined) ?? defaults.economics.feeRecipient,
    revenueSplitBps: input.economics?.revenueSplitBps ?? defaults.economics.revenueSplitBps,
    feeMode: input.economics?.feeMode ?? defaults.economics.feeMode,
  };

  return {
    schemaVersion: AGENT_PASSPORT_SCHEMA_VERSION,
    standard: AGENT_STANDARD,
    agentId: params.agentId,
    agentAddress: params.agentAddress,
    communityAddress: input.communityAddress as `0x${string}`,
    communityName: input.communityName ?? null,
    creatorAddress: (input.creatorAddress as `0x${string}` | undefined) ?? null,
    origin,
    identity,
    embodiment,
    personality,
    memoryPolicy,
    capabilities,
    wallet: {
      type: defaults.wallet.type,
      chain: process.env.AQUARIUS_CHAIN_NAME ?? 'local-or-base',
      address: params.agentAddress,
    },
    runtime: {
      harness: input.runtime.harness,
      provider: input.runtime.provider,
      model: input.runtime.model,
      status: 'pending-orchestrator',
      endpoints: {
        card: params.cardUrl,
        passport: params.passportUrl,
        chat: runtimeChat,
        a2a: runtimeA2a,
        mcp: runtimeMcp,
      },
    },
    economics,
    hashes: {
      promptHash: params.promptHash,
      memoryRootHash: defaults.hashes.memoryRootHash,
      avatarManifestHash: defaults.hashes.avatarManifestHash,
      runtimePolicyHash: defaults.hashes.runtimePolicyHash,
    },
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
  };
}

/**
 * POST /api/agents/create
 * Create an Aquarius AI-agent identity, wallet, agent card, passport, and optional
 * on-chain registration inside a Community contract.
 *
 * Always requires a valid wallet session. `creatorAddress` is bound to the
 * session address (session wins; a mismatched body field is rejected).
 */
agentRoutes.post('/create', async (c) => {
  try {
    const body = await c.req.json();
    const input = createAgentSchema.parse(body);
    const creatorSession = await getSessionFromAuthorization(c.req.header('authorization'));

    if (!creatorSession) {
      return c.json({
        error: 'Wallet session required',
        message: 'Sign in with your wallet before creating an agent.',
      }, 401);
    }

    if (
      input.creatorAddress &&
      creatorSession.address.toLowerCase() !== input.creatorAddress.toLowerCase()
    ) {
      return c.json({
        error: 'Creator mismatch',
        message: 'creatorAddress must match the authenticated wallet session.',
      }, 403);
    }

    // Session is the source of truth for attribution.
    const creatorAddress = creatorSession.address;
    const boundInput: CreateAgentInput = {
      ...input,
      creatorAddress,
    };

    if (wantsOperatorAction(boundInput)) {
      const gate = operatorActionsAllowed(creatorAddress);
      if (!gate.ok) {
        return c.json({
          error: 'Operator action not permitted',
          message: gate.reason,
        }, 403);
      }

      let requestedWei: bigint;
      let maxWei: bigint;
      try {
        requestedWei = parseEther(boundInput.initialFundingEth);
        maxWei = parseEther(maxInitialFundingEth());
      } catch {
        return c.json({
          error: 'Invalid funding amount',
          message: 'initialFundingEth or AGENT_MAX_INITIAL_FUNDING_ETH is not a valid ETH amount.',
        }, 400);
      }

      if (requestedWei > maxWei) {
        return c.json({
          error: 'Funding cap exceeded',
          message: `initialFundingEth exceeds AGENT_MAX_INITIAL_FUNDING_ETH (${maxInitialFundingEth()}).`,
          maxInitialFundingEth: maxInitialFundingEth(),
        }, 400);
      }
    }

    const createdAt = new Date().toISOString();

    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const communityShort = boundInput.communityAddress.slice(2, 10).toLowerCase();
    const agentId = `did:erc8004:aquarius:${communityShort}:${slugify(boundInput.name)}-${randomUUID()}`;
    const cardUrl = `${publicApiBaseUrl()}/api/agents/${encodeURIComponent(agentId)}/card`;
    const passportUrl = `${publicApiBaseUrl()}/api/agents/${encodeURIComponent(agentId)}/passport`;
    const metadataUri = passportUrl;
    const promptHash = hashValue(boundInput.promptTemplate);
    const passport = buildAgentPassport(boundInput, {
      agentId,
      agentAddress: account.address,
      cardUrl,
      passportUrl,
      promptHash,
      createdAt,
    });

    const agentCard: AgentCard = {
      schemaVersion: LEGACY_AGENT_CARD_SCHEMA_VERSION,
      standard: AGENT_STANDARD,
      agentId,
      name: boundInput.name,
      description: boundInput.description,
      role: boundInput.role,
      capabilities: boundInput.capabilities,
      communityAddress: boundInput.communityAddress as `0x${string}`,
      communityName: boundInput.communityName ?? null,
      paymentAddress: account.address,
      wallet: {
        type: 'EOA',
        chain: process.env.AQUARIUS_CHAIN_NAME ?? 'local-or-base',
      },
      runtime: {
        provider: boundInput.runtime.provider,
        model: boundInput.runtime.model,
        status: 'pending-orchestrator',
      },
      endpoints: {
        card: cardUrl,
        a2a: `${runtimeBaseUrl()}/${encodeURIComponent(agentId)}/a2a`,
        mcp: `${runtimeBaseUrl()}/${encodeURIComponent(agentId)}/mcp`,
      },
      promptHash,
      createdAt,
    };

    const encryptedPrivateKey = encryptPrivateKey(privateKey);
    const walletPolicy = buildWalletPolicy(boundInput.walletStorage, Boolean(encryptedPrivateKey));
    const registration = await registerAgentOnChain(boundInput, account.address, agentId, metadataUri);
    const initialFunding = await fundAgentWallet(boundInput, account.address);

    const storedAgent: StoredAgent = {
      agentId,
      communityAddress: boundInput.communityAddress as `0x${string}`,
      communityName: boundInput.communityName ?? null,
      creatorAddress,
      walletAddress: account.address,
      agentCard,
      passport,
      metadataUri,
      encryptedPrivateKey,
      keyStorage: encryptedPrivateKey ? 'encrypted-memory' : 'not-stored',
      walletPolicy,
      registration,
      initialFunding,
      promptHash,
      promptTemplate: boundInput.promptTemplate,
      events: [],
      signingRequests: [],
      memoryRecords: [],
      contractWatcher: defaultContractWatcherState(),
      createdAt,
    };

    agents.set(agentId, storedAgent);
    persistAgentsToStore();

    return c.json({
      success: true,
      agent: safeAgent(storedAgent),
      firstMoment: buildFirstMoment(storedAgent),
      warnings: encryptedPrivateKey
        ? []
        : ['AGENT_KEY_ENCRYPTION_SECRET is not set; private key was not persisted by the API process'],
    }, 201);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return c.json({ error: 'Invalid agent parameters', details: error.issues }, 400);
    }

    return c.json({
      error: 'Agent creation failed',
      message: error?.message?.substring(0, 240),
    }, 500);
  }
});

/**
 * GET /api/agents
 * List agents created by the authenticated wallet.
 * Optional: ?communityAddress=0x... further filters the caller's creations.
 */
agentRoutes.get('/', async (c) => {
  const session = await getSessionFromAuthorization(c.req.header('authorization'));

  if (!session) {
    return c.json({
      error: 'Wallet session required',
      message: 'Sign in to list agents you created.',
    }, 401);
  }

  const communityAddress = c.req.query('communityAddress');
  if (communityAddress && !isAddress(communityAddress)) {
    return c.json({ error: 'Invalid communityAddress' }, 400);
  }

  const list = [...agents.values()]
    .filter((agent) => agent.creatorAddress?.toLowerCase() === session.address.toLowerCase())
    .filter(
      (agent) =>
        !communityAddress ||
        agent.communityAddress.toLowerCase() === communityAddress.toLowerCase()
    )
    .map(safeAgent);

  return c.json({
    agents: list,
    total: list.length,
  });
});

agentRoutes.get('/:agentId', (c) => {
  const agentId = decodeURIComponent(c.req.param('agentId'));
  const agent = agents.get(agentId);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json({ agent: safeAgent(agent) });
});

agentRoutes.patch('/:agentId', async (c) => {
  try {
    const agentId = decodeURIComponent(c.req.param('agentId'));
    const agent = agents.get(agentId);

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    const body = await c.req.json();
    const input = updateAgentSchema.parse(body);
    const updatedAgent = applyAgentUpdate(agent, input);
    agents.set(agentId, updatedAgent);
    persistAgentsToStore();

    return c.json({
      success: true,
      agent: safeAgent(updatedAgent),
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return c.json({ error: 'Invalid agent update parameters', details: error.issues }, 400);
    }

    return c.json({
      error: 'Agent update failed',
      message: error?.message?.substring(0, 240),
    }, 500);
  }
});

agentRoutes.get('/:agentId/orchestrator/status', (c) => {
  const { agent } = getAgentOrNotFound(c);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  return c.json(orchestratorStatus(agent));
});

agentRoutes.get('/:agentId/memory', (c) => {
  const { agent } = getAgentOrNotFound(c);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  return c.json({
    records: agent.memoryRecords,
    total: agent.memoryRecords.length,
    privateMemoryExposed: false,
  });
});

agentRoutes.get('/:agentId/signing-requests', (c) => {
  const { agent } = getAgentOrNotFound(c);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  return c.json({ signingRequests: agent.signingRequests, total: agent.signingRequests.length });
});

agentRoutes.post('/:agentId/signing-requests', async (c) => {
  try {
    const { agent, agentId } = getAgentOrNotFound(c);
    if (!agent) return c.json({ error: 'Agent not found' }, 404);

    const input = signingRequestSchema.parse(await c.req.json());
    const humanApprovalRequired = agent.walletPolicy.humanApprovalRequired || input.risk === 'high' || input.risk === 'critical';
    const status: AgentSigningRequest['status'] = humanApprovalRequired && !input.humanApproved
      ? 'pending-human-approval'
      : 'approved-not-signed';
    const signingRequest: AgentSigningRequest = {
      id: `sig_${randomUUID()}`,
      agentId,
      action: input.action,
      to: (input.to as `0x${string}` | undefined) ?? null,
      valueEth: input.valueEth,
      data: input.data ?? null,
      risk: input.risk,
      reason: input.reason,
      status,
      humanApprovalRequired,
      approvedBy: (input.approvedBy as `0x${string}` | undefined) ?? null,
      transactionHash: null,
      createdAt: new Date().toISOString(),
    };

    agent.signingRequests.push(signingRequest);
    agent.events.push({
      id: `evt_${randomUUID()}`,
      agentId,
      type: 'runtime.signing_request',
      actorAddress: signingRequest.approvedBy,
      payload: {
        signingRequestId: signingRequest.id,
        action: signingRequest.action,
        risk: signingRequest.risk,
        status: signingRequest.status,
      },
      createdAt: signingRequest.createdAt,
    });
    agents.set(agentId, agent);
    persistAgentsToStore();

    return c.json({ signingRequest, walletStorage: agent.walletPolicy.storage }, 202);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return c.json({ error: 'Invalid signing request', details: error.issues }, 400);
    }
    return c.json({ error: 'Signing request failed', message: error?.message?.substring(0, 240) }, 500);
  }
});

agentRoutes.post('/:agentId/contract-events', async (c) => {
  try {
    const { agent, agentId } = getAgentOrNotFound(c);
    if (!agent) return c.json({ error: 'Agent not found' }, 404);

    const input = contractEventSchema.parse(await c.req.json());
    const eventId = `evt_${randomUUID()}`;
    const createdAt = new Date().toISOString();
    agent.events.push({
      id: eventId,
      agentId,
      type: 'contract.event',
      actorAddress: null,
      payload: input,
      createdAt,
    });
    agent.contractWatcher = {
      status: 'connected',
      lastTransactionHash: input.transactionHash,
      lastEventName: input.eventName,
      lastBlockNumber: input.blockNumber ?? null,
    };
    agents.set(agentId, agent);
    persistAgentsToStore();

    return c.json({ accepted: true, eventId, contractWatcher: agent.contractWatcher }, 202);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return c.json({ error: 'Invalid contract event', details: error.issues }, 400);
    }
    return c.json({ error: 'Contract event ingestion failed', message: error?.message?.substring(0, 240) }, 500);
  }
});

/**
 * POST /api/agents/:agentId/chat
 * Early runtime boundary for chatting with an agent before a live orchestrator is attached.
 */
agentRoutes.post('/:agentId/chat', async (c) => {
  try {
    const agentId = decodeURIComponent(c.req.param('agentId'));
    const agent = agents.get(agentId);

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    if (!agent.passport.capabilities.public.includes('chat')) {
      return c.json({
        error: 'Chat not allowed',
        message: 'This agent passport does not advertise the chat capability.',
      }, 403);
    }

    const body = await c.req.json();
    const input = chatTurnSchema.parse(body);
    const persistedMemory = shouldPersistCommunityMemory(agent);
    const response = buildPendingOrchestratorChatResponse(agent, input, persistedMemory);
    const createdAt = new Date().toISOString();

    const userEventId = `evt_${randomUUID()}`;
    const agentEventId = `evt_${randomUUID()}`;
    agent.events.push({
      id: userEventId,
      agentId: agent.agentId,
      type: 'chat.user_message',
      actorAddress: (input.userAddress as `0x${string}` | undefined) ?? null,
      payload: {
        content: input.message,
        sessionId: response.sessionId,
      },
      createdAt,
    });
    agent.events.push({
      id: agentEventId,
      agentId: agent.agentId,
      type: 'chat.agent_message',
      actorAddress: agent.walletAddress,
      payload: {
        content: response.message.content,
        messageId: response.message.id,
        sessionId: response.sessionId,
        runtimeStatus: response.runtime.status,
      },
      createdAt: response.message.createdAt,
    });
    if (persistedMemory) {
      addMemoryRecord(agent, {
        type: 'chat-turn',
        visibility: 'community',
        summary: `User said: ${input.message.slice(0, 240)}`,
        sourceEventId: userEventId,
      });
      addMemoryRecord(agent, {
        type: 'chat-turn',
        visibility: 'community',
        summary: `Agent replied with MVP orchestrator boundary message ${response.message.id}.`,
        sourceEventId: agentEventId,
      });
    }
    agents.set(agentId, agent);
    persistAgentsToStore();

    return c.json({
      ...response,
      eventQueue: {
        depth: agent.events.length,
      },
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return c.json({ error: 'Invalid chat parameters', details: error.issues }, 400);
    }

    return c.json({
      error: 'Agent chat failed',
      message: error?.message?.substring(0, 240),
    }, 500);
  }
});

function getAgentOrNotFound(c: any) {
  const agentId = decodeURIComponent(c.req.param('agentId'));
  const agent = agents.get(agentId);
  if (!agent) return { agentId, agent: null };
  return { agentId, agent };
}

agentRoutes.all('/:agentId/a2a', (c) => {
  const { agent, agentId } = getAgentOrNotFound(c);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);

  return c.json({
    agentId,
    status: agent.passport.runtime.status,
    endpoint: 'a2a',
    available: false,
    reason: 'The Agent Foundry has reserved this A2A endpoint, but the live orchestrator is not attached yet.',
    runtime: agent.passport.runtime,
    policy: {
      allowedTools: [],
      approvalRequired: true,
    },
  }, 202);
});

agentRoutes.all('/:agentId/mcp', (c) => {
  const { agent, agentId } = getAgentOrNotFound(c);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);

  return c.json({
    agentId,
    status: agent.passport.runtime.status,
    endpoint: 'mcp',
    available: false,
    reason: 'The Agent Foundry has reserved this MCP endpoint, but no sandboxed tool server is connected yet.',
    toolPolicy: {
      allowedTools: [],
      approvalRequired: true,
    },
  }, 202);
});

agentRoutes.post('/:agentId/selfies', (c) => {
  const { agent, agentId } = getAgentOrNotFound(c);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);

  return c.json({
    agentId,
    status: 'media-service-not-connected',
    generatedMedia: false,
    consentRequired: true,
    labelRequired: true,
    portraitProvider: agent.passport.embodiment.portraitProvider,
    reason: 'Gemini / nano-banana portrait generation is planned, but no media worker is connected in this MVP.',
  }, 202);
});

/**
 * GET /api/agents/:agentId/events
 * Return durable public runtime events for the early agent orchestrator boundary.
 */
agentRoutes.get('/:agentId/events', (c) => {
  const agentId = decodeURIComponent(c.req.param('agentId'));
  const agent = agents.get(agentId);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json({
    events: agent.events,
    total: agent.events.length,
  });
});

/**
 * GET /api/agents/:agentId/card
 * Return the public agent card advertised as the metadata URI.
 */
agentRoutes.get('/:agentId/passport', (c) => {
  const agentId = decodeURIComponent(c.req.param('agentId'));
  const agent = agents.get(agentId);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json(agent.passport);
});

agentRoutes.get('/:agentId/card', (c) => {
  const agentId = decodeURIComponent(c.req.param('agentId'));
  const agent = agents.get(agentId);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json(agent.agentCard);
});
