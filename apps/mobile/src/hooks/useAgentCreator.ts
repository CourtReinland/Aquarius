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
}

interface CreateAgentResult {
  success: true;
  agent: CreatedAgent;
  warnings: string[];
}

export function useAgentCreator() {
  const { session } = useWalletStore();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<CreatedAgent | null>(null);

  const createAgent = useCallback(async (params: CreateAgentParams) => {
    setIsCreating(true);
    setError(null);

    try {
      if (!session?.token || !session.address) {
        throw new Error('Sign in with your wallet before creating an agent.');
      }

      const response = await fetch(`${API_BASE}/api/agents/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          ...params,
          // Session address is authoritative; always send it so the API can bind attribution.
          creatorAddress: session.address,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || `HTTP ${response.status}`);
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
  }, [session?.address, session?.token]);

  return {
    createAgent,
    isCreating,
    error,
    agent,
  };
}
