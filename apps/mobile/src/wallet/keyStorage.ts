import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Signing-key storage.
 *
 * Threat model (local Passport / EOA key):
 * - The private key is the root of wallet identity. It must never be sent to
 *   the API, logged, or written into the Passport AsyncStorage blob.
 * - On native (iOS/Android) we use expo-secure-store (Keychain / Keystore).
 * - On web preview, SecureStore is unavailable. We fall back to AsyncStorage
 *   under a dedicated key and treat that as **insecure preview-only** storage.
 *   Do not use the web preview path with real funds.
 */

const SECURE_KEY = 'aquarius.signingPrivateKey';
const WEB_FALLBACK_KEY = 'aquarius-signing-key-web-insecure';

type SecureStoreModule = typeof import('expo-secure-store');

let secureStorePromise: Promise<SecureStoreModule | null> | null = null;

async function getSecureStore(): Promise<SecureStoreModule | null> {
  if (Platform.OS === 'web') return null;
  if (!secureStorePromise) {
    secureStorePromise = import('expo-secure-store')
      .then((mod) => mod)
      .catch(() => null);
  }
  return secureStorePromise;
}

export type KeyStorageBackend = 'secure-store' | 'web-async-fallback' | 'unavailable';

export async function getKeyStorageBackend(): Promise<KeyStorageBackend> {
  const secureStore = await getSecureStore();
  if (secureStore) return 'secure-store';
  if (Platform.OS === 'web') return 'web-async-fallback';
  return 'unavailable';
}

export async function persistPrivateKey(privateKey: `0x${string}`): Promise<KeyStorageBackend> {
  const secureStore = await getSecureStore();
  if (secureStore) {
    await secureStore.setItemAsync(SECURE_KEY, privateKey, {
      keychainAccessible: secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return 'secure-store';
  }

  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(WEB_FALLBACK_KEY, privateKey);
    return 'web-async-fallback';
  }

  throw new Error('No secure key storage backend is available on this platform');
}

export async function readPrivateKey(): Promise<`0x${string}` | null> {
  const secureStore = await getSecureStore();
  if (secureStore) {
    const value = await secureStore.getItemAsync(SECURE_KEY);
    return normalizePrivateKey(value);
  }

  if (Platform.OS === 'web') {
    const value = await AsyncStorage.getItem(WEB_FALLBACK_KEY);
    return normalizePrivateKey(value);
  }

  return null;
}

export async function clearPrivateKey(): Promise<void> {
  const secureStore = await getSecureStore();
  if (secureStore) {
    await secureStore.deleteItemAsync(SECURE_KEY);
  }
  await AsyncStorage.removeItem(WEB_FALLBACK_KEY);
}

function normalizePrivateKey(value: string | null): `0x${string}` | null {
  if (!value) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
  return value as `0x${string}`;
}
