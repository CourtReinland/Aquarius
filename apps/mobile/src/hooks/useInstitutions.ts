import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { institutionRegistryAbi } from '../config/abis';

const chain = baseSepolia;
const publicClient = createPublicClient({ chain, transport: http() });

// ─── Types ────────────────────────────────────────────────────────

export interface InstitutionData {
  name: string;
  community: Address;
  totalShares: bigint;
  paysDividends: boolean;
  active: boolean;
  yearlyRevenue: bigint;
  createdAt: bigint;
}

export interface PositionData {
  institutionId: bigint;
  title: string;
  responsibilities: string;
  tokenRewardPerDay: bigint;
  shareGrant: bigint;
  holder: Address;
  active: boolean;
}

// ─── Read ─────────────────────────────────────────────────────────

export async function getInstitution(
  registryAddress: Address,
  institutionId: bigint
): Promise<InstitutionData> {
  const result = await publicClient.readContract({
    address: registryAddress,
    abi: institutionRegistryAbi,
    functionName: 'getInstitution',
    args: [institutionId],
  });
  const [name, community, totalShares, paysDividends, active, yearlyRevenue, createdAt] =
    result as [string, Address, bigint, boolean, boolean, bigint, bigint];
  return { name, community, totalShares, paysDividends, active, yearlyRevenue, createdAt };
}

export async function getPosition(
  registryAddress: Address,
  positionId: bigint
): Promise<PositionData> {
  const result = await publicClient.readContract({
    address: registryAddress,
    abi: institutionRegistryAbi,
    functionName: 'getPosition',
    args: [positionId],
  });
  const [institutionId, title, responsibilities, tokenRewardPerDay, shareGrant, holder, active] =
    result as [bigint, string, string, bigint, bigint, Address, boolean];
  return { institutionId, title, responsibilities, tokenRewardPerDay, shareGrant, holder, active };
}

export async function getCommunityInstitutions(
  registryAddress: Address,
  community: Address
): Promise<bigint[]> {
  return publicClient.readContract({
    address: registryAddress,
    abi: institutionRegistryAbi,
    functionName: 'getCommunityInstitutions',
    args: [community],
  }) as Promise<bigint[]>;
}

export async function getMemberShares(
  registryAddress: Address,
  institutionId: bigint,
  member: Address
): Promise<bigint> {
  return publicClient.readContract({
    address: registryAddress,
    abi: institutionRegistryAbi,
    functionName: 'getMemberShares',
    args: [institutionId, member],
  }) as Promise<bigint>;
}

// ─── Write ────────────────────────────────────────────────────────

export async function acceptPosition(
  privateKey: `0x${string}`,
  registryAddress: Address,
  positionId: bigint
): Promise<Hash> {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http() });

  const txHash = await walletClient.writeContract({
    address: registryAddress,
    abi: institutionRegistryAbi,
    functionName: 'acceptPosition',
    args: [positionId],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function declinePosition(
  privateKey: `0x${string}`,
  registryAddress: Address,
  positionId: bigint
): Promise<Hash> {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http() });

  const txHash = await walletClient.writeContract({
    address: registryAddress,
    abi: institutionRegistryAbi,
    functionName: 'declinePosition',
    args: [positionId],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function vacatePosition(
  privateKey: `0x${string}`,
  registryAddress: Address,
  positionId: bigint
): Promise<Hash> {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http() });

  const txHash = await walletClient.writeContract({
    address: registryAddress,
    abi: institutionRegistryAbi,
    functionName: 'vacatePosition',
    args: [positionId],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}
