import { useCallback, useState } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import { API_BASE } from '../config/api';
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

export function useWalletAuth() {
  const { setSession, linkWallet } = useWalletStore();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithPrivateKey = useCallback(
    async (privateKey: `0x${string}`, address: `0x${string}`, chainId: number) => {
      setIsSigningIn(true);
      setError(null);

      try {
        const account = privateKeyToAccount(privateKey);
        if (account.address.toLowerCase() !== address.toLowerCase()) {
          throw new Error('Private key does not match connected wallet');
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
        const signature = await account.signMessage({ message: challenge.message });

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
    signInWithPrivateKey,
    isSigningIn,
    error,
  };
}
