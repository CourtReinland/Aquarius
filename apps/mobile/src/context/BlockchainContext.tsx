import React, { createContext, useContext } from 'react';
import { useBlockchainData } from '../hooks/useBlockchainData';
import { useWalletStore } from '../hooks/useWalletStore';
import type { MyCommunity, DiscoveredCommunity, OnChainProposal, UserProfile } from '../hooks/useBlockchainData';

interface BlockchainContextValue {
  profile: UserProfile | null;
  myCommunities: MyCommunity[];
  allCommunities: DiscoveredCommunity[];
  proposals: OnChainProposal[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  walletAddress: `0x${string}` | null;
  isConnected: boolean;
}

const BlockchainContext = createContext<BlockchainContextValue>({
  profile: null,
  myCommunities: [],
  allCommunities: [],
  proposals: [],
  loading: false,
  error: null,
  refresh: async () => {},
  walletAddress: null,
  isConnected: false,
});

export function BlockchainProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useWalletStore();
  const data = useBlockchainData(address);

  return (
    <BlockchainContext.Provider value={{ ...data, walletAddress: address, isConnected }}>
      {children}
    </BlockchainContext.Provider>
  );
}

export function useBlockchain() {
  return useContext(BlockchainContext);
}
