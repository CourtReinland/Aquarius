import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { governanceModuleAbi } from '../config/abis';

/**
 * Hooks for interacting with the GovernanceModule contract.
 */

const chain = baseSepolia;
const publicClient = createPublicClient({ chain, transport: http() });

// ─── Types ────────────────────────────────────────────────────────

export interface ProposalData {
  title: string;
  proposer: Address;
  communityName: string;
  status: number; // 0=Active, 1=Passed, 2=Failed, 3=Executed, 4=Cancelled
  yesVotes: bigint;
  noVotes: bigint;
  totalFunded: bigint;
  startTime: bigint;
  endTime: bigint;
  outcomeType: number;
  fundingCostPerYes: bigint;
}

export type ProposalStatus = 'Active' | 'Passed' | 'Failed' | 'Executed' | 'Cancelled';

const STATUS_MAP: Record<number, ProposalStatus> = {
  0: 'Active',
  1: 'Passed',
  2: 'Failed',
  3: 'Executed',
  4: 'Cancelled',
};

export function statusLabel(status: number): ProposalStatus {
  return STATUS_MAP[status] ?? 'Active';
}

// ─── Read Functions ───────────────────────────────────────────────

export async function getProposal(
  governanceAddress: Address,
  proposalId: bigint
): Promise<ProposalData> {
  const result = await publicClient.readContract({
    address: governanceAddress,
    abi: governanceModuleAbi,
    functionName: 'getProposal',
    args: [proposalId],
  });

  const [
    title, proposer, communityName, status,
    yesVotes, noVotes, totalFunded,
    startTime, endTime, outcomeType, fundingCostPerYes,
  ] = result as [string, Address, string, number, bigint, bigint, bigint, bigint, bigint, number, bigint];

  return {
    title, proposer, communityName, status,
    yesVotes, noVotes, totalFunded,
    startTime, endTime, outcomeType, fundingCostPerYes,
  };
}

export async function getTimeRemaining(
  governanceAddress: Address,
  proposalId: bigint
): Promise<bigint> {
  return publicClient.readContract({
    address: governanceAddress,
    abi: governanceModuleAbi,
    functionName: 'getTimeRemaining',
    args: [proposalId],
  }) as Promise<bigint>;
}

export async function hasVoted(
  governanceAddress: Address,
  proposalId: bigint,
  voter: Address
): Promise<boolean> {
  return publicClient.readContract({
    address: governanceAddress,
    abi: governanceModuleAbi,
    functionName: 'hasVoted',
    args: [proposalId, voter],
  }) as Promise<boolean>;
}

export async function getYesVoters(
  governanceAddress: Address,
  proposalId: bigint
): Promise<Address[]> {
  return publicClient.readContract({
    address: governanceAddress,
    abi: governanceModuleAbi,
    functionName: 'getYesVoters',
    args: [proposalId],
  }) as Promise<Address[]>;
}

// ─── Write Functions ──────────────────────────────────────────────

export async function createProposal(
  privateKey: `0x${string}`,
  governanceAddress: Address,
  params: {
    communityAddress: Address;
    title: string;
    descriptionIpfsHash: string;
    quorumType: number;
    quorumPercentage: number;
    minimumVoters: number;
    durationSeconds: number;
    outcomeType: number;
    fundingCostPerYesEth: string;
    fundingThresholdEth: string;
    institutionName: string;
  }
): Promise<{ txHash: Hash; proposalId: bigint }> {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http() });

  const txHash = await walletClient.writeContract({
    address: governanceAddress,
    abi: governanceModuleAbi,
    functionName: 'createProposal',
    args: [
      params.communityAddress,
      params.title,
      params.descriptionIpfsHash,
      params.quorumType,
      params.quorumPercentage,
      BigInt(params.minimumVoters),
      BigInt(params.durationSeconds),
      params.outcomeType,
      parseEther(params.fundingCostPerYesEth || '0'),
      parseEther(params.fundingThresholdEth || '0'),
      params.institutionName,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Parse ProposalCreated event to get proposal ID
  // For now return 0n as placeholder — event parsing will be refined
  return { txHash, proposalId: 0n };
}

export async function castVote(
  privateKey: `0x${string}`,
  governanceAddress: Address,
  proposalId: bigint,
  support: boolean,
  fundingAmountEth?: string
): Promise<Hash> {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http() });

  const value = fundingAmountEth ? parseEther(fundingAmountEth) : 0n;

  const txHash = await walletClient.writeContract({
    address: governanceAddress,
    abi: governanceModuleAbi,
    functionName: 'castVote',
    args: [proposalId, support],
    value,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function finalizeProposal(
  privateKey: `0x${string}`,
  governanceAddress: Address,
  proposalId: bigint
): Promise<Hash> {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http() });

  const txHash = await walletClient.writeContract({
    address: governanceAddress,
    abi: governanceModuleAbi,
    functionName: 'finalizeProposal',
    args: [proposalId],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}
