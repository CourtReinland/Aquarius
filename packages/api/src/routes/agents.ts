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
import { getSessionFromAuthorization } from './auth.js';
import { maxInitialFundingEth, operatorActionsAllowed } from '../lib/env.js';

export const agentRoutes = new Hono();

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
] as const;

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
      provider: z.string().max(80).default('anthropic'),
      model: z.string().max(120).default('claude-sonnet'),
    })
    .default({ provider: 'anthropic', model: 'claude-sonnet' }),
});

type CreateAgentInput = z.infer<typeof createAgentSchema>;

interface StoredAgent {
  agentId: string;
  communityAddress: `0x${string}`;
  communityName: string | null;
  creatorAddress: `0x${string}`;
  walletAddress: `0x${string}`;
  agentCard: AgentCard;
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

const agents = new Map<string, StoredAgent>();

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
  // Opt-in only — never auto-register just because an operator key is present.
  if (!input.registerOnChain) {
    return {
      mode: 'skipped',
      transactionHash: null,
      reason: 'registerOnChain was not requested',
    };
  }

  const operatorPrivateKey = process.env.AQUARIUS_OPERATOR_PRIVATE_KEY as `0x${string}` | undefined;
  const rpcUrl = process.env.AQUARIUS_RPC_URL ?? process.env.RPC_URL;

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

    const transactionHash = await walletClient.writeContract({
      address: input.communityAddress as `0x${string}`,
      abi: agentRegistrationAbi,
      functionName: 'registerAIAgent',
      args: [agentAddress, agentId, metadataUri],
      chain: null,
    });

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

function wantsOperatorAction(input: CreateAgentInput): boolean {
  try {
    return Boolean(input.registerOnChain) || parseEther(input.initialFundingEth) > 0n;
  } catch {
    return Boolean(input.registerOnChain);
  }
}

/** Test helper — clears in-memory agent registry. */
export function __resetAgentsForTests() {
  agents.clear();
}

/**
 * POST /api/agents/create
 * Create an Aquarius AI-agent identity, wallet, agent card, and optional
 * on-chain registration inside a Community contract.
 *
 * Always requires a valid wallet session. `creatorAddress` is bound to the
 * session address (session wins; a mismatched body field is rejected).
 */
agentRoutes.post('/create', async (c) => {
  try {
    const body = await c.req.json();
    const input = createAgentSchema.parse(body);
    const creatorSession = getSessionFromAuthorization(c.req.header('authorization'));

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
    const metadataUri = cardUrl;
    const promptHash = hashValue(boundInput.promptTemplate);

    const agentCard: AgentCard = {
      schemaVersion: 'aquarius.agent-card.v1',
      standard: 'ERC-8004',
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
    const registration = await registerAgentOnChain(boundInput, account.address, agentId, metadataUri);
    const initialFunding = await fundAgentWallet(boundInput, account.address);

    const storedAgent: StoredAgent = {
      agentId,
      communityAddress: boundInput.communityAddress as `0x${string}`,
      communityName: boundInput.communityName ?? null,
      creatorAddress,
      walletAddress: account.address,
      agentCard,
      metadataUri,
      encryptedPrivateKey,
      keyStorage: encryptedPrivateKey ? 'encrypted-memory' : 'not-stored',
      registration,
      initialFunding,
      promptHash,
      promptTemplate: boundInput.promptTemplate,
      createdAt,
    };

    agents.set(agentId, storedAgent);

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
 * List agents created by the authenticated wallet.
 * Optional: ?communityAddress=0x... further filters the caller's creations.
 */
agentRoutes.get('/', (c) => {
  const session = getSessionFromAuthorization(c.req.header('authorization'));

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
    .filter((agent) => agent.creatorAddress.toLowerCase() === session.address.toLowerCase())
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

/**
 * GET /api/agents/:agentId/card
 * Return the public agent card advertised as the metadata URI.
 */
agentRoutes.get('/:agentId/card', (c) => {
  const agentId = decodeURIComponent(c.req.param('agentId'));
  const agent = agents.get(agentId);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json(agent.agentCard);
});
