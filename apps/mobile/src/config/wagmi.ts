import { createConfig, http } from 'wagmi';
import { baseSepolia, base } from 'viem/chains';

/**
 * Wagmi configuration for Aquarius.
 *
 * For now we use a simple HTTP transport. In production we'll add:
 * - WalletConnect connector (for MetaMask, Rainbow, etc.)
 * - Coinbase Smart Wallet connector (for gasless onboarding)
 * - Privy embedded wallet (for email/social login)
 *
 * Starting with injected connector for dev/testing with Expo.
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
