import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IPFS_PIN_FAILED_WARNING,
  IPFS_UNCONFIGURED_WARNING,
  buildIpfsUri,
  isIpfsConfigured,
  pinMarkdownToIpfs,
  resolveIpfsAddUrl,
  safePinFilename,
  tryPinMarkdownToIpfs,
} from './ipfs.js';

const TEST_CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';

describe('ipfs helper', () => {
  const originalFetch = globalThis.fetch;
  const originalApi = process.env.IPFS_API_URL;
  const originalToken = process.env.IPFS_PINNING_TOKEN;
  const originalGateway = process.env.IPFS_GATEWAY_URL;

  beforeEach(() => {
    delete process.env.IPFS_API_URL;
    delete process.env.IPFS_PINNING_TOKEN;
    delete process.env.IPFS_GATEWAY_URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    if (originalApi === undefined) delete process.env.IPFS_API_URL;
    else process.env.IPFS_API_URL = originalApi;
    if (originalToken === undefined) delete process.env.IPFS_PINNING_TOKEN;
    else process.env.IPFS_PINNING_TOKEN = originalToken;
    if (originalGateway === undefined) delete process.env.IPFS_GATEWAY_URL;
    else process.env.IPFS_GATEWAY_URL = originalGateway;
  });

  it('reports unconfigured when IPFS_API_URL is unset', () => {
    expect(isIpfsConfigured()).toBe(false);
    process.env.IPFS_API_URL = 'http://127.0.0.1:5001';
    expect(isIpfsConfigured()).toBe(true);
  });

  it('maps Kubo roots and add paths to /api/v0/add?pin=true', () => {
    expect(resolveIpfsAddUrl('http://127.0.0.1:5001')).toBe(
      'http://127.0.0.1:5001/api/v0/add?pin=true'
    );
    expect(resolveIpfsAddUrl('http://127.0.0.1:5001/api/v0')).toBe(
      'http://127.0.0.1:5001/api/v0/add?pin=true'
    );
    expect(resolveIpfsAddUrl('http://127.0.0.1:5001/api/v0/add')).toBe(
      'http://127.0.0.1:5001/api/v0/add?pin=true'
    );
  });

  it('leaves hosted pin endpoints unchanged', () => {
    const pinata = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
    expect(resolveIpfsAddUrl(pinata)).toBe(pinata);
  });

  it('builds ipfs:// URIs unless a gateway is set', () => {
    expect(buildIpfsUri(TEST_CID)).toBe(`ipfs://${TEST_CID}`);
    process.env.IPFS_GATEWAY_URL = 'https://ipfs.io/ipfs/';
    expect(buildIpfsUri(TEST_CID)).toBe(`https://ipfs.io/ipfs/${TEST_CID}`);
    process.env.IPFS_GATEWAY_URL = 'https://w3s.link/ipfs';
    expect(buildIpfsUri(TEST_CID)).toBe(`https://w3s.link/ipfs/${TEST_CID}`);
  });

  it('sanitizes pin filenames', () => {
    expect(safePinFilename('../secret.md')).toBe('.._secret.md');
    expect(safePinFilename()).toBe('aquarius-charter.md');
  });

  it('pins via mocked Kubo add and returns cid + uri', async () => {
    process.env.IPFS_API_URL = 'http://127.0.0.1:5001';
    process.env.IPFS_PINNING_TOKEN = 'pin-token';

    const fetchMock = vi.fn(async () => Response.json({ Hash: TEST_CID, Size: '32' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await pinMarkdownToIpfs('# Charter');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:5001/api/v0/add?pin=true');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer pin-token'
    );
    expect(init.body).toBeInstanceOf(FormData);
    expect(result).toEqual({ cid: TEST_CID, uri: `ipfs://${TEST_CID}` });
  });

  it('parses Pinata IpfsHash responses', async () => {
    process.env.IPFS_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

    globalThis.fetch = vi.fn(async () =>
      Response.json({ IpfsHash: TEST_CID, PinSize: 32 })
    ) as unknown as typeof fetch;

    const result = await pinMarkdownToIpfs('# Charter');
    expect(result.cid).toBe(TEST_CID);
  });

  it('tryPin returns a warning and null cid when unconfigured', async () => {
    const result = await tryPinMarkdownToIpfs('# Charter');
    expect(result).toEqual({
      cid: null,
      uri: null,
      warning: IPFS_UNCONFIGURED_WARNING,
    });
  });

  it('tryPin swallows pin failures without throwing', async () => {
    process.env.IPFS_API_URL = 'http://127.0.0.1:5001';
    globalThis.fetch = vi.fn(async () =>
      new Response('nope', { status: 502 })
    ) as unknown as typeof fetch;

    const result = await tryPinMarkdownToIpfs('# Charter');
    expect(result.cid).toBeNull();
    expect(result.uri).toBeNull();
    expect(result.warning).toBe(IPFS_PIN_FAILED_WARNING);
  });
});
