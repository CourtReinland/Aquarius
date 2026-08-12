import { useCallback, useState } from 'react';
import { API_BASE } from '../config/api';
import { getWalletClient } from '../wallet/signer';
import { useWalletStore, type WalletSession } from './useWalletStore';

interface ChallengeResponse {
  success: true;
  challenge: {
    address: `0x${string}`;
    chainId: number;
    nonce: string;
    message: string;
    issuedAt: string;
    expirationTime: string;
  };
}

interface VerifyResponse {
  success: true;
  session: WalletSession;
}

/**
 * SIWE challenge/verify against the same wallet that signs transactions.
 */
export function useWalletAuth() {
  const { setSession, linkWallet } = useWalletStore();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithConnectedWallet = useCallback(
    async (address: `0x${string}`, chainId: number) => {
      setIsSigningIn(true);
      setError(null);

      try {
        const walletClient = await getWalletClient();
        const signerAddress = walletClient.account.address;
        if (signerAddress.toLowerCase() !== address.toLowerCase()) {
          throw new Error('Connected signing key does not match wallet address');
        }

        const challengeResponse = await fetch(`${API_BASE}/api/auth/challenge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            chainId,
            domain: 'Aquarius',
            uri: 'https://aquariusapp.eth',
          }),
        });
        const challengeResult = await challengeResponse.json();

        if (!challengeResponse.ok || !challengeResult.success) {
          throw new Error(challengeResult.error || `HTTP ${challengeResponse.status}`);
        }

        const { challenge } = challengeResult as ChallengeResponse;
        const signature = await walletClient.signMessage({
          account: walletClient.account,
          message: challenge.message,
        });

        const verifyResponse = await fetch(`${API_BASE}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: challenge.message,
            signature,
          }),
        });
        const verifyResult = await verifyResponse.json();

        if (!verifyResponse.ok || !verifyResult.success) {
          throw new Error(verifyResult.error || `HTTP ${verifyResponse.status}`);
        }

        const { session } = verifyResult as VerifyResponse;
        setSession(session);
        linkWallet({
          address: session.address,
          chainId: session.chainId,
          label: 'Primary wallet',
          lastSignedInAt: new Date().toISOString(),
        });

        return session;
      } catch (err: any) {
        const message = err?.message ?? 'Wallet sign-in failed';
        setError(message);
        setSession(null);
        return null;
      } finally {
        setIsSigningIn(false);
      }
    },
    [linkWallet, setSession]
  );

  return {
    signInWithConnectedWallet,
    isSigningIn,
    error,
  };
}
