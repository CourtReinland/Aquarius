import { base, baseSepolia, localhost } from 'viem/chains';
import { defineChain } from 'viem';

/** Chain configuration — mirrors apps/mobile/src/config/chains.ts */

export { base, baseSepolia };

// Reach Anvil on whatever host served this page: localhost on the Mac,
// the Mac's LAN IP from a phone, or an adb-reversed localhost on Android.
const rpcHost =
  typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';

export const localChain = defineChain({
  ...localhost,
  id: 31337,
  name: 'Anvil',
  rpcUrls: {
    default: { http: [`http://${rpcHost}:8545`] },
  },
});

// Switch to baseSepolia or base for testnet/mainnet
export const defaultChain = localChain;

export interface ContractAddresses {
  communityFactory: `0x${string}` | null;
  governanceModule: `0x${string}` | null;
  tokenTemplate: `0x${string}` | null;
  institutionRegistry: `0x${string}` | null;
  allianceModule: `0x${string}` | null;
}

export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  [31337]: {
    communityFactory: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    governanceModule: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    tokenTemplate: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    institutionRegistry: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    allianceModule: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  },
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

export const contracts = CONTRACT_ADDRESSES[defaultChain.id];
