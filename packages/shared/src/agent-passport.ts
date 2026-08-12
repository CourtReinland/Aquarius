export const AGENT_PASSPORT_SCHEMA_VERSION = 'aquarius.agent-passport.v1' as const;
export const LEGACY_AGENT_CARD_SCHEMA_VERSION = 'aquarius.agent-card.v1' as const;
export const AGENT_STANDARD = 'ERC-8004' as const;

export type AgentOriginMode = 'scratch' | 'template' | 'clone' | 'hire' | 'import';
export type AgentRuntimeHarness = 'hermes' | 'openclaw' | 'custom';
export type AgentRuntimeStatus = 'pending-orchestrator' | 'active' | 'dormant' | 'suspended';
export type AgentPermissionClass = 'visitor' | 'resident' | 'worker' | 'delegate' | 'officer' | 'sovereign';
export type AgentMemoryMode = 'session-only' | 'personal-companion' | 'community-memory' | 'officer-memory' | 'clone-safe';
export type AgentWalletType = 'EOA' | 'ERC-4337' | 'contract';
export type AnthropomorphismLevel = 'minimal' | 'balanced' | 'high' | 'agent-discretion';
export type AgentFeeMode = 'off-chain' | 'on-chain';

export interface AgentOrigin {
  mode: AgentOriginMode;
  parentAgentId: string | null;
  templateId: string | null;
  lineageHash: string | null;
}

export interface AgentIdentity {
  name: string;
  role: string;
  description: string;
  biography: string;
  pronouns: string | null;
  anthropomorphism: AnthropomorphismLevel;
}

export interface AgentEmbodiment {
  avatarUri: string | null;
  avatarManifestUri: string | null;
  portraitUri: string | null;
  portraitProvider: 'gemini-nano-banana' | 'none' | string;
  portraitSeed: string | null;
  style: string | null;
  bodyArchetype: string | null;
  outfit: string | null;
  voiceId: string | null;
  selfieEndpoint: string | null;
}

export interface AgentPersonality {
  traits: Record<string, number>;
  greeting: string | null;
  refusalStyle: string | null;
  conflictStyle: string | null;
}

export interface AgentMemoryPolicy {
  mode: AgentMemoryMode;
  remembersPrivateChats: boolean;
  remembersCommunityEvents: boolean;
  cloneSafe: boolean;
  retentionDays: number | null;
  editableAfterCreation: boolean;
}

export interface AgentCapabilities {
  public: string[];
  permissionClass: AgentPermissionClass;
  permissionPolicyUri: string | null;
  permissionPolicyHash: string | null;
}

export interface AgentWallet {
  type: AgentWalletType;
  chain: string;
  address: `0x${string}`;
}

export interface AgentRuntimeEndpoints {
  card: string;
  passport: string;
  chat: string | null;
  a2a: string | null;
  mcp: string | null;
}

export interface AgentRuntime {
  harness: AgentRuntimeHarness;
  provider: string;
  model: string;
  status: AgentRuntimeStatus;
  endpoints: AgentRuntimeEndpoints;
}

export interface AgentEconomics {
  hireable: boolean;
  cloneable: boolean;
  license: string | null;
  feeRecipient: `0x${string}` | null;
  hirePrice: string | null;
  clonePrice: string | null;
  revenueSplitBps: number | null;
  feeMode: AgentFeeMode;
}

export interface AgentHashes {
  promptHash: string | null;
  memoryRootHash: string | null;
  avatarManifestHash: string | null;
  runtimePolicyHash: string | null;
}

export interface AquariusAgentPassportV1 {
  schemaVersion: typeof AGENT_PASSPORT_SCHEMA_VERSION;
  standard: typeof AGENT_STANDARD;
  agentId: string;
  agentAddress: `0x${string}`;
  communityAddress: `0x${string}`;
  communityName: string | null;
  creatorAddress: `0x${string}` | null;
  origin: AgentOrigin;
  identity: AgentIdentity;
  embodiment: AgentEmbodiment;
  personality: AgentPersonality;
  memoryPolicy: AgentMemoryPolicy;
  capabilities: AgentCapabilities;
  wallet: AgentWallet;
  runtime: AgentRuntime;
  economics: AgentEconomics;
  hashes: AgentHashes;
  createdAt: string;
  updatedAt: string;
}

export interface DefaultAgentPassportInput {
  origin: AgentOrigin;
  identity: Pick<AgentIdentity, 'biography' | 'pronouns' | 'anthropomorphism'>;
  embodiment: AgentEmbodiment;
  personality: AgentPersonality;
  memoryPolicy: AgentMemoryPolicy;
  capabilities: Pick<AgentCapabilities, 'permissionClass' | 'permissionPolicyUri' | 'permissionPolicyHash'>;
  wallet: Pick<AgentWallet, 'type'>;
  economics: AgentEconomics;
  hashes: Omit<AgentHashes, 'promptHash'>;
}

export function createDefaultAgentPassportInput(): DefaultAgentPassportInput {
  return {
    origin: {
      mode: 'scratch',
      parentAgentId: null,
      templateId: null,
      lineageHash: null,
    },
    identity: {
      biography: '',
      pronouns: null,
      anthropomorphism: 'agent-discretion',
    },
    embodiment: {
      avatarUri: null,
      avatarManifestUri: null,
      portraitUri: null,
      portraitProvider: 'gemini-nano-banana',
      portraitSeed: null,
      style: null,
      bodyArchetype: null,
      outfit: null,
      voiceId: null,
      selfieEndpoint: null,
    },
    personality: {
      traits: {},
      greeting: null,
      refusalStyle: null,
      conflictStyle: null,
    },
    memoryPolicy: {
      mode: 'session-only',
      remembersPrivateChats: false,
      remembersCommunityEvents: false,
      cloneSafe: true,
      retentionDays: null,
      editableAfterCreation: true,
    },
    capabilities: {
      permissionClass: 'worker',
      permissionPolicyUri: null,
      permissionPolicyHash: null,
    },
    wallet: {
      type: 'EOA',
    },
    economics: {
      hireable: false,
      cloneable: false,
      license: null,
      feeRecipient: null,
      hirePrice: null,
      clonePrice: null,
      revenueSplitBps: null,
      feeMode: 'off-chain',
    },
    hashes: {
      memoryRootHash: null,
      avatarManifestHash: null,
      runtimePolicyHash: null,
    },
  };
}
