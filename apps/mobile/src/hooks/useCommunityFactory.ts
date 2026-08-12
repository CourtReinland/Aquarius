import {
  type Address,
  type Hash,
} from 'viem';
import { defaultChain } from '../config/chains';
import { communityFactoryAbi } from '../config/abis';
import type { CommunityWizardState } from '../types/community';
import { getPublicClient, getWalletClient } from '../wallet/signer';

/**
 * CommunityFactory interactions.
 * Writes go through getWalletClient() — the connected wallet signs.
 */

interface CreateCommunityResult {
  txHash: Hash;
  communityAddress: Address;
}

/**
 * Deploy a new community to the blockchain.
 */
export async function createCommunityOnChain(
  factoryAddress: Address,
  wizard: CommunityWizardState
): Promise<CreateCommunityResult> {
  const walletClient = await getWalletClient();
  const publicClient = await getPublicClient();
  const account = walletClient.account;

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
    chain: defaultChain,
    account,
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
  const publicClient = await getPublicClient();
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
  const publicClient = await getPublicClient();
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
  const publicClient = await getPublicClient();
  return publicClient.readContract({
    address: factoryAddress,
    abi: communityFactoryAbi,
    functionName: 'getFounderCommunities',
    args: [founder],
  }) as Promise<Address[]>;
}
