import { formatEther, parseEther, parseEventLogs, type Address, type Hash } from 'viem';
import { publicClient, walletClientFor } from './clients';
import { contracts } from './chains';
import { communityFactoryAbi, communityAbi, governanceModuleAbi } from './abis';
import type {
  CommunitySummary,
  CommunityWizardState,
  OnChainProposal,
  HistoryEvent,
} from './types';

/** On-chain reads and writes. Mirrors the mobile hooks, web-side. */

// ─── Communities ──────────────────────────────────────────────────

export async function fetchAllCommunities(
  viewer: Address | null
): Promise<CommunitySummary[]> {
  if (!contracts?.communityFactory) return [];

  const addresses = (await publicClient.readContract({
    address: contracts.communityFactory,
    abi: communityFactoryAbi,
    functionName: 'getAllCommunities',
  })) as Address[];

  const out: CommunitySummary[] = [];
  for (const addr of addresses) {
    try {
      const [info, memberCount, founderCount, aiAgentCount] = await Promise.all([
        publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'info' }),
        publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'getMemberCount' }),
        publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'getFounderCount' }),
        publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'getAIAgentCount' }).catch(() => 0n),
      ]);

      let isMember = false;
      let isFounder = false;
      if (viewer) {
        [isMember, isFounder] = (await Promise.all([
          publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'isMember', args: [viewer] }),
          publicClient.readContract({ address: addr, abi: communityAbi, functionName: 'isFounder', args: [viewer] }),
        ])) as [boolean, boolean];
      }

      const [name, , legalFramework, jurisdiction, , createdAt] = info as [
        string, string, string, string, boolean, bigint
      ];

      out.push({
        address: addr,
        name,
        memberCount: Number(memberCount),
        founderCount: Number(founderCount),
        aiAgentCount: Number(aiAgentCount),
        isMember,
        isFounder,
        legalFramework,
        jurisdiction,
        createdAt: Number(createdAt),
      });
    } catch (e) {
      console.warn('[chain] failed reading community', addr, e);
    }
  }
  return out;
}

export async function fetchEthBalance(addr: Address): Promise<string> {
  const wei = await publicClient.getBalance({ address: addr });
  return formatEther(wei);
}

// ─── Found a community ────────────────────────────────────────────

export interface CreateCommunityResult {
  txHash: Hash;
  communityAddress: Address;
}

export async function createCommunityOnChain(
  privateKey: `0x${string}`,
  wizard: CommunityWizardState
): Promise<CreateCommunityResult> {
  if (!contracts?.communityFactory) throw new Error('CommunityFactory not deployed on this chain');
  const wallet = walletClientFor(privateKey);

  const bylaws = {
    admissionRule: wizard.admissionRule,
    exileRule: wizard.exileRule,
    voteThreshold: 0,
    votePercentage: wizard.votePercentage,
    whoMayPropose: wizard.whoMayPropose,
    requireBuyIn: false,
  };

  const founders =
    wizard.founderAddresses.length > 0
      ? (wizard.founderAddresses as Address[])
      : [wallet.account.address];

  const txHash = await wallet.writeContract({
    address: contracts.communityFactory,
    abi: communityFactoryAbi,
    functionName: 'createCommunity',
    args: [
      wizard.name,
      '', // charter IPFS hash — set post-upload
      founders,
      bylaws,
      wizard.legalFramework || '',
      wizard.jurisdiction || '',
      wizard.allowCorporateMembers,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const deployEvent = receipt.logs.find((log) => log.topics.length > 1);
  const communityAddress = deployEvent?.topics[1]
    ? (`0x${deployEvent.topics[1].slice(26)}` as Address)
    : ('0x0' as Address);

  return { txHash, communityAddress };
}

// ─── Proposals ────────────────────────────────────────────────────

export async function fetchProposals(viewer: Address | null): Promise<OnChainProposal[]> {
  if (!contracts?.governanceModule) return [];
  const out: OnChainProposal[] = [];

  const nextId = (await publicClient.readContract({
    address: contracts.governanceModule,
    abi: governanceModuleAbi,
    functionName: 'nextProposalId',
  })) as bigint;

  for (let i = 0; i < Number(nextId); i++) {
    try {
      const result = await publicClient.readContract({
        address: contracts.governanceModule,
        abi: governanceModuleAbi,
        functionName: 'getProposal',
        args: [BigInt(i)],
      });
      const [title, proposer, communityName, status, yesVotes, noVotes, totalFunded, startTime, endTime, outcomeType, fundingCostPerYes] =
        result as [string, Address, string, number, bigint, bigint, bigint, bigint, bigint, number, bigint];

      let hasVoted = false;
      if (viewer) {
        hasVoted = (await publicClient
          .readContract({
            address: contracts.governanceModule,
            abi: governanceModuleAbi,
            functionName: 'hasVoted',
            args: [BigInt(i), viewer],
          })
          .catch(() => false)) as boolean;
      }

      out.push({
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
    } catch {
      /* proposal gap — skip */
    }
  }
  return out.reverse();
}

export async function castVote(
  privateKey: `0x${string}`,
  proposalId: number,
  support: boolean,
  fundingEth: string
): Promise<Hash> {
  if (!contracts?.governanceModule) throw new Error('Governance not deployed');
  const wallet = walletClientFor(privateKey);
  const txHash = await wallet.writeContract({
    address: contracts.governanceModule,
    abi: governanceModuleAbi,
    functionName: 'castVote',
    args: [BigInt(proposalId), support],
    value: support && fundingEth ? parseEther(fundingEth) : 0n,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function createProposal(
  privateKey: `0x${string}`,
  communityAddress: Address,
  title: string,
  description: string,
  durationSeconds: number,
  fundingCostPerYesEth: string,
  quorumPercentage = 51
): Promise<Hash> {
  if (!contracts?.governanceModule) throw new Error('Governance not deployed');
  const wallet = walletClientFor(privateKey);
  const txHash = await wallet.writeContract({
    address: contracts.governanceModule,
    abi: governanceModuleAbi,
    functionName: 'createProposal',
    args: [
      communityAddress,
      title,
      description,            // _descriptionIpfsHash (plain text for MVP)
      0,                       // _quorumType: simple majority of votes cast
      quorumPercentage,        // _quorumPercentage
      0n,                      // _minimumVoters
      BigInt(durationSeconds), // _durationSeconds
      0,                       // _outcomeType: generic
      parseEther(fundingCostPerYesEth || '0'), // _fundingCostPerYes
      0n,                      // _fundingThreshold
      '',                      // _institutionName
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function finalizeProposal(
  privateKey: `0x${string}`,
  proposalId: number
): Promise<Hash> {
  if (!contracts?.governanceModule) throw new Error('Governance not deployed');
  const wallet = walletClientFor(privateKey);
  const txHash = await wallet.writeContract({
    address: contracts.governanceModule,
    abi: governanceModuleAbi,
    functionName: 'finalizeProposal',
    args: [BigInt(proposalId)],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

// ─── Histories (chain events → terminal log) ──────────────────────

export async function fetchCommunityHistory(addr: Address): Promise<HistoryEvent[]> {
  const raw = await publicClient.getLogs({
    address: addr,
    fromBlock: 0n,
    toBlock: 'latest',
  });

  const decoded = parseEventLogs({ abi: communityAbi, logs: raw, strict: false });

  const events: HistoryEvent[] = [];
  const blockCache = new Map<bigint, string>();

  for (const log of decoded) {
    let stamp = blockCache.get(log.blockNumber!);
    if (!stamp) {
      const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
      const d = new Date(Number(block.timestamp) * 1000);
      stamp = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(2)} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      blockCache.set(log.blockNumber!, stamp);
    }
    events.push({
      text: describeEvent(log.eventName, log.args as Record<string, unknown>),
      stamp,
      blockNumber: log.blockNumber!,
      txHash: log.transactionHash ?? '',
    });
  }
  return events;
}

function describeEvent(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'CommunityCreated':
      return `Community '${args.name}' was created by founder(s)`;
    case 'MemberAdded':
      return `New member ${shortHex(args.member)} was admitted by a vote of the members`;
    case 'MemberRemoved':
      return `Member ${shortHex(args.member)} was exiled by community vote`;
    case 'CharterUpdated':
      return 'Community charter was approved and recorded';
    case 'BylawsUpdated':
      return 'Community bylaws were amended';
    case 'AIAgentRegistered':
      return `AI agent '${args.agentId}' joined the community registry`;
    case 'AIAgentDeactivated':
      return `AI agent ${shortHex(args.agentAddress)} was deactivated`;
    default:
      return `${name} recorded on-chain`;
  }
}

function shortHex(v: unknown): string {
  const s = String(v ?? '');
  return s.startsWith('0x') && s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}
