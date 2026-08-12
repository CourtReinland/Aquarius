import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Address,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defaultChain } from '../config/chains';
import { isDevSignerEnabled } from '../config/env';
import {
  clearPrivateKey,
  getKeyStorageBackend,
  persistPrivateKey,
  readPrivateKey,
  type KeyStorageBackend,
} from './keyStorage';

/**
 * Well-known Anvil account #0. Only usable when EXPO_PUBLIC_AQUARIUS_DEV_SIGNER=1.
 * Never treat this as a production or default signing path.
 */
export const ANVIL_ACCOUNT_0_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

export type SignerMode = 'none' | 'local-key' | 'dev-anvil';

type AquariusWalletClient = WalletClient & { account: Account };

let memoryPrivateKey: `0x${string}` | undefined;
let cachedAccount: Account | undefined;
let hydratePromise: Promise<Account | null> | null = null;

const publicClient = createPublicClient({
  chain: defaultChain,
  transport: http(),
});

function accountFromKey(privateKey: `0x${string}`): Account {
  return privateKeyToAccount(privateKey);
}

function setMemoryKey(privateKey: `0x${string}` | undefined) {
  memoryPrivateKey = privateKey;
  cachedAccount = privateKey ? accountFromKey(privateKey) : undefined;
}

export function isAnvilDevKey(privateKey: `0x${string}`): boolean {
  return privateKey.toLowerCase() === ANVIL_ACCOUNT_0_PRIVATE_KEY.toLowerCase();
}

export function getSignerMode(): SignerMode {
  if (!memoryPrivateKey) return 'none';
  if (isAnvilDevKey(memoryPrivateKey) && isDevSignerEnabled()) return 'dev-anvil';
  return 'local-key';
}

export function isDevAnvilSignerActive(): boolean {
  return getSignerMode() === 'dev-anvil';
}

export function getConnectedAddress(): Address | null {
  return cachedAccount?.address ?? null;
}

/**
 * Install a signing key for the current session and persist it.
 * Private keys are never logged.
 */
export async function setSigningKey(privateKey: `0x${string}`): Promise<Account> {
  if (isAnvilDevKey(privateKey) && !isDevSignerEnabled()) {
    throw new Error(
      'Anvil shared-key signing is disabled. Set EXPO_PUBLIC_AQUARIUS_DEV_SIGNER=1 for local Anvil only.'
    );
  }

  const account = accountFromKey(privateKey);
  const backend = await persistPrivateKey(privateKey);
  setMemoryKey(privateKey);

  if (backend === 'web-async-fallback' && typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(
      '[Wallet] Using insecure web AsyncStorage fallback for signing key. Native builds use SecureStore.'
    );
  }

  return account;
}

/**
 * Adopt Anvil account #0. Requires the explicit dev-signer env flag.
 */
export async function useAnvilDevSigner(): Promise<Account> {
  if (!isDevSignerEnabled()) {
    throw new Error(
      'Dev signer is off. Export EXPO_PUBLIC_AQUARIUS_DEV_SIGNER=1 to use the Anvil pre-funded account.'
    );
  }
  return setSigningKey(ANVIL_ACCOUNT_0_PRIVATE_KEY);
}

export async function clearSigningKey(): Promise<void> {
  setMemoryKey(undefined);
  await clearPrivateKey();
}

export async function hydrateSigningKey(): Promise<Account | null> {
  if (cachedAccount) return cachedAccount;
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const stored = await readPrivateKey();
    if (!stored) return null;

    if (isAnvilDevKey(stored) && !isDevSignerEnabled()) {
      // Stale shared key from a previous DEV_SIGNER session — drop it.
      await clearPrivateKey();
      return null;
    }

    setMemoryKey(stored);
    return cachedAccount ?? null;
  })();

  try {
    return await hydratePromise;
  } finally {
    hydratePromise = null;
  }
}

export async function getSigningAccount(): Promise<Account | null> {
  if (cachedAccount) return cachedAccount;
  return hydrateSigningKey();
}

/**
 * Single signing abstraction for all contract writes and SIWE.
 * Returns a viem WalletClient bound to the connected local key.
 */
export async function getWalletClient(): Promise<AquariusWalletClient> {
  const account = await getSigningAccount();
  if (!account || !memoryPrivateKey) {
    throw new Error('No signing wallet connected');
  }

  if (isAnvilDevKey(memoryPrivateKey) && !isDevSignerEnabled()) {
    throw new Error(
      'Anvil shared-key signing is disabled. Reconnect with a personal key or enable EXPO_PUBLIC_AQUARIUS_DEV_SIGNER=1.'
    );
  }

  return createWalletClient({
    account,
    chain: defaultChain,
    transport: http(),
  }) as AquariusWalletClient;
}

export async function getPublicClient() {
  return publicClient;
}

export async function describeKeyStorage(): Promise<{
  backend: KeyStorageBackend;
  mode: SignerMode;
  address: Address | null;
  devSignerEnabled: boolean;
}> {
  return {
    backend: await getKeyStorageBackend(),
    mode: getSignerMode(),
    address: getConnectedAddress(),
    devSignerEnabled: isDevSignerEnabled(),
  };
}
