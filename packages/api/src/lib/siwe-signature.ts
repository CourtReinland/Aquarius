import {
  createPublicClient,
  hashMessage,
  http,
  verifyMessage,
  type Address,
  type Hex,
} from 'viem';

/** ERC-1271 magic value: `bytes4(keccak256("isValidSignature(bytes32,bytes)"))`. */
export const ERC1271_MAGICVALUE = '0x1626ba7e' as const;

export const erc1271Abi = [
  {
    name: 'isValidSignature',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'magicValue', type: 'bytes4' }],
  },
] as const;

/**
 * Minimal public-client surface for SIWE verification.
 * Real `createPublicClient` instances satisfy this; tests inject a mock.
 */
export type SignaturePublicClient = {
  getCode: (args: { address: Address }) => Promise<Hex | undefined>;
  readContract: (args: {
    address: Address;
    abi: typeof erc1271Abi;
    functionName: 'isValidSignature';
    args: readonly [Hex, Hex];
  }) => Promise<Hex>;
};

export type SignatureVerifyResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string; message?: string };

/** `undefined` = use env RPC; `null` = force no client (even if env is set). */
let testClient: SignaturePublicClient | null | undefined;

export function __setSignaturePublicClientForTests(
  client: SignaturePublicClient | null | undefined
) {
  testClient = client;
}

export function __resetSignaturePublicClientForTests() {
  testClient = undefined;
}

export function resolveAuthRpcUrl(): string | undefined {
  const url = process.env.AQUARIUS_RPC_URL?.trim() || process.env.RPC_URL?.trim();
  return url || undefined;
}

export function getSignaturePublicClient(): SignaturePublicClient | null {
  if (testClient !== undefined) {
    return testClient;
  }

  const rpcUrl = resolveAuthRpcUrl();
  if (!rpcUrl) return null;
  return createPublicClient({ transport: http(rpcUrl) });
}

function hasContractCode(code: Hex | undefined): boolean {
  return Boolean(code && code !== '0x');
}

function isErc1271Magic(value: unknown): boolean {
  return typeof value === 'string' && value.toLowerCase().startsWith(ERC1271_MAGICVALUE);
}

function looksLikeRpcTransportError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /fetch|network|econnrefused|etimedout|timeout|socket|rpc unavailable/i.test(text);
}

/**
 * Verify a SIWE-style personal_sign for EOAs and ERC-1271 contract wallets.
 *
 * EOA `viem.verifyMessage` needs no RPC. Contract wallets call
 * `isValidSignature(hashMessage(message), signature)` and must return `0x1626ba7e`.
 * That path requires `AQUARIUS_RPC_URL` or `RPC_URL` (or a test-injected client).
 */
export async function verifyWalletSignature(params: {
  address: Address;
  message: string;
  signature: Hex;
}): Promise<SignatureVerifyResult> {
  const { address, message, signature } = params;

  try {
    const eoaValid = await verifyMessage({ address, message, signature });
    if (eoaValid) return { ok: true };
  } catch {
    // Recovery failed — may still be a contract wallet.
  }

  const client = getSignaturePublicClient();
  if (!client) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid signature',
      message:
        'Not a valid EOA personal_sign. Smart-contract wallets require AQUARIUS_RPC_URL or RPC_URL for ERC-1271 verification.',
    };
  }

  let code: Hex | undefined;
  try {
    code = await client.getCode({ address });
  } catch {
    return {
      ok: false,
      status: 503,
      error: 'RPC unavailable',
      message:
        'Could not reach the configured RPC to check whether this address is an ERC-1271 contract wallet. Check AQUARIUS_RPC_URL or RPC_URL.',
    };
  }

  if (!hasContractCode(code)) {
    return { ok: false, status: 401, error: 'Invalid signature' };
  }

  try {
    const hash = hashMessage(message);
    const magic = await client.readContract({
      address,
      abi: erc1271Abi,
      functionName: 'isValidSignature',
      args: [hash, signature],
    });

    if (isErc1271Magic(magic)) return { ok: true };
    return { ok: false, status: 401, error: 'Invalid signature' };
  } catch (error) {
    if (looksLikeRpcTransportError(error)) {
      return {
        ok: false,
        status: 503,
        error: 'RPC unavailable',
        message:
          'Could not reach the configured RPC to verify an ERC-1271 smart-contract wallet signature. Check AQUARIUS_RPC_URL or RPC_URL.',
      };
    }
    return { ok: false, status: 401, error: 'Invalid signature' };
  }
}
