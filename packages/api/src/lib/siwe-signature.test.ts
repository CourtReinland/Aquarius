import { afterEach, describe, expect, it } from 'vitest';
import { getAddress, hashMessage, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  ERC1271_MAGICVALUE,
  verifyWalletSignature,
  __resetSignaturePublicClientForTests,
  __setSignaturePublicClientForTests,
} from './siwe-signature.js';

const contractAddress = getAddress('0x1111111111111111111111111111111111111111');
const dummySignature = `0x${'ab'.repeat(65)}` as Hex;

afterEach(() => {
  __resetSignaturePublicClientForTests();
  delete process.env.AQUARIUS_RPC_URL;
  delete process.env.RPC_URL;
});

describe('verifyWalletSignature', () => {
  it('accepts a valid EOA personal_sign without RPC', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const message = 'Aquarius SIWE EOA';
    const signature = await account.signMessage({ message });

    const result = await verifyWalletSignature({
      address: account.address,
      message,
      signature,
    });

    expect(result).toEqual({ ok: true });
  });

  it('accepts ERC-1271 when isValidSignature returns the magic value', async () => {
    const message = 'Aquarius SIWE 1271';
    let seenHash: Hex | undefined;

    __setSignaturePublicClientForTests({
      async getCode() {
        return '0x6080604052';
      },
      async readContract({ args }) {
        seenHash = args[0];
        return ERC1271_MAGICVALUE;
      },
    });

    const result = await verifyWalletSignature({
      address: contractAddress,
      message,
      signature: dummySignature,
    });

    expect(result).toEqual({ ok: true });
    expect(seenHash).toBe(hashMessage(message));
  });

  it('rejects ERC-1271 when isValidSignature returns a non-magic value', async () => {
    __setSignaturePublicClientForTests({
      async getCode() {
        return '0x6080604052';
      },
      async readContract() {
        return '0xffffffff';
      },
    });

    const result = await verifyWalletSignature({
      address: contractAddress,
      message: 'Aquarius SIWE 1271 fail',
      signature: dummySignature,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe('Invalid signature');
    }
  });

  it('returns 401 with an RPC hint when EOA verify fails and no client is configured', async () => {
    const result = await verifyWalletSignature({
      address: contractAddress,
      message: 'no rpc',
      signature: dummySignature,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe('Invalid signature');
      expect(result.message).toMatch(/AQUARIUS_RPC_URL|RPC_URL/);
    }
  });
});
