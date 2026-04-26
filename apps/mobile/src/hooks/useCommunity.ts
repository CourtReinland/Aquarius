import {
  createPublicClient,
  http,
  type Address,
} from 'viem';
import { defaultChain } from '../config/chains';
import { communityAbi } from '../config/abis';

/**
 * Hook to read data from a specific Community contract.
 */

const publicClient = createPublicClient({
  chain: defaultChain,
  transport: http(),
});

export interface CommunityData {
  name: string;
  charterIpfsHash: string;
  legalFramework: string;
  jurisdiction: string;
  allowCorporateMembers: boolean;
  createdAt: bigint;
  founders: Address[];
  memberCount: bigint;
  founderCount: bigint;
  isMember: boolean;
}

/**
 * Fetch all community data from on-chain.
 */
export async function fetchCommunityData(
  communityAddress: Address,
  userAddress?: Address
): Promise<CommunityData> {
  const [info, founders, memberCount, founderCount] = await Promise.all([
    publicClient.readContract({
      address: communityAddress,
      abi: communityAbi,
      functionName: 'info',
    }),
    publicClient.readContract({
      address: communityAddress,
      abi: communityAbi,
      functionName: 'getFounders',
    }),
    publicClient.readContract({
      address: communityAddress,
      abi: communityAbi,
      functionName: 'getMemberCount',
    }),
    publicClient.readContract({
      address: communityAddress,
      abi: communityAbi,
      functionName: 'getFounderCount',
    }),
  ]);

  let isMember = false;
  if (userAddress) {
    isMember = (await publicClient.readContract({
      address: communityAddress,
      abi: communityAbi,
      functionName: 'isMember',
      args: [userAddress],
    })) as boolean;
  }

  // info returns a tuple: (name, charterIpfsHash, legalFramework, jurisdiction, allowCorporateMembers, createdAt)
  const [name, charterIpfsHash, legalFramework, jurisdiction, allowCorporateMembers, createdAt] =
    info as [string, string, string, string, boolean, bigint];

  return {
    name,
    charterIpfsHash,
    legalFramework,
    jurisdiction,
    allowCorporateMembers,
    createdAt,
    founders: founders as Address[],
    memberCount: memberCount as bigint,
    founderCount: founderCount as bigint,
    isMember,
  };
}
