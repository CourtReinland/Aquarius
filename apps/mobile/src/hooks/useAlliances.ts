import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { allianceModuleAbi } from '../config/abis';

const chain = baseSepolia;
const publicClient = createPublicClient({ chain, transport: http() });

export interface AllianceData {
  communityA: Address;
  communityB: Address;
  status: number; // 0=Proposed, 1=Active, 2=Dissolved
  tokenGrantPerMember: bigint;
  freeTravel: boolean;
  votingRights: boolean;
}

export async function getAlliance(
  allianceAddress: Address,
  allianceId: bigint
): Promise<AllianceData> {
  const result = await publicClient.readContract({
    address: allianceAddress,
    abi: allianceModuleAbi,
    functionName: 'getAlliance',
    args: [allianceId],
  });
  const [communityA, communityB, status, tokenGrantPerMember, freeTravel, votingRights] =
    result as [Address, Address, number, bigint, boolean, boolean];
  return { communityA, communityB, status, tokenGrantPerMember, freeTravel, votingRights };
}

export async function isAllied(
  allianceAddress: Address,
  communityA: Address,
  communityB: Address
): Promise<boolean> {
  return publicClient.readContract({
    address: allianceAddress,
    abi: allianceModuleAbi,
    functionName: 'isAllied',
    args: [communityA, communityB],
  }) as Promise<boolean>;
}

export async function acceptAlliance(
  privateKey: `0x${string}`,
  allianceAddress: Address,
  allianceId: bigint
): Promise<Hash> {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http() });

  const txHash = await walletClient.writeContract({
    address: allianceAddress,
    abi: allianceModuleAbi,
    functionName: 'acceptAlliance',
    args: [allianceId],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function declineAlliance(
  privateKey: `0x${string}`,
  allianceAddress: Address,
  allianceId: bigint
): Promise<Hash> {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http() });

  const txHash = await walletClient.writeContract({
    address: allianceAddress,
    abi: allianceModuleAbi,
    functionName: 'declineAlliance',
    args: [allianceId],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}
