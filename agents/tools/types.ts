/**
 * Type definitions for Aquarius Agent System
 * Ensures type safety across MCP tools and agent cards.
 */

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  mcpEndpoints: Array<{
    name: string;
    uri: string;
    description: string;
  }>;
  a2aEndpoints: Array<{
    protocol: string;
    uri: string;
    methods: string[];
  }>;
  paymentAddress: string;
  reputationLink: string;
  erc8004NftId?: string;
  identityRegistry?: string;
  securityNotes?: {
    usesAA: boolean;
    tbaAddress?: string;
    keyManagement: string;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  returnType: any;
  securityLevel: 'public' | 'reputation-gated' | 'validator-only';
}

export interface ERC6551Config {
  nftAddress: string;
  nftId: string;
  implementationAddress: string;
  chainId: number;
  salt: string;
}

export interface A2AMessage {
  from: string; // Agent NFT ID or address
  to: string;
  method: string;
  params: any;
  signature: string; // From TBA or AA
  timestamp: number;
}

export const REPUTATION_THRESHOLDS = {
  PROPOSAL_CREATION: 40,
  VOTING: 25,
  EXECUTION: 60,
  VALIDATION: 75,
} as const;

export const ERROR_CODES = {
  INSUFFICIENT_REPUTATION: 'ERR_REP_LOW',
  VALIDATION_FAILED: 'ERR_VALIDATION',
  UNAUTHORIZED: 'ERR_UNAUTHORIZED',
  KEY_EXPOSURE_RISK: 'ERR_KEY_RISK',
} as const;
