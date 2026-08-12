import { beforeEach, describe, expect, it } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../src/app.js';
import { __resetAuthStateForTests } from '../src/routes/auth.js';
import { __resetAgentsForTests } from '../src/routes/agents.js';
import { authAddressLimiter, authIpLimiter } from '../src/lib/rate-limit.js';

const communityAddress = '0x0000000000000000000000000000000000000001';

async function signIn(app: ReturnType<typeof createApp>, privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);

  const challengeRes = await app.request('/api/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
    body: JSON.stringify({
      address: account.address,
      chainId: 31337,
    }),
  });

  expect(challengeRes.status).toBe(200);
  const challengeBody = await challengeRes.json();
  const message = challengeBody.challenge.message as string;
  const signature = await account.signMessage({ message });

  const verifyRes = await app.request('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
    body: JSON.stringify({ message, signature }),
  });

  expect(verifyRes.status).toBe(200);
  const verifyBody = await verifyRes.json();
  return {
    address: account.address,
    token: verifyBody.session.token as string,
  };
}

const agentPayload = {
  communityAddress,
  communityName: 'Test DAO',
  name: 'Treasury Bot',
  description: 'Helps with treasury',
  role: 'assistant',
  capabilities: ['vote', 'chat'],
  promptTemplate: 'Follow community bylaws.',
  initialFundingEth: '0',
  registerOnChain: false,
};

describe('API security hardening', () => {
  beforeEach(() => {
    __resetAuthStateForTests();
    __resetAgentsForTests();
    authIpLimiter.reset();
    authAddressLimiter.reset();
    delete process.env.AGENT_OPERATOR_ACTIONS_ENABLED;
    delete process.env.AGENT_OPERATOR_ALLOWLIST;
    delete process.env.AGENT_MAX_INITIAL_FUNDING_ETH;
    delete process.env.AQUARIUS_CORS_ORIGINS;
    delete process.env.NODE_ENV;
    delete process.env.AQUARIUS_ENV;
  });

  it('rejects unauthenticated agent creation', async () => {
    const app = createApp();
    const res = await app.request('/api/agents/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentPayload),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Wallet session required');
  });

  it('issues a session and creates an agent bound to the session address', async () => {
    const app = createApp();
    const privateKey = generatePrivateKey();
    const { address, token } = await signIn(app, privateKey);

    const res = await app.request('/api/agents/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(agentPayload),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.agent.creatorAddress.toLowerCase()).toBe(address.toLowerCase());
  });

  it('rejects creatorAddress that does not match the session', async () => {
    const app = createApp();
    const { token } = await signIn(app, generatePrivateKey());

    const res = await app.request('/api/agents/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...agentPayload,
        creatorAddress: '0x00000000000000000000000000000000000000aa',
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Creator mismatch');
  });

  it('rejects operator funding when operator actions are disabled', async () => {
    const app = createApp();
    const { token } = await signIn(app, generatePrivateKey());

    const res = await app.request('/api/agents/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...agentPayload,
        initialFundingEth: '0.001',
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Operator action not permitted');
  });

  it('rejects funding above AGENT_MAX_INITIAL_FUNDING_ETH', async () => {
    process.env.AGENT_OPERATOR_ACTIONS_ENABLED = 'true';
    process.env.AGENT_MAX_INITIAL_FUNDING_ETH = '0.01';
    const app = createApp();
    const { token } = await signIn(app, generatePrivateKey());

    const res = await app.request('/api/agents/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...agentPayload,
        initialFundingEth: '0.02',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Funding cap exceeded');
  });

  it('requires auth for agent listing and filters to the caller', async () => {
    const app = createApp();

    const unauth = await app.request('/api/agents');
    expect(unauth.status).toBe(401);

    const alice = await signIn(app, generatePrivateKey());
    const bob = await signIn(app, generatePrivateKey());

    await app.request('/api/agents/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alice.token}`,
      },
      body: JSON.stringify({ ...agentPayload, name: 'Alice Agent' }),
    });

    await app.request('/api/agents/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bob.token}`,
      },
      body: JSON.stringify({ ...agentPayload, name: 'Bob Agent' }),
    });

    const aliceList = await app.request('/api/agents', {
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    expect(aliceList.status).toBe(200);
    const aliceBody = await aliceList.json();
    expect(aliceBody.total).toBe(1);
    expect(aliceBody.agents[0].name ?? aliceBody.agents[0].agentCard?.name).toBeTruthy();
    expect(aliceBody.agents[0].creatorAddress.toLowerCase()).toBe(alice.address.toLowerCase());
  });

  it('keeps agent cards public', async () => {
    const app = createApp();
    const { token } = await signIn(app, generatePrivateKey());

    const createRes = await app.request('/api/agents/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(agentPayload),
    });
    const created = await createRes.json();
    const agentId = created.agent.agentId as string;

    const cardRes = await app.request(`/api/agents/${encodeURIComponent(agentId)}/card`);
    expect(cardRes.status).toBe(200);
    const card = await cardRes.json();
    expect(card.agentId).toBe(agentId);
    expect(card.schemaVersion).toBe('aquarius.agent-card.v1');
  });

  it('sets basic security headers on responses', async () => {
    const app = createApp();
    const res = await app.request('/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('rate-limits auth challenge by address', async () => {
    const app = createApp();
    const address = privateKeyToAccount(generatePrivateKey()).address;

    let lastStatus = 0;
    for (let i = 0; i < 12; i += 1) {
      const res = await app.request('/api/auth/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': `198.51.100.${i}`,
        },
        body: JSON.stringify({ address, chainId: 31337 }),
      });
      lastStatus = res.status;
      if (res.status === 429) break;
    }

    expect(lastStatus).toBe(429);
  });
});
