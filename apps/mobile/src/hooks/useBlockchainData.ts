import { useState, useEffect, useCallback } from 'react';
import {
  createPublicClient,
  http,
  formatEther,
  type Address,
} from 'viem';
import {
  indexedCommunityMap,
  mergeCommunityAddresses,
  tryLoadIndexedCommunities,
  type CommunityListSource,
  type IndexedCommunity,
} from '../api/indexer';
import { communityAbi, governanceModuleAbi } from '../config/abis';
import { defaultChain, CONTRACT_ADDRESSES } from '../config/chains';
import { getAllCommunities } from './useCommunityFactory';

/**
 * Central hook that fetches wallet-scoped community and governance state.
 * Community addresses prefer the public indexer stub, then fall back to
 * factory `getAllCommunities`. Membership, proposal, and write paths stay on-chain.
 */

const publicClient = createPublicClient({
  chain: defaultChain,
  transport: http(),
});

const contracts = CONTRACT_ADDRESSES[defaultChain.id];

// ─── Types ────────────────────────────────────────────────────────

export interface MyCommunity {
  address: Address;
  name: string;
  isFounder: boolean;
  memberCount: number;
  founderCount: number;
  aiAgentCount: number;
  charterIpfsHash: string;
  legalFramework: string;
  jurisdiction: string;
  createdAt: number;
}

export interface DiscoveredCommunity {
  address: Address;
  name: string;
  memberCount: number;
  isMember: boolean;
}

export interface OnChainProposal {
  id: number;
  title: string;
  proposer: Address;
  communityName: string;
  status: number;
  yesVotes: number;
  noVotes: number;
  totalFunded: bigint;
  startTime: number;
  endTime: number;
  outcomeType: number;
  fundingCostPerYes: bigint;
  hasVoted: boolean;
}

export interface UserProfile {
  address: Address;
  ethBalance: string;
  ethBalanceRaw: bigint;
  communitiesCount: number;
  myCommunities: MyCommunity[];
}

// ─── Main Hook ────────────────────────────────────────────────────

export function useBlockchainData(walletAddress: Address | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myCommunities, setMyCommunities] = useState<MyCommunity[]>([]);
  const [allCommunities, setAllCommunities] = useState<DiscoveredCommunity[]>([]);
  const [proposals, setProposals] = useState<OnChainProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [communityListSource, setCommunityListSource] = useState<CommunityListSource | null>(null);

  const refresh = useCallback(async () => {
    if (!walletAddress) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch ETH balance
      const ethBalance = await publicClient.getBalance({ address: walletAddress });

      // 2. Prefer indexer community list; fall back to factory scan
      const { addresses: allAddresses, indexedByAddress, source } =
        await resolveCommunityAddresses(contracts?.communityFactory ?? null);
      setCommunityListSource(source);

      // 3. For each community, check if user is a member and get details
      const myComms: MyCommunity[] = [];
      const discovered: DiscoveredCommunity[] = [];

      for (const addr of allAddresses) {
        const indexed = indexedByAddress.get(addr.toLowerCase());
        try {
          const [info, isMember, isFounder, memberCount, founderCount, aiAgentCount] = await Promise.all([
            publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'info' }),
            publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'isMember', args: [walletAddress] }),
            publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'isFounder', args: [walletAddress] }),
            publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'getMemberCount' }),
            publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'getFounderCount' }),
            publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'getAIAgentCount' }),
          ]);

          const [name, charterIpfsHash, legalFramework, jurisdiction, , createdAt] = info as [string, string, string, string, boolean, bigint];

          const commData = {
            address: addr,
            name,
            memberCount: Number(memberCount),
            isMember: isMember as boolean,
          };

          if (isMember || isFounder) {
            myComms.push({
              ...commData,
              isFounder: isFounder as boolean,
              founderCount: Number(founderCount),
              aiAgentCount: Number(aiAgentCount),
              charterIpfsHash,
              legalFramework,
              jurisdiction,
              createdAt: Number(createdAt),
            });
          }

          discovered.push(commData);
        } catch (e) {
          console.warn('[Data] Failed to read community', addr, e);
          const fallback = communityFromIndexer(addr, walletAddress, indexed);
          if (fallback) {
            discovered.push(fallback.discovered);
            if (fallback.membership) myComms.push(fallback.membership);
          }
        }
      }

      setMyCommunities(myComms);
      setAllCommunities(discovered);

      // 4. Fetch proposals from GovernanceModule
      if (contracts.governanceModule) {
        const onChainProposals: OnChainProposal[] = [];
        try {
          const nextId = await publicClient.readContract({
            address: contracts.governanceModule!,
            abi: governanceModuleAbi,
            functionName: 'nextProposalId',
          }) as bigint;

          for (let i = 0; i < Number(nextId); i++) {
            try {
              const result = await publicClient.readContract({
                address: contracts.governanceModule!,
                abi: governanceModuleAbi,
                functionName: 'getProposal',
                args: [BigInt(i)],
              });

              const [title, proposer, communityName, status, yesVotes, noVotes, totalFunded, startTime, endTime, outcomeType, fundingCostPerYes] =
                result as [string, Address, string, number, bigint, bigint, bigint, bigint, bigint, number, bigint];

              let hasVoted = false;
              try {
                hasVoted = await publicClient.readContract({
                  address: contracts.governanceModule!,
                  abi: governanceModuleAbi,
                  functionName: 'hasVoted',
                  args: [BigInt(i), walletAddress],
                }) as boolean;
              } catch {}

              onChainProposals.push({
                id: i,
                title,
                proposer,
                communityName,
                status,
                yesVotes: Number(yesVotes),
                noVotes: Number(noVotes),
                totalFunded,
                startTime: Number(startTime),
                endTime: Number(endTime),
                outcomeType,
                fundingCostPerYes,
                hasVoted,
              });
            } catch {}
          }
        } catch (e) {
          console.warn('[Data] No proposals or governance not deployed');
        }
        setProposals(onChainProposals);
      }

      // 5. Set profile
      setProfile({
        address: walletAddress,
        ethBalance: formatEther(ethBalance),
        ethBalanceRaw: ethBalance,
        communitiesCount: myComms.length,
        myCommunities: myComms,
      });

    } catch (e: any) {
      console.error('[Data] Refresh failed:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  // Auto-refresh on wallet change
  useEffect(() => {
    if (walletAddress) refresh();
  }, [walletAddress, refresh]);

  return {
    profile,
    myCommunities,
    allCommunities,
    proposals,
    loading,
    error,
    refresh,
    communityListSource,
  };
}

async function resolveCommunityAddresses(factoryAddress: Address | null): Promise<{
  addresses: Address[];
  indexedByAddress: Map<string, IndexedCommunity>;
  source: CommunityListSource | null;
}> {
  const [indexed, factoryResult] = await Promise.all([
    tryLoadIndexedCommunities(),
    factoryAddress
      ? getAllCommunities(factoryAddress)
          .then((addresses) => ({ addresses, error: null as unknown }))
          .catch((error: unknown) => {
            console.warn('[Data] Factory community list failed', error);
            return { addresses: [] as Address[], error };
          })
      : Promise.resolve({ addresses: [] as Address[], error: null as unknown }),
  ]);
  const factoryAddresses = factoryResult.addresses;
  const factoryError = factoryResult.error;
  const indexedByAddress = indexedCommunityMap(indexed ?? []);

  if (indexed && indexed.length > 0) {
    return {
      addresses: mergeCommunityAddresses(indexed, factoryAddresses),
      indexedByAddress,
      source: factoryAddresses.length > 0 ? 'indexer+chain' : 'indexer',
    };
  }

  if (factoryAddresses.length > 0 || !factoryError) {
    return {
      addresses: factoryAddresses,
      indexedByAddress,
      source: factoryAddresses.length > 0 ? 'chain' : null,
    };
  }

  throw factoryError instanceof Error
    ? factoryError
    : new Error('Community list unavailable from indexer and factory');
}

function communityFromIndexer(
  address: Address,
  walletAddress: Address,
  indexed: IndexedCommunity | undefined
): { discovered: DiscoveredCommunity; membership?: MyCommunity } | null {
  if (!indexed) return null;

  const isFounder = indexed.founders.some(
    (founder) => founder.toLowerCase() === walletAddress.toLowerCase()
  );

  const discovered: DiscoveredCommunity = {
    address,
    name: indexed.name,
    memberCount: indexed.founders.length,
    isMember: isFounder,
  };

  if (!isFounder) return { discovered };

  return {
    discovered,
    membership: {
      ...discovered,
      isFounder: true,
      founderCount: indexed.founders.length,
      aiAgentCount: 0,
      charterIpfsHash: '',
      legalFramework: '',
      jurisdiction: '',
      createdAt: indexed.deployedAtTimestamp ?? 0,
    },
  };
}
