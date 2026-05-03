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

const createAgentSchema = z.object({
  communityAddress: z.string().refine(isAddress, 'communityAddress must be an EVM address'),
  communityName: z.string().min(1).max(100).optional(),
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
      provider: z.string().max(80).default('anthropic'),
      model: z.string().max(120).default('claude-sonnet'),
      harness: z.enum(['hermes', 'openclaw', 'custom']).default('hermes'),
    })
    .default({ provider: 'anthropic', model: 'claude-sonnet', harness: 'hermes' }),
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
  registration: RegistrationResult;
  initialFunding: FundingResult;
  promptHash: string;
  promptTemplate: string;
  events: AgentRuntimeEvent[];
  createdAt: string;
}

interface AgentRuntimeEvent {
  id: string;
  agentId: string;
  type: 'chat.user_message' | 'chat.agent_message';
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

  const parsed = JSON.parse(raw) as StoredAgent[];
  return new Map(parsed.map((agent) => [agent.agentId, { ...agent, events: agent.events ?? [] }]));
}

function persistAgentsToStore() {
  if (!agentStoreFile) return;
  mkdirSync(dirname(agentStoreFile), { recursive: true });
  writeFileSync(agentStoreFile, JSON.stringify([...agents.values()], null, 2));
}

export function resetAgentStoreForTests(storeFile: string | null) {
  agentStoreFile = storeFile;
  agents = loadAgentsFromStore();
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

function buildPendingOrchestratorChatResponse(agent: StoredAgent, input: ChatTurnInput) {
  const greeting = agent.passport.personality.greeting;
  const intro = greeting ? `${greeting} ` : `I am ${agent.passport.identity.name}. `;
  const runtime = agent.passport.runtime;

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
      content: `${intro}${agent.passport.identity.name} is registered and reachable, but the live ${runtime.harness} orchestrator is not attached yet. This endpoint is the safe chat boundary for the upcoming runtime: it can identify the agent, preserve public personality fields, and keep hidden instructions, keys, and memory sealed.`,
      createdAt: new Date().toISOString(),
    },
    runtime: {
      harness: runtime.harness,
      provider: runtime.provider,
      model: runtime.model,
      status: runtime.status,
    },
    memoryBoundary: {
      persisted: false,
      reason: 'Durable private memory store is not enabled for chat turns yet.',
    },
    toolPolicy: {
      allowedTools: [],
      approvalRequired: true,
      reason: 'No tool allowlist has been granted to this early chat endpoint.',
    },
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
 * Create an Aquarius AI-agent identity, wallet, agent card, and optional
 * on-chain registration inside a Community contract.
 */
agentRoutes.post('/create', async (c) => {
  try {
    const body = await c.req.json();
    const input = createAgentSchema.parse(body);
    const creatorSession = getSessionFromAuthorization(c.req.header('authorization'));

    if (
      input.creatorAddress &&
      (!creatorSession || creatorSession.address.toLowerCase() !== input.creatorAddress.toLowerCase())
    ) {
      return c.json({
        error: 'Wallet session required',
        message: 'Sign in with the creator wallet before creating an agent.',
      }, 401);
    }

    const createdAt = new Date().toISOString();

    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const communityShort = input.communityAddress.slice(2, 10).toLowerCase();
    const agentId = `did:erc8004:aquarius:${communityShort}:${slugify(input.name)}-${randomUUID()}`;
    const cardUrl = `${publicApiBaseUrl()}/api/agents/${encodeURIComponent(agentId)}/card`;
    const passportUrl = `${publicApiBaseUrl()}/api/agents/${encodeURIComponent(agentId)}/passport`;
    const metadataUri = passportUrl;
    const promptHash = hashValue(input.promptTemplate);
    const passport = buildAgentPassport(input, {
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
      name: input.name,
      description: input.description,
      role: input.role,
      capabilities: input.capabilities,
      communityAddress: input.communityAddress as `0x${string}`,
      communityName: input.communityName ?? null,
      paymentAddress: account.address,
      wallet: {
        type: 'EOA',
        chain: process.env.AQUARIUS_CHAIN_NAME ?? 'local-or-base',
      },
      runtime: {
        provider: input.runtime.provider,
        model: input.runtime.model,
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
    const registration = await registerAgentOnChain(input, account.address, agentId, metadataUri);
    const initialFunding = await fundAgentWallet(input, account.address);

    const storedAgent: StoredAgent = {
      agentId,
      communityAddress: input.communityAddress as `0x${string}`,
      communityName: input.communityName ?? null,
      creatorAddress: (input.creatorAddress as `0x${string}` | undefined) ?? null,
      walletAddress: account.address,
      agentCard,
      passport,
      metadataUri,
      encryptedPrivateKey,
      keyStorage: encryptedPrivateKey ? 'encrypted-memory' : 'not-stored',
      registration,
      initialFunding,
      promptHash,
      promptTemplate: input.promptTemplate,
      events: [],
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
 * List created agents. Optional: ?communityAddress=0x...
 */
agentRoutes.get('/', (c) => {
  const communityAddress = c.req.query('communityAddress');
  const list = [...agents.values()]
    .filter((agent) => !communityAddress || agent.communityAddress.toLowerCase() === communityAddress.toLowerCase())
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
    const response = buildPendingOrchestratorChatResponse(agent, input);
    const createdAt = new Date().toISOString();

    agent.events.push({
      id: `evt_${randomUUID()}`,
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
      id: `evt_${randomUUID()}`,
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
    agents.set(agentId, agent);
    persistAgentsToStore();

    return c.json(response);
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
