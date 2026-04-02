import { create } from 'zustand';

/**
 * Simple wallet state store.
 * In the MVP we use a "dev wallet" approach where the user enters
 * or generates a private key locally. In production this will be
 * replaced with WalletConnect / Privy / Coinbase Smart Wallet.
 */
interface WalletState {
  address: `0x${string}` | null;
  isConnected: boolean;
  chainId: number | null;

  // Actions
  connect: (address: `0x${string}`, chainId: number) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  isConnected: false,
  chainId: null,

  connect: (address, chainId) =>
    set({ address, isConnected: true, chainId }),

  disconnect: () =>
    set({ address: null, isConnected: false, chainId: null }),
}));
