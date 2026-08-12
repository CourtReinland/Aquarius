import {
  type Address,
  type Hash,
} from 'viem';
import { defaultChain } from '../config/chains';
import { allianceModuleAbi } from '../config/abis';
import { getPublicClient, getWalletClient } from '../wallet/signer';

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
  const publicClient = await getPublicClient();
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
  const publicClient = await getPublicClient();
  return publicClient.readContract({
    address: allianceAddress,
    abi: allianceModuleAbi,
    functionName: 'isAllied',
    args: [communityA, communityB],
  }) as Promise<boolean>;
}

export async function acceptAlliance(
  allianceAddress: Address,
  allianceId: bigint
): Promise<Hash> {
  const walletClient = await getWalletClient();
  const publicClient = await getPublicClient();

  const txHash = await walletClient.writeContract({
    address: allianceAddress,
    abi: allianceModuleAbi,
    functionName: 'acceptAlliance',
    args: [allianceId],
    chain: defaultChain,
    account: walletClient.account,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function declineAlliance(
  allianceAddress: Address,
  allianceId: bigint
): Promise<Hash> {
  const walletClient = await getWalletClient();
  const publicClient = await getPublicClient();

  const txHash = await walletClient.writeContract({
    address: allianceAddress,
    abi: allianceModuleAbi,
    functionName: 'declineAlliance',
    args: [allianceId],
    chain: defaultChain,
    account: walletClient.account,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}
