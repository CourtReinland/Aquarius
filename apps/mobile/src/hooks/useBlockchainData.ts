import { useState, useEffect, useCallback } from 'react';
import {
  createPublicClient,
  http,
  formatEther,
  type Address,
} from 'viem';
import { defaultChain, CONTRACT_ADDRESSES } from '../config/chains';
import { communityFactoryAbi, communityAbi, governanceModuleAbi } from '../config/abis';

/**
 * Central hook that fetches all blockchain state relevant to the connected user.
 * No placeholder data — everything comes from the chain.
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

  const refresh = useCallback(async () => {
    if (!walletAddress || !contracts?.communityFactory) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch ETH balance
      const ethBalance = await publicClient.getBalance({ address: walletAddress });

      // 2. Fetch all community addresses from factory
      const allAddresses = await publicClient.readContract({
        address: contracts.communityFactory!,
        abi: communityFactoryAbi,
        functionName: 'getAllCommunities',
      }) as Address[];

      // 3. For each community, check if user is a member and get details
      const myComms: MyCommunity[] = [];
      const discovered: DiscoveredCommunity[] = [];

      for (const addr of allAddresses) {
        try {
          const [info, isMember, isFounder, memberCount, founderCount] = await Promise.all([
            publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'info' }),
            publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'isMember', args: [walletAddress] }),
            publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'isFounder', args: [walletAddress] }),
            publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'getMemberCount' }),
            publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'getFounderCount' }),
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
              charterIpfsHash,
              legalFramework,
              jurisdiction,
              createdAt: Number(createdAt),
            });
          }

          discovered.push(commData);
        } catch (e) {
          console.warn('[Data] Failed to read community', addr, e);
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
  };
}
