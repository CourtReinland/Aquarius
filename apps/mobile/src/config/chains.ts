import { base, baseSepolia } from 'viem/chains';

/**
 * Chain configuration for Aquarius.
 */

export { base, baseSepolia };
export const defaultChain = baseSepolia;

export interface ContractAddresses {
  communityFactory: `0x${string}` | null;
  governanceModule: `0x${string}` | null;
  tokenTemplate: `0x${string}` | null;
  institutionRegistry: `0x${string}` | null;
  allianceModule: `0x${string}` | null;
}

// Updated after running: forge script script/Deploy.s.sol
export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  [baseSepolia.id]: {
    communityFactory: null,
    governanceModule: null,
    tokenTemplate: null,
    institutionRegistry: null,
    allianceModule: null,
  },
  [base.id]: {
    communityFactory: null,
    governanceModule: null,
    tokenTemplate: null,
    institutionRegistry: null,
    allianceModule: null,
  },
};

export function getContractAddress(chainId: number): ContractAddresses {
  const addresses = CONTRACT_ADDRESSES[chainId];
  if (!addresses) throw new Error(`No contracts on chain ${chainId}`);
  return addresses;
}
