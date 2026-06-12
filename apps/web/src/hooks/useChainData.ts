import { useCallback, useEffect, useState } from 'react';
import { useWalletStore } from '../state/walletStore';
import { fetchAllCommunities, fetchEthBalance, fetchProposals } from '../lib/actions';
import type { CommunitySummary, OnChainProposal } from '../lib/types';

/** Central chain-data hook: communities, proposals, balance. */
export function useChainData() {
  const address = useWalletStore((s) => s.address);
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [proposals, setProposals] = useState<OnChainProposal[]>([]);
  const [ethBalance, setEthBalance] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [comms, props, bal] = await Promise.all([
        fetchAllCommunities(address),
        fetchProposals(address).catch(() => [] as OnChainProposal[]),
        address ? fetchEthBalance(address) : Promise.resolve('0'),
      ]);
      setCommunities(comms);
      setProposals(props);
      setEthBalance(bal);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'chain unreachable');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const mine = communities.filter((c) => c.isMember || c.isFounder);

  return { address, communities, mine, proposals, ethBalance, loading, error, refresh };
}
