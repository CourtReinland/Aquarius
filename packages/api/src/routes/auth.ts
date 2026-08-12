import { Hono } from 'hono';
import { z } from 'zod';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { getAddress, isAddress, verifyMessage } from 'viem';
import { hasAuthSecretConfigured, isProductionEnv } from '../lib/env.js';
import {
  authAddressLimiter,
  authIpLimiter,
  rateLimitResponse,
  __resetRateLimitersForTests,
} from '../lib/rate-limit.js';
import { clientIp } from '../lib/request.js';

export const authRoutes = new Hono();

const MAX_CHALLENGES = 2_000;

const challengeSchema = z.object({
  address: z.string().refine(isAddress, 'address must be an EVM address'),
  chainId: z.number().int().positive(),
  domain: z.string().min(1).max(120).default('Aquarius'),
  uri: z.string().url().default('https://aquariusapp.eth'),
  statement: z.string().max(240).default(
    'Sign in to Aquarius to view community memberships, assets, rights, and obligations.'
  ),
  resources: z.array(z.string()).max(10).default(['aquarius://identity']),
});

const verifySchema = z.object({
  message: z.string().min(1).max(4000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'signature must be hex'),
});

interface ChallengeRecord {
  address: `0x${string}`;
  chainId: number;
  nonce: string;
  message: string;
  issuedAt: string;
  expirationTime: string;
}

export interface SessionRecord {
  sessionId: string;
  address: `0x${string}`;
  chainId: number;
  issuedAt: string;
  expiresAt: string;
}

const challenges = new Map<string, ChallengeRecord>();
const sessions = new Map<string, SessionRecord>();
const processSessionSecret = randomBytes(32).toString('hex');

function authSecret() {
  return process.env.AQUARIUS_AUTH_SECRET ?? processSessionSecret;
}

function base64url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function signPayload(payload: string) {
  return createHmac('sha256', authSecret()).update(payload).digest('base64url');
}

function createSessionToken(session: SessionRecord) {
  const payload = base64url(JSON.stringify(session));
  return `${payload}.${signPayload(payload)}`;
}

function verifySessionToken(token: string) {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = signPayload(payload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionRecord;
    if (Date.parse(session.expiresAt) <= Date.now()) return null;
    const stored = sessions.get(token);
    if (!stored || stored.sessionId !== session.sessionId) return null;
    return session;
  } catch {
    return null;
  }
}

function buildSiweMessage(input: z.infer<typeof challengeSchema>, nonce: string, issuedAt: string, expirationTime: string) {
  const address = getAddress(input.address);
  const resources = input.resources.length
    ? `\nResources:\n${input.resources.map((resource) => `- ${resource}`).join('\n')}`
    : '';

  return `${input.domain} wants you to sign in with your Ethereum account:
${address}

${input.statement}

URI: ${input.uri}
Version: 1
Chain ID: ${input.chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}
Expiration Time: ${expirationTime}${resources}`;
}

function parseSiweMessage(message: string) {
  const lines = message.split('\n');
  const domain = lines[0]?.replace(' wants you to sign in with your Ethereum account:', '');
  const address = lines[1];

  const field = (name: string) => {
    const prefix = `${name}: `;
    return lines.find((line) => line.startsWith(prefix))?.slice(prefix.length);
  };

  const nonce = field('Nonce');
  const chainId = Number(field('Chain ID'));
  const issuedAt = field('Issued At');
  const expirationTime = field('Expiration Time');

  if (!domain || !address || !isAddress(address) || !nonce || !chainId || !issuedAt || !expirationTime) {
    return null;
  }

  return {
    domain,
    address: getAddress(address),
    chainId,
    nonce,
    issuedAt,
    expirationTime,
  };
}

function bearerToken(header: string | undefined) {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export function getSessionFromAuthorization(header: string | undefined) {
  const token = bearerToken(header);
  return token ? verifySessionToken(token) : null;
}

export function purgeExpiredChallenges(now = Date.now()) {
  for (const [nonce, record] of challenges) {
    if (Date.parse(record.expirationTime) <= now) {
      challenges.delete(nonce);
    }
  }
}

function storeChallenge(nonce: string, record: ChallengeRecord) {
  purgeExpiredChallenges();

  if (challenges.size >= MAX_CHALLENGES) {
    const oldest = [...challenges.entries()].sort(
      (a, b) => Date.parse(a[1].issuedAt) - Date.parse(b[1].issuedAt)
    )[0];
    if (oldest) challenges.delete(oldest[0]);
  }

  challenges.set(nonce, record);
}

/** Test helper — clears in-memory auth state. */
export function __resetAuthStateForTests() {
  challenges.clear();
  sessions.clear();
  __resetRateLimitersForTests();
}

/**
 * POST /api/auth/challenge
 * Creates a SIWE-style one-time message for the wallet to sign locally.
 */
authRoutes.post('/challenge', async (c) => {
  try {
    const input = challengeSchema.parse(await c.req.json());
    const ip = clientIp(c);
    const addressKey = getAddress(input.address).toLowerCase();

    const ipLimit = authIpLimiter.check(`challenge:ip:${ip}`);
    if (!ipLimit.allowed) {
      return rateLimitResponse(
        c,
        ipLimit.retryAfterSeconds,
        'Auth rate limit exceeded. Wait before retrying challenge or verify.'
      );
    }

    const addressLimit = authAddressLimiter.check(`challenge:addr:${addressKey}`);
    if (!addressLimit.allowed) {
      return rateLimitResponse(
        c,
        addressLimit.retryAfterSeconds,
        'Auth rate limit exceeded. Wait before retrying challenge or verify.'
      );
    }

    const nonce = randomBytes(12).toString('base64url');
    const issuedAt = new Date().toISOString();
    const expirationTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const message = buildSiweMessage(input, nonce, issuedAt, expirationTime);

    const record: ChallengeRecord = {
      address: getAddress(input.address),
      chainId: input.chainId,
      nonce,
      message,
      issuedAt,
      expirationTime,
    };

    storeChallenge(nonce, record);

    return c.json({
      success: true,
      challenge: record,
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return c.json({ error: 'Invalid challenge parameters', details: error.issues }, 400);
    }
    return c.json({ error: error?.message ?? 'Failed to create challenge' }, 500);
  }
});

/**
 * POST /api/auth/verify
 * Verifies the signature and returns a short-lived Aquarius API session.
 */
authRoutes.post('/verify', async (c) => {
  try {
    if (isProductionEnv() && !hasAuthSecretConfigured()) {
      return c.json(
        {
          error: 'Server misconfigured',
          message: 'AQUARIUS_AUTH_SECRET is required in production before sessions can be issued.',
        },
        503
      );
    }

    const input = verifySchema.parse(await c.req.json());
    const parsed = parseSiweMessage(input.message);

    if (!parsed) {
      return c.json({ error: 'Invalid SIWE message' }, 400);
    }

    const ip = clientIp(c);
    const ipLimit = authIpLimiter.check(`verify:ip:${ip}`);
    if (!ipLimit.allowed) {
      return rateLimitResponse(
        c,
        ipLimit.retryAfterSeconds,
        'Auth rate limit exceeded. Wait before retrying challenge or verify.'
      );
    }

    const addressLimit = authAddressLimiter.check(`verify:addr:${parsed.address.toLowerCase()}`);
    if (!addressLimit.allowed) {
      return rateLimitResponse(
        c,
        addressLimit.retryAfterSeconds,
        'Auth rate limit exceeded. Wait before retrying challenge or verify.'
      );
    }

    const challenge = challenges.get(parsed.nonce);
    if (!challenge) {
      return c.json({ error: 'Challenge not found or already used' }, 401);
    }

    if (
      challenge.message !== input.message ||
      challenge.address !== parsed.address ||
      challenge.chainId !== parsed.chainId
    ) {
      return c.json({ error: 'Challenge mismatch' }, 401);
    }

    if (Date.parse(challenge.expirationTime) <= Date.now()) {
      challenges.delete(parsed.nonce);
      return c.json({ error: 'Challenge expired' }, 401);
    }

    const valid = await verifyMessage({
      address: parsed.address,
      message: input.message,
      signature: input.signature as `0x${string}`,
    });

    if (!valid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    challenges.delete(parsed.nonce);

    const session: SessionRecord = {
      sessionId: randomUUID(),
      address: parsed.address,
      chainId: parsed.chainId,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };

    const token = createSessionToken(session);
    sessions.set(token, session);

    return c.json({
      success: true,
      session: {
        ...session,
        token,
      },
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return c.json({ error: 'Invalid verification parameters', details: error.issues }, 400);
    }
    return c.json({ error: error?.message ?? 'Failed to verify signature' }, 500);
  }
});

/**
 * GET /api/auth/session
 * Checks whether a bearer token still represents a valid wallet session.
 */
authRoutes.get('/session', (c) => {
  const session = getSessionFromAuthorization(c.req.header('authorization'));

  if (!session) {
    return c.json({ authenticated: false }, 401);
  }

  return c.json({
    authenticated: true,
    session,
  });
});

/**
 * POST /api/auth/logout
 * Revokes a convenience API session. Wallet ownership remains the real identity.
 */
authRoutes.post('/logout', (c) => {
  const token = bearerToken(c.req.header('authorization'));
  if (token) sessions.delete(token);
  return c.json({ success: true });
});
