import { beforeEach, describe, expect, it } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../src/app.js';
import { __issueSessionForTests, __resetAuthStateForTests } from '../src/routes/auth.js';
import { __resetAgentsForTests } from '../src/routes/agents.js';
import {
  __resetRateLimitersForTests,
  legalGenerateAddressLimiter,
} from '../src/lib/rate-limit.js';

const communityAddress = '0x0000000000000000000000000000000000000001';

const legalGeneratePayload = {
  name: 'Cupcake DAO',
  founders: ['0x0000000000000000000000000000000000000001'],
  charterTemplate: 'draft-original',
  admissionRule: 'founders-only',
  exileRule: 'founders-only',
  votePercentage: 66,
  whoMayPropose: 'founders-only',
  legalFramework: '',
  jurisdiction: '',
  allowCorporateMembers: false,
  bankingStyle: 'austrian',
  startingTokenAmount: 1000000,
  allowFractionalLending: false,
  leverageRatio: 1,
};

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
  beforeEach(async () => {
    await __resetAuthStateForTests();
    __resetAgentsForTests();
    __resetRateLimitersForTests();
    delete process.env.AGENT_OPERATOR_ACTIONS_ENABLED;
    delete process.env.AGENT_OPERATOR_ALLOWLIST;
    delete process.env.AGENT_MAX_INITIAL_FUNDING_ETH;
    delete process.env.AQUARIUS_CORS_ORIGINS;
    delete process.env.NODE_ENV;
    delete process.env.AQUARIUS_ENV;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.XAI_API_KEY;
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

  it('rejects unauthenticated legal generation and blue chat', async () => {
    const app = createApp();

    const generateRes = await app.request('/api/legal/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(legalGeneratePayload),
    });
    expect(generateRes.status).toBe(401);
    const generateBody = await generateRes.json();
    expect(generateBody.error).toBe('Wallet session required');

    const summarizeRes = await app.request('/api/legal/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ charter: 'Preamble...', communityName: 'Cupcake DAO' }),
    });
    expect(summarizeRes.status).toBe(401);

    const chatRes = await app.request('/api/blue/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello blue' }),
    });
    expect(chatRes.status).toBe(401);
    const chatBody = await chatRes.json();
    expect(chatBody.error).toBe('Wallet session required');
  });

  it('keeps legal templates public and hides blue provider key presence', async () => {
    const app = createApp();

    const templatesRes = await app.request('/api/legal/templates');
    expect(templatesRes.status).toBe(200);
    const templatesBody = await templatesRes.json();
    expect(Array.isArray(templatesBody.templates)).toBe(true);

    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.XAI_API_KEY = 'test-xai';
    const statusRes = await app.request('/api/blue/status');
    expect(statusRes.status).toBe(200);
    const statusBody = await statusRes.json();
    expect(statusBody).toEqual({ available: true });
    expect(statusBody.grok).toBeUndefined();
    expect(statusBody.claude).toBeUndefined();
    expect(statusBody.grokModel).toBeUndefined();
    expect(statusBody.claudeModel).toBeUndefined();
  });

  it('bounds summarize charter size', async () => {
    const app = createApp();
    const { token } = await signIn(app, generatePrivateKey());

    const res = await app.request('/api/legal/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        charter: 'x'.repeat(50_001),
        communityName: 'Cupcake DAO',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid parameters');
  });

  it('rate-limits legal generate by session address', async () => {
    const app = createApp();
    const { token } = await signIn(app, generatePrivateKey());

    // Ensure limiter is empty, then burn the address budget (3 / 15 min).
    legalGenerateAddressLimiter.reset();

    let lastStatus = 0;
    for (let i = 0; i < 4; i += 1) {
      const res = await app.request('/api/legal/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-forwarded-for': `203.0.113.${40 + i}`,
        },
        body: JSON.stringify(legalGeneratePayload),
      });
      lastStatus = res.status;
      // Without XAI_API_KEY / ANTHROPIC_API_KEY, under-limit requests return 503 after the limiter check.
      if (res.status === 429) break;
      expect([503, 429]).toContain(res.status);
    }

    expect(lastStatus).toBe(429);
  });

  it('rejects a reused auth challenge', async () => {
    const app = createApp();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    const challengeRes = await app.request('/api/auth/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.20' },
      body: JSON.stringify({ address: account.address, chainId: 31337 }),
    });
    expect(challengeRes.status).toBe(200);
    const challengeBody = await challengeRes.json();
    const message = challengeBody.challenge.message as string;
    const signature = await account.signMessage({ message });

    const first = await app.request('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.20' },
      body: JSON.stringify({ message, signature }),
    });
    expect(first.status).toBe(200);

    const second = await app.request('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.20' },
      body: JSON.stringify({ message, signature }),
    });
    expect(second.status).toBe(401);
    const secondBody = await second.json();
    expect(secondBody.error).toBe('Challenge not found or already used');
  });

  it('revokes the bearer token on logout', async () => {
    const app = createApp();
    const { token } = await signIn(app, generatePrivateKey());

    const before = await app.request('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(before.status).toBe(200);

    const logout = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logout.status).toBe(200);

    const after = await app.request('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(after.status).toBe(401);
    const afterBody = await after.json();
    expect(afterBody.authenticated).toBe(false);

    const createRes = await app.request('/api/agents/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(agentPayload),
    });
    expect(createRes.status).toBe(401);
  });

  it('rejects an expired session token', async () => {
    const app = createApp();
    const account = privateKeyToAccount(generatePrivateKey());
    const token = await __issueSessionForTests({
      sessionId: 'expired-session',
      address: account.address,
      chainId: 31337,
      issuedAt: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    const res = await app.request('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });
});
