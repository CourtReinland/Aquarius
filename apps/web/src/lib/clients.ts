import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defaultChain } from './chains';

export const publicClient = createPublicClient({
  chain: defaultChain,
  transport: http(),
});

export function walletClientFor(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({ account, chain: defaultChain, transport: http() });
}

export function shortAddr(addr: string | Address | null | undefined): string {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
