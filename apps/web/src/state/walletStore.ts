import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address } from 'viem';
import { defaultChain, localChain } from '../lib/chains';

/**
 * Aquarius Passport (web) — local wallet + session.
 * Private key never leaves the browser.
 *
 * On local Anvil, "generate" hands out one of Anvil's ten pre-funded test
 * identities so several devices on the same chain can act as DIFFERENT
 * people (multi-device governance testing). On real networks it generates
 * a fresh key.
 */

/** Anvil's standard, publicly-known dev mnemonic accounts (#0–#9). */
export const ANVIL_IDENTITIES: Array<{ name: string; key: `0x${string}` }> = [
  { name: 'Aries',   key: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' },
  { name: 'Taurus',  key: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' },
  { name: 'Gemini',  key: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' },
  { name: 'Cancer',  key: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' },
  { name: 'Leo',     key: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a' },
  { name: 'Virgo',   key: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba' },
  { name: 'Libra',   key: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e' },
  { name: 'Scorpio', key: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356' },
  { name: 'Ophiuchus', key: '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97' },
  { name: 'Pisces',  key: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6' },
];

interface WalletState {
  address: Address | null;
  privateKey: `0x${string}` | null;
  identityName: string | null;
  createdAt: number | null;
  /** Pick a named Anvil identity (local chain) or generate fresh (real nets). */
  adoptIdentity: (index?: number) => Address;
  importPrivateKey: (pk: string) => Address;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      privateKey: null,
      identityName: null,
      createdAt: null,

      adoptIdentity: (index?: number) => {
        if (defaultChain.id === localChain.id) {
          const i =
            index !== undefined
              ? Math.max(0, Math.min(ANVIL_IDENTITIES.length - 1, index))
              : Math.floor(Math.random() * ANVIL_IDENTITIES.length);
          const id = ANVIL_IDENTITIES[i];
          const account = privateKeyToAccount(id.key);
          set({
            address: account.address,
            privateKey: id.key,
            identityName: id.name,
            createdAt: Date.now(),
          });
          return account.address;
        }
        const pk = generatePrivateKey();
        const account = privateKeyToAccount(pk);
        set({ address: account.address, privateKey: pk, identityName: null, createdAt: Date.now() });
        return account.address;
      },

      importPrivateKey: (pkRaw: string) => {
        const pk = (pkRaw.startsWith('0x') ? pkRaw : `0x${pkRaw}`) as `0x${string}`;
        const account = privateKeyToAccount(pk); // throws if invalid
        set({ address: account.address, privateKey: pk, identityName: null, createdAt: Date.now() });
        return account.address;
      },

      disconnect: () =>
        set({ address: null, privateKey: null, identityName: null, createdAt: null }),
    }),
    {
      name: 'aquarius-passport',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
