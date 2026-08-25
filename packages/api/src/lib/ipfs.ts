/**
 * Optional HTTP IPFS pinning for generated legal documents.
 *
 * Configure with IPFS_API_URL (required to pin) and optional
 * IPFS_PINNING_TOKEN / IPFS_GATEWAY_URL. When unset, callers should
 * treat pinning as skipped — never fail charter generation.
 *
 * Supported endpoints:
 *   - Kubo: http://127.0.0.1:5001  → POST /api/v0/add?pin=true
 *   - Pinata / web3.storage-style HTTP pin URLs (multipart `file` + Bearer token)
 *
 * Document bodies are never logged.
 */

export const IPFS_UNCONFIGURED_WARNING =
  'IPFS pinning is not configured. Set IPFS_API_URL to pin generated charters.';

export const IPFS_PIN_FAILED_WARNING =
  'IPFS pin failed; charter was generated but not pinned.';

const PIN_TIMEOUT_MS = 20_000;
const DEFAULT_FILENAME = 'aquarius-charter.md';

export interface IpfsPinResult {
  cid: string;
  uri: string;
}

export interface OptionalPinResult {
  cid: string | null;
  uri: string | null;
  warning?: string;
}

export function isIpfsConfigured(): boolean {
  return Boolean(process.env.IPFS_API_URL?.trim());
}

/** Sanitize a client-supplied filename; never used in logs of document bodies. */
export function safePinFilename(name?: string): string {
  const raw = name?.trim() || DEFAULT_FILENAME;
  const base = raw.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
  return base || DEFAULT_FILENAME;
}

export function buildIpfsUri(cid: string): string {
  const gateway = process.env.IPFS_GATEWAY_URL?.trim();
  if (!gateway) return `ipfs://${cid}`;
  return gateway.endsWith('/') ? `${gateway}${cid}` : `${gateway}/${cid}`;
}

/**
 * Resolve Kubo `/api/v0/add` when the env URL is a node root or already an add path.
 * Other URLs (Pinata, web3.storage, custom gateways) are used as-is.
 */
export function resolveIpfsAddUrl(apiUrl: string): string {
  const parsed = new URL(apiUrl);
  const path = parsed.pathname.replace(/\/+$/, '') || '/';
  const isKubo = path === '/' || path === '/api/v0' || path === '/api/v0/add';

  if (!isKubo) return apiUrl;

  parsed.pathname = '/api/v0/add';
  if (!parsed.searchParams.has('pin')) {
    parsed.searchParams.set('pin', 'true');
  }
  return parsed.toString();
}

function extractCid(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const candidates = [obj.Hash, obj.IpfsHash, obj.cid, obj.Cid];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export async function pinMarkdownToIpfs(
  markdown: string,
  filename?: string
): Promise<IpfsPinResult> {
  const apiUrl = process.env.IPFS_API_URL?.trim();
  if (!apiUrl) {
    throw new Error('IPFS_API_URL is not configured');
  }

  const url = resolveIpfsAddUrl(apiUrl);
  const token = process.env.IPFS_PINNING_TOKEN?.trim();
  const form = new FormData();
  form.append(
    'file',
    new Blob([markdown], { type: 'text/markdown' }),
    safePinFilename(filename)
  );

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: form,
    signal: AbortSignal.timeout(PIN_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`ipfs pin failed: ${res.status}`);
  }

  const data: unknown = await res.json();
  const cid = extractCid(data);
  if (!cid) {
    throw new Error('ipfs pin failed: missing cid');
  }

  return { cid, uri: buildIpfsUri(cid) };
}

/**
 * Best-effort pin used after generate. Never throws; never logs document text.
 */
export async function tryPinMarkdownToIpfs(
  markdown: string,
  filename?: string
): Promise<OptionalPinResult> {
  if (!isIpfsConfigured()) {
    return {
      cid: null,
      uri: null,
      warning: IPFS_UNCONFIGURED_WARNING,
    };
  }

  try {
    const pinned = await pinMarkdownToIpfs(markdown, filename);
    return { cid: pinned.cid, uri: pinned.uri };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'ipfs pin failed';
    console.warn('[ipfs] pin failed:', message);
    return {
      cid: null,
      uri: null,
      warning: IPFS_PIN_FAILED_WARNING,
    };
  }
}
