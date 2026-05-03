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

const originSchema = z.object({
  mode: z.enum(['scratch', 'template', 'clone', 'hire', 'import']).default('scratch'),
  parentAgentId: z.string().max(240).nullable().optional(),
  templateId: z.string().max(160).nullable().optional(),
  lineageHash: z.string().max(128).nullable().optional(),
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
  permissionPolicyHash: z.string().max(128).nullable().optional(),
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
  permissionPolicy: permissionPolicySchema,
  economics: economicsSchema,
});

type CreateAgentInput = z.infer<typeof createAgentSchema>;

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

const DEFAULT_AGENT_STORE_FILE = fileURLToPath(new URL('../../data/agents.json', import.meta.url));
let agentStoreFile: string | null = process.env.AGENT_STORE_FILE ?? DEFAULT_AGENT_STORE_FILE;
let agents = loadAgentsFromStore();

function loadAgentsFromStore(): Map<string, StoredAgent> {
  if (!agentStoreFile || !existsSync(agentStoreFile)) return new Map();

  const raw = readFileSync(agentStoreFile, 'utf8').trim();
  if (!raw) return new Map();

  const parsed = JSON.parse(raw) as StoredAgent[];
  return new Map(parsed.map((agent) => [agent.agentId, agent]));
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
      createdAt,
    };

    agents.set(agentId, storedAgent);
    persistAgentsToStore();

    return c.json({
      success: true,
      agent: safeAgent(storedAgent),
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
