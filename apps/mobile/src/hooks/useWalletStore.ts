import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface WalletSession {
  token: string;
  address: `0x${string}`;
  chainId: number;
  issuedAt: string;
  expiresAt: string;
}

export interface LinkedWallet {
  address: `0x${string}`;
  chainId: number;
  label: string;
  addedAt: string;
  lastSignedInAt?: string;
}

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
  session: WalletSession | null;
  linkedWallets: LinkedWallet[];

  // Actions
  connect: (address: `0x${string}`, chainId: number) => void;
  setSession: (session: WalletSession | null) => void;
  linkWallet: (wallet: Omit<LinkedWallet, 'addedAt'> & { addedAt?: string }) => void;
  unlinkWallet: (address: `0x${string}`) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      isConnected: false,
      chainId: null,
      session: null,
      linkedWallets: [],

      connect: (address, chainId) =>
        set({ address, isConnected: true, chainId }),

      setSession: (session) =>
        set({ session }),

      linkWallet: (wallet) =>
        set((state) => {
          const normalized = wallet.address.toLowerCase();
          const existing = state.linkedWallets.find(
            (linked) => linked.address.toLowerCase() === normalized
          );
          const nextWallet: LinkedWallet = {
            ...wallet,
            addedAt: existing?.addedAt ?? wallet.addedAt ?? new Date().toISOString(),
          };

          return {
            linkedWallets: [
              nextWallet,
              ...state.linkedWallets.filter(
                (linked) => linked.address.toLowerCase() !== normalized
              ),
            ],
          };
        }),

      unlinkWallet: (address) =>
        set((state) => ({
          linkedWallets: state.linkedWallets.filter(
            (linked) => linked.address.toLowerCase() !== address.toLowerCase()
          ),
        })),

      disconnect: () =>
        set({ address: null, isConnected: false, chainId: null, session: null }),
    }),
    {
      name: 'aquarius-wallet-passport',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        session: state.session,
        linkedWallets: state.linkedWallets,
      }),
    }
  )
);
