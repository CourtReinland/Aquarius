import { createConfig, http } from 'wagmi';
import { baseSepolia, base } from 'viem/chains';

/**
 * Wagmi configuration for Aquarius.
 *
 * WalletConnect v2 for Expo lives in `src/wallet/walletconnect.ts`
 * (`@walletconnect/ethereum-provider`) and is selected by `getWalletClient()`.
 * Coinbase Wallet SDK and hardware wallets are still later.
 */
export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
