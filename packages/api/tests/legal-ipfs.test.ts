import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../src/app.js';
import { IPFS_UNCONFIGURED_WARNING } from '../src/lib/ipfs.js';
import { __resetRateLimitersForTests } from '../src/lib/rate-limit.js';
import { __issueSessionForTests, __resetAuthStateForTests } from '../src/routes/auth.js';

const TEST_CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';

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

const grokCharter =
  '# Preamble\nName and Formation\nMembership\nGovernance\nFounders\nEconomic\nInstitution\nPosition\nShare\nProposal\nDispute\nAlliance\nAmendment\nDissolution\nDisclaimer\n';

function grokResponse() {
  return Response.json({
    model: 'grok-4',
    choices: [{ message: { content: grokCharter } }],
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  });
}

async function issueToken() {
  const account = privateKeyToAccount(generatePrivateKey());
  const token = await __issueSessionForTests({
    sessionId: `ipfs-test-${account.address}`,
    address: account.address,
    chainId: 31337,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  return token;
}

describe('legal IPFS pinning routes', () => {
  const originalFetch = globalThis.fetch;
  const envKeys = [
    'XAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'IPFS_API_URL',
    'IPFS_PINNING_TOKEN',
    'IPFS_GATEWAY_URL',
  ] as const;
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]])
  );

  beforeEach(async () => {
    await __resetAuthStateForTests();
    __resetRateLimitersForTests();
    for (const key of envKeys) delete process.env[key];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('generate without IPFS still succeeds with cid null and a warning', async () => {
    process.env.XAI_API_KEY = 'xai-test-key';
    const fetchMock = vi.fn(async () => grokResponse());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = createApp();
    const token = await issueToken();

    const res = await app.request('/api/legal/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(legalGeneratePayload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.document).toContain('Preamble');
    expect(body.cid).toBeNull();
    expect(body.uri).toBeNull();
    expect(body.warning).toBe(IPFS_UNCONFIGURED_WARNING);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.x.ai/v1/chat/completions');
  });

  it('generate pins when IPFS is configured and returns cid + uri', async () => {
    process.env.XAI_API_KEY = 'xai-test-key';
    process.env.IPFS_API_URL = 'http://127.0.0.1:5001';

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.x.ai')) return grokResponse();
      if (url.includes('/api/v0/add')) {
        return Response.json({ Hash: TEST_CID, Size: '64' });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = createApp();
    const token = await issueToken();

    const res = await app.request('/api/legal/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(legalGeneratePayload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.cid).toBe(TEST_CID);
    expect(body.uri).toBe(`ipfs://${TEST_CID}`);
    expect(body.warning).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects pin without a session', async () => {
    const app = createApp();
    const res = await app.request('/api/legal/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: '# Charter' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Wallet session required');
  });

  it('pin success returns cid', async () => {
    process.env.IPFS_API_URL = 'http://127.0.0.1:5001';
    const fetchMock = vi.fn(async () =>
      Response.json({ Hash: TEST_CID, Size: '12' })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = createApp();
    const token = await issueToken();

    const res = await app.request('/api/legal/pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ markdown: '# Charter' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.cid).toBe(TEST_CID);
    expect(body.uri).toBe(`ipfs://${TEST_CID}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://127.0.0.1:5001/api/v0/add?pin=true');
  });

  it('bounds pin markdown size like summarize', async () => {
    const app = createApp();
    const token = await issueToken();

    const res = await app.request('/api/legal/pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ markdown: 'x'.repeat(50_001) }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid parameters');
  });
});
