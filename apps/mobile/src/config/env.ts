/**
 * Expo public env helpers for the mobile app.
 *
 * Values are inlined at bundle time via EXPO_PUBLIC_* variables.
 */

function readExpoPublic(name: string): string | undefined {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    ?.process?.env?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Explicit opt-in for Anvil/dev shared-key signing.
 *
 * When unset/false (the default), the app never uses the well-known Anvil
 * account #0 key for generate-wallet or transaction signing. Local Anvil
 * workflows that need a pre-funded account must set:
 *
 *   EXPO_PUBLIC_AQUARIUS_DEV_SIGNER=1
 */
export function isDevSignerEnabled(): boolean {
  const flag = readExpoPublic('EXPO_PUBLIC_AQUARIUS_DEV_SIGNER');
  return flag === '1' || flag === 'true';
}

export function getConfiguredApiBaseUrl(): string | undefined {
  return readExpoPublic('EXPO_PUBLIC_AQUARIUS_API_BASE_URL');
}
