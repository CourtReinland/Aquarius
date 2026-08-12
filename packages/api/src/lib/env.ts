/** Shared env helpers for API security posture. */

export function isProductionEnv(): boolean {
  const nodeEnv = (process.env.NODE_ENV ?? '').toLowerCase();
  const aquariusEnv = (process.env.AQUARIUS_ENV ?? '').toLowerCase();
  return nodeEnv === 'production' || aquariusEnv === 'production';
}

export function hasAuthSecretConfigured(): boolean {
  return Boolean(process.env.AQUARIUS_AUTH_SECRET?.trim());
}

/**
 * Refuse to boot the API in production without a stable HMAC secret.
 * Call from the process entrypoint before serving traffic.
 */
export function assertProductionAuthSecret(): void {
  if (isProductionEnv() && !hasAuthSecretConfigured()) {
    console.error(
      'Refusing to start: AQUARIUS_AUTH_SECRET is required when NODE_ENV or AQUARIUS_ENV is production.'
    );
    process.exit(1);
  }
}

const DEV_CORS_ORIGINS = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

/**
 * Resolve CORS allowlist.
 * - Explicit `AQUARIUS_CORS_ORIGINS` (comma-separated) always wins.
 * - Production without an allowlist returns [] (no browser cross-origin).
 * - Development defaults to common Expo/web localhost origins.
 */
export function resolveCorsOrigins(): string[] {
  const raw = process.env.AQUARIUS_CORS_ORIGINS?.trim();
  if (raw) {
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  if (isProductionEnv()) {
    return [];
  }

  return [...DEV_CORS_ORIGINS];
}

export function maxInitialFundingEth(): string {
  return process.env.AGENT_MAX_INITIAL_FUNDING_ETH?.trim() || '0.01';
}

/**
 * Operator-funded actions (wallet funding / on-chain registration) require an
 * explicit enable flag. When `AGENT_OPERATOR_ALLOWLIST` is set, the session
 * address must appear on that list.
 */
export function operatorActionsAllowed(sessionAddress: string): {
  ok: boolean;
  reason?: string;
} {
  if (process.env.AGENT_OPERATOR_ACTIONS_ENABLED !== 'true') {
    return {
      ok: false,
      reason:
        'Operator-funded actions are disabled. Set AGENT_OPERATOR_ACTIONS_ENABLED=true to allow funding or on-chain registration.',
    };
  }

  const allowlist = (process.env.AGENT_OPERATOR_ALLOWLIST ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length > 0 && !allowlist.includes(sessionAddress.toLowerCase())) {
    return {
      ok: false,
      reason: 'Caller is not on AGENT_OPERATOR_ALLOWLIST',
    };
  }

  return { ok: true };
}
