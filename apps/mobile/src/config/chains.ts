import { base, baseSepolia, localhost } from 'viem/chains';
import { defineChain } from 'viem';

/**
 * Chain configuration for Aquarius.
 */

export { base, baseSepolia };

// Local Anvil chain
export const localChain = defineChain({
  ...localhost,
  id: 31337,
  name: 'Anvil',
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
});

// Switch this to baseSepolia or base for testnet/mainnet
export const defaultChain = localChain;

export interface ContractAddresses {
  communityFactory: `0x${string}` | null;
  governanceModule: `0x${string}` | null;
  tokenTemplate: `0x${string}` | null;
  institutionRegistry: `0x${string}` | null;
  allianceModule: `0x${string}` | null;
}

export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  // Local Anvil (from deploy script output)
  [31337]: {
    communityFactory: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    governanceModule: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    tokenTemplate: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    institutionRegistry: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    allianceModule: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  },
  // Base Sepolia (to be filled after testnet deploy)
  [baseSepolia.id]: {
    communityFactory: null,
    governanceModule: null,
    tokenTemplate: null,
    institutionRegistry: null,
    allianceModule: null,
  },
  // Base Mainnet
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
