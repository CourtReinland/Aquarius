import { useCallback, useState } from 'react';
import { API_BASE } from '../config/api';
import { useWalletStore } from './useWalletStore';

export interface CreateAgentParams {
  communityAddress: string;
  communityName?: string;
  creatorAddress?: string;
  name: string;
  description: string;
  role: string;
  capabilities: string[];
  promptTemplate: string;
  initialFundingEth: string;
  registerOnChain?: boolean;
  origin?: {
    mode?: 'scratch' | 'template' | 'clone' | 'hire' | 'import';
    parentAgentId?: string | null;
    templateId?: string | null;
    lineageHash?: string | null;
  };
  identity?: {
    biography?: string;
    pronouns?: string | null;
    anthropomorphism?: 'minimal' | 'balanced' | 'high' | 'agent-discretion';
  };
  embodiment?: {
    avatarUri?: string | null;
    avatarManifestUri?: string | null;
    portraitUri?: string | null;
    portraitProvider?: string;
    portraitSeed?: string | null;
    style?: string | null;
    bodyArchetype?: string | null;
    outfit?: string | null;
    voiceId?: string | null;
  };
  personality?: {
    traits?: Record<string, number>;
    greeting?: string | null;
    refusalStyle?: string | null;
    conflictStyle?: string | null;
  };
  permissionPolicy?: {
    permissionClass?: 'visitor' | 'resident' | 'worker' | 'delegate' | 'officer' | 'sovereign';
    permissionPolicyUri?: string | null;
    permissionPolicyHash?: string | null;
  };
  economics?: {
    hireable?: boolean;
    cloneable?: boolean;
    license?: string | null;
    hirePrice?: string | null;
    clonePrice?: string | null;
  };
}

export interface CreatedAgent {
  agentId: string;
  walletAddress: string;
  metadataUri: string;
  keyStorage: 'encrypted-memory' | 'not-stored';
  registration: {
    mode: 'on-chain' | 'skipped' | 'failed';
    transactionHash: string | null;
    reason?: string;
  };
  initialFunding: {
    requestedEth: string;
    transactionHash: string | null;
    status: 'sent' | 'skipped' | 'failed';
    reason?: string;
  };
  agentCard: {
    name: string;
    role: string;
    capabilities: string[];
    endpoints: {
      card: string;
      a2a: string;
      mcp: string;
    };
  };
  passport: {
    schemaVersion: 'aquarius.agent-passport.v1';
    identity: {
      anthropomorphism: string;
      biography: string;
      pronouns: string | null;
    };
    embodiment: {
      portraitProvider: string;
      bodyArchetype: string | null;
      style: string | null;
      outfit: string | null;
    };
    capabilities: {
      permissionClass: string;
    };
    economics: {
      hireable: boolean;
      cloneable: boolean;
      feeMode: string;
    };
    runtime: {
      endpoints: {
        passport: string;
      };
    };
  };
}

interface CreateAgentResult {
  success: true;
  agent: CreatedAgent;
  warnings: string[];
}

export interface AgentChatTurn {
  success: true;
  agentId: string;
  sessionId: string;
  message: {
    id: string;
    role: 'agent';
    content: string;
    createdAt: string;
  };
  runtime: {
    harness: string;
    provider: string;
    model: string;
    status: string;
  };
  memoryBoundary: {
    persisted: boolean;
    reason: string;
  };
  toolPolicy: {
    allowedTools: string[];
    approvalRequired: boolean;
    reason: string;
  };
}

export function useAgentCreator() {
  const { session } = useWalletStore();
  const [isCreating, setIsCreating] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<CreatedAgent | null>(null);
  const [chatTurn, setChatTurn] = useState<AgentChatTurn | null>(null);

  const createAgent = useCallback(async (params: CreateAgentParams) => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/agents/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify(params),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || `HTTP ${response.status}`);
      }

      const created = (result as CreateAgentResult).agent;
      setAgent(created);
      return created;
    } catch (err: any) {
      const message = err?.message ?? 'Agent creation failed';
      setError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [session?.token]);

  const testChat = useCallback(async (message: string, targetAgent = agent) => {
    if (!targetAgent) return null;

    setIsChatting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(targetAgent.agentId)}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({ message }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || `HTTP ${response.status}`);
      }

      const turn = result as AgentChatTurn;
      setChatTurn(turn);
      return turn;
    } catch (err: any) {
      const messageText = err?.message ?? 'Agent chat failed';
      setError(messageText);
      return null;
    } finally {
      setIsChatting(false);
    }
  }, [agent, session?.token]);

  return {
    createAgent,
    testChat,
    isCreating,
    isChatting,
    error,
    agent,
    chatTurn,
  };
}
