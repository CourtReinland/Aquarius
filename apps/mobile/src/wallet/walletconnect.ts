import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createWalletClient,
  custom,
  getAddress,
  type Account,
  type Address,
  type WalletClient,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { defaultChain } from '../config/chains';
import { getWalletConnectProjectId, isWalletConnectConfigured } from '../config/env';

type EthereumProviderInstance = InstanceType<
  typeof import('@walletconnect/ethereum-provider').default
>;

export type WalletConnectWalletClient = WalletClient & { account: Account };

export type WalletConnectSnapshot = {
  configured: boolean;
  available: boolean;
  connecting: boolean;
  connected: boolean;
  address: Address | null;
  pairingUri: string | null;
  error: string | null;
};

type SnapshotListener = (snapshot: WalletConnectSnapshot) => void;

const METADATA = {
  name: 'Aquarius',
  description: 'Wallet-native community governance',
  url: 'https://aquariusapp.eth',
  icons: ['https://avatars.githubusercontent.com/u/30091591?v=4'],
  redirect: {
    native: 'aquarius://wc',
  },
};

const OPTIONAL_METHODS = [
  'personal_sign',
  'eth_sendTransaction',
  'eth_signTypedData',
  'eth_signTypedData_v4',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
];

const listeners = new Set<SnapshotListener>();

let provider: EthereumProviderInstance | null = null;
let providerPromise: Promise<EthereumProviderInstance> | null = null;
let eventsBound = false;
let connectedAddress: Address | null = null;

let snapshot: WalletConnectSnapshot = {
  configured: isWalletConnectConfigured(),
  available: isWalletConnectUiEnabled(),
  connecting: false,
  connected: false,
  address: null,
  pairingUri: null,
  error: null,
};

export function isWalletConnectUiEnabled(): boolean {
  return isWalletConnectConfigured() && Platform.OS !== 'web';
}

export function isWalletConnectSessionActive(): boolean {
  return connectedAddress != null;
}

export function getWalletConnectAddress(): Address | null {
  return connectedAddress;
}

export function getWalletConnectSnapshot(): WalletConnectSnapshot {
  return snapshot;
}

export function subscribeWalletConnect(listener: SnapshotListener): () => void {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
}

function emit(partial: Partial<WalletConnectSnapshot>) {
  snapshot = {
    ...snapshot,
    configured: isWalletConnectConfigured(),
    available: isWalletConnectUiEnabled(),
    ...partial,
  };
  for (const listener of listeners) listener(snapshot);
}

function setActiveAddress(address: Address | null) {
  connectedAddress = address;
  emit({
    connected: address != null,
    address,
    pairingUri: address ? null : snapshot.pairingUri,
  });
}

function asAddress(value: string): Address {
  return getAddress(value);
}

function jsonRpcAccount(address: Address): Account {
  return {
    address,
    type: 'json-rpc',
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'WalletConnect request failed';
}

/**
 * AsyncStorage adapter for WalletConnect session persistence.
 * WC stores JSON values; we stringify/parse the same way the default web storage does.
 */
const walletConnectStorage = {
  async getKeys(): Promise<string[]> {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter((key) => key.startsWith('wc@') || key.startsWith('walletconnect'));
  },
  async getEntries<T = unknown>(): Promise<[string, T][]> {
    const keys = await walletConnectStorage.getKeys();
    if (keys.length === 0) return [];
    const pairs = await AsyncStorage.multiGet(keys);
    return pairs.flatMap(([key, value]) => {
      if (value == null) return [];
      return [[key, decodeStored(value) as T] as [string, T]];
    });
  },
  async getItem<T = unknown>(key: string): Promise<T | undefined> {
    const value = await AsyncStorage.getItem(key);
    if (value == null) return undefined;
    return decodeStored(value) as T;
  },
  async setItem<T = unknown>(key: string, value: T): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await AsyncStorage.setItem(key, serialized);
  },
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

function decodeStored(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function loadEthereumProviderModule() {
  if (Platform.OS === 'web') {
    throw new Error('WalletConnect is available in the Android app, not the web preview.');
  }
  return import('@walletconnect/ethereum-provider');
}

function bindProviderEvents(instance: EthereumProviderInstance) {
  if (eventsBound) return;
  eventsBound = true;

  instance.on('display_uri', (uri: string) => {
    emit({ pairingUri: uri, connecting: true, error: null });
  });

  instance.on('accountsChanged', (accounts: string[]) => {
    if (!accounts?.length) {
      setActiveAddress(null);
      return;
    }
    setActiveAddress(asAddress(accounts[0]));
  });

  instance.on('disconnect', () => {
    setActiveAddress(null);
    emit({ connecting: false, pairingUri: null });
  });
}

async function getOrInitProvider(): Promise<EthereumProviderInstance> {
  if (provider) return provider;
  if (providerPromise) return providerPromise;

  const projectId = getWalletConnectProjectId();
  if (!projectId) {
    throw new Error(
      'WalletConnect is disabled. Set EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID to enable it.'
    );
  }

  providerPromise = (async () => {
    const { EthereumProvider } = await loadEthereumProviderModule();
    const instance = await EthereumProvider.init({
      projectId,
      showQrModal: false,
      optionalChains: [1, base.id, baseSepolia.id, defaultChain.id],
      optionalMethods: OPTIONAL_METHODS,
      metadata: METADATA,
      storage: walletConnectStorage,
    });
    bindProviderEvents(instance);
    provider = instance;
    return instance;
  })();

  try {
    return await providerPromise;
  } catch (error) {
    providerPromise = null;
    throw error;
  }
}

async function requestDefaultChain(instance: EthereumProviderInstance): Promise<void> {
  try {
    await instance.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${defaultChain.id.toString(16)}` }],
    });
  } catch {
    // Most external wallets cannot switch to local Anvil. SIWE still works.
  }
}

function sessionAccount(instance: EthereumProviderInstance): Address | null {
  const account = instance.accounts?.[0];
  if (!instance.session || !account) return null;
  return asAddress(account);
}

/**
 * Restore a persisted WalletConnect session, if any.
 * Safe to call when WC is unset — returns null.
 */
export async function hydrateWalletConnect(): Promise<Address | null> {
  if (!isWalletConnectUiEnabled()) return null;

  try {
    const instance = await getOrInitProvider();
    const address = sessionAccount(instance);
    if (!address) return null;
    setActiveAddress(address);
    return address;
  } catch (error) {
    console.warn('[WalletConnect] hydrate failed:', toErrorMessage(error));
    emit({ error: toErrorMessage(error) });
    return null;
  }
}

export async function connectWalletConnect(): Promise<Address> {
  if (!isWalletConnectConfigured()) {
    throw new Error(
      'WalletConnect is disabled. Set EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID to enable it.'
    );
  }
  if (Platform.OS === 'web') {
    throw new Error('WalletConnect is available in the Android app, not the web preview.');
  }

  emit({ connecting: true, error: null, pairingUri: null });

  const instance = await getOrInitProvider();
  const existing = sessionAccount(instance);
  if (existing) {
    setActiveAddress(existing);
    emit({ connecting: false, pairingUri: null });
    return existing;
  }

  try {
    await instance.connect();
    const address = sessionAccount(instance);
    if (!address) {
      throw new Error('WalletConnect session has no account');
    }
    setActiveAddress(address);
    void requestDefaultChain(instance);
    emit({ connecting: false, pairingUri: null, error: null });
    return address;
  } catch (error) {
    emit({ connecting: false, pairingUri: null, error: toErrorMessage(error) });
    throw error;
  }
}

export async function disconnectWalletConnect(): Promise<void> {
  if (provider) {
    try {
      await provider.disconnect();
    } catch {
      // Session may already be gone.
    }
  }
  setActiveAddress(null);
  emit({ connecting: false, pairingUri: null, error: null });
}

export async function getWalletConnectWalletClient(): Promise<WalletConnectWalletClient | null> {
  if (!isWalletConnectSessionActive()) return null;

  const instance = provider ?? (await getOrInitProvider().catch(() => null));
  const address = connectedAddress ?? (instance ? sessionAccount(instance) : null);
  if (!instance || !address) return null;

  return createWalletClient({
    account: jsonRpcAccount(address),
    chain: defaultChain,
    transport: custom(instance),
  }) as WalletConnectWalletClient;
}

/**
 * Open a `wc:` pairing URI in an installed wallet (Android Intent).
 * iOS often needs extra query-scheme config; failure is non-fatal.
 */
export async function openWalletConnectUri(uri: string): Promise<boolean> {
  try {
    await Linking.openURL(uri);
    return true;
  } catch {
    return false;
  }
}
