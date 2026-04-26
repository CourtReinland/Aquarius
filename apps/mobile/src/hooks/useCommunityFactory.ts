import { useMemo } from 'react';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defaultChain } from '../config/chains';
import { communityFactoryAbi } from '../config/abis';
import { CONTRACT_ADDRESSES } from '../config/chains';
import type { CommunityWizardState } from '../types/community';

/**
 * Hook to interact with the CommunityFactory contract.
 *
 * For the MVP, we use a local private key approach.
 * This will be replaced with wagmi's useWriteContract
 * once WalletConnect/Privy is integrated.
 */

const chain = defaultChain;

const publicClient = createPublicClient({
  chain,
  transport: http(),
});

interface CreateCommunityResult {
  txHash: Hash;
  communityAddress: Address;
}

/**
 * Deploy a new community to the blockchain.
 */
export async function createCommunityOnChain(
  privateKey: `0x${string}`,
  factoryAddress: Address,
  wizard: CommunityWizardState
): Promise<CreateCommunityResult> {
  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(),
  });

  // Map wizard state to contract parameters
  const bylaws = {
    admissionRule: wizard.admissionRule,
    exileRule: wizard.exileRule,
    voteThreshold: 0, // Majority by default
    votePercentage: wizard.votePercentage,
    whoMayPropose: wizard.whoMayPropose,
    requireBuyIn: false,
  };

  const founders =
    wizard.founderAddresses.length > 0
      ? (wizard.founderAddresses as Address[])
      : [account.address];

  // Send the transaction
  const txHash = await walletClient.writeContract({
    address: factoryAddress,
    abi: communityFactoryAbi,
    functionName: 'createCommunity',
    args: [
      wizard.name,
      '', // charterIpfsHash - will be set after IPFS upload
      founders,
      bylaws,
      wizard.legalFramework || '',
      wizard.jurisdiction || '',
      wizard.allowCorporateMembers,
    ],
  });

  // Wait for transaction receipt
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  // Extract the community address from the CommunityDeployed event
  // The event signature: CommunityDeployed(address indexed communityAddress, string name, address[] founders, uint256 timestamp)
  const deployEvent = receipt.logs.find((log) => {
    // CommunityDeployed event topic
    return log.topics.length > 1;
  });

  const communityAddress = deployEvent?.topics[1]
    ? (`0x${deployEvent.topics[1].slice(26)}` as Address)
    : ('0x0' as Address);

  return { txHash, communityAddress };
}

/**
 * Read the total number of communities from the factory.
 */
export async function getCommunityCount(
  factoryAddress: Address
): Promise<bigint> {
  return publicClient.readContract({
    address: factoryAddress,
    abi: communityFactoryAbi,
    functionName: 'getCommunityCount',
  });
}

/**
 * Read all community addresses from the factory.
 */
export async function getAllCommunities(
  factoryAddress: Address
): Promise<Address[]> {
  return publicClient.readContract({
    address: factoryAddress,
    abi: communityFactoryAbi,
    functionName: 'getAllCommunities',
  }) as Promise<Address[]>;
}

/**
 * Read communities founded by a specific address.
 */
export async function getFounderCommunities(
  factoryAddress: Address,
  founder: Address
): Promise<Address[]> {
  return publicClient.readContract({
    address: factoryAddress,
    abi: communityFactoryAbi,
    functionName: 'getFounderCommunities',
    args: [founder],
  }) as Promise<Address[]>;
}
