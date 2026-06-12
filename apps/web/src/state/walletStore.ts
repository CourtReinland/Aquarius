import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address } from 'viem';
import { defaultChain, localChain } from '../lib/chains';

/**
 * Aquarius Passport (web) — local wallet + session.
 * Private key never leaves the browser. On local Anvil, "generate" uses the
 * pre-funded account #0 so transactions can pay gas immediately (mirrors mobile).
 */

const ANVIL_DEV_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

interface WalletState {
  address: Address | null;
  privateKey: `0x${string}` | null;
  createdAt: number | null;
  generateDevWallet: () => Address;
  importPrivateKey: (pk: string) => Address;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      privateKey: null,
      createdAt: null,

      generateDevWallet: () => {
        const pk =
          defaultChain.id === localChain.id ? ANVIL_DEV_KEY : generatePrivateKey();
        const account = privateKeyToAccount(pk);
        set({ address: account.address, privateKey: pk, createdAt: Date.now() });
        return account.address;
      },

      importPrivateKey: (pkRaw: string) => {
        const pk = (pkRaw.startsWith('0x') ? pkRaw : `0x${pkRaw}`) as `0x${string}`;
        const account = privateKeyToAccount(pk); // throws if invalid
        set({ address: account.address, privateKey: pk, createdAt: Date.now() });
        return account.address;
      },

      disconnect: () => set({ address: null, privateKey: null, createdAt: null }),
    }),
    {
      name: 'aquarius-passport',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
