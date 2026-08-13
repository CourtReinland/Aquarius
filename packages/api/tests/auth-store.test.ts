import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db/schema.js';
import {
  MemoryAuthStore,
  PostgresAuthStore,
  type AuthStore,
} from '../src/db/auth-store.js';
import { createApp } from '../src/app.js';
import { __resetAuthStateForTests, __setAuthStoreForTests } from '../src/routes/auth.js';

const address = '0x0000000000000000000000000000000000000001' as `0x${string}`;

const challenge = {
  address,
  chainId: 31337,
  nonce: 'nonce-one',
  message: 'sign this',
  issuedAt: new Date().toISOString(),
  expirationTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
};

const session = {
  sessionId: 'session-one',
  address,
  chainId: 31337,
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
};

function runAuthStoreContract(name: string, createStore: () => Promise<AuthStore>) {
  describe(name, () => {
    let store: AuthStore;

    beforeEach(async () => {
      store = await createStore();
      await store.clear();
    });

    it('consumes a challenge only once', async () => {
      await store.putChallenge(challenge);
      const first = await store.consumeChallenge(challenge.nonce);
      expect(first?.nonce).toBe(challenge.nonce);
      const second = await store.consumeChallenge(challenge.nonce);
      expect(second).toBeNull();
    });

    it('revokes a session token on delete', async () => {
      const token = 'test-session-token';
      await store.putSession(token, session);
      expect(await store.getSession(token)).toMatchObject({ sessionId: session.sessionId });
      await store.deleteSession(token);
      expect(await store.getSession(token)).toBeNull();
    });

    it('rejects and purges an expired session', async () => {
      const token = 'expired-session-token';
      await store.putSession(token, {
        ...session,
        sessionId: 'expired',
        issuedAt: new Date(Date.now() - 60_000).toISOString(),
        expiresAt: new Date(Date.now() - 1).toISOString(),
      });
      expect(await store.getSession(token)).toBeNull();
    });

    it('treats expired challenges as missing', async () => {
      await store.putChallenge({
        ...challenge,
        nonce: 'expired-nonce',
        issuedAt: new Date(Date.now() - 60_000).toISOString(),
        expirationTime: new Date(Date.now() - 1).toISOString(),
      });
      expect(await store.getChallenge('expired-nonce')).toBeNull();
      expect(await store.consumeChallenge('expired-nonce')).toBeNull();
    });
  });
}

runAuthStoreContract('MemoryAuthStore', async () => new MemoryAuthStore());

describe('PostgresAuthStore (pglite)', () => {
  let client: PGlite | undefined;

  async function createPostgresStore(): Promise<PostgresAuthStore> {
    await client?.close();
    client = new PGlite();
    const migration = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../drizzle/0002_auth_sessions.sql'),
      'utf8'
    );
    await client.exec(migration);
    const db = drizzle(client, { schema });
    return new PostgresAuthStore(db);
  }

  runAuthStoreContract('contract', createPostgresStore);

  afterEach(async () => {
    await client?.close();
    client = undefined;
  });
});

describe('HTTP auth against PostgresAuthStore', () => {
  let client: PGlite | undefined;

  beforeEach(async () => {
    await __resetAuthStateForTests();
    client = new PGlite();
    const migration = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../drizzle/0002_auth_sessions.sql'),
      'utf8'
    );
    await client.exec(migration);
    const db = drizzle(client, { schema });
    __setAuthStoreForTests(new PostgresAuthStore(db));
  });

  afterEach(async () => {
    await __resetAuthStateForTests();
    await client?.close();
    client = undefined;
  });

  it('issues, looks up, and revokes a session through the durable store', async () => {
    const app = createApp();
    const account = privateKeyToAccount(generatePrivateKey());

    const challengeRes = await app.request('/api/auth/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.10' },
      body: JSON.stringify({ address: account.address, chainId: 31337 }),
    });
    expect(challengeRes.status).toBe(200);
    const challengeBody = await challengeRes.json();
    const message = challengeBody.challenge.message as string;
    const signature = await account.signMessage({ message });

    const verifyRes = await app.request('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.10' },
      body: JSON.stringify({ message, signature }),
    });
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    const token = verifyBody.session.token as string;

    const reuse = await app.request('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.10' },
      body: JSON.stringify({ message, signature }),
    });
    expect(reuse.status).toBe(401);

    const sessionRes = await app.request('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(sessionRes.status).toBe(200);

    await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    const afterLogout = await app.request('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(afterLogout.status).toBe(401);
  });
});
