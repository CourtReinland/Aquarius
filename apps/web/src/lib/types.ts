import type { Address } from 'viem';

/** Domain types — mirrors apps/mobile/src/types/community.ts */

export enum MemberAdmission {
  FoundersOnly = 0,
  FoundersAndMembers = 1,
}

export enum ProposalPermission {
  FoundersOnly = 0,
  FoundersOrMembers = 1,
}

export type CharterTemplate =
  | 'draft-original'
  | 'us-constitution'
  | 'magna-carta'
  | 'blackfeet-tribal';

export interface CommunityWizardState {
  name: string;
  founderCount: 'single' | 'multiple';
  founderAddresses: string[];
  charterTemplate: CharterTemplate;
  charterText: string;
  admissionRule: MemberAdmission;
  exileRule: MemberAdmission;
  votePercentage: number;
  whoMayPropose: ProposalPermission;
  legalFramework: string;
  jurisdiction: string;
  allowCorporateMembers: boolean;
}

export const emptyWizard: CommunityWizardState = {
  name: '',
  founderCount: 'single',
  founderAddresses: [],
  charterTemplate: 'draft-original',
  charterText: '',
  admissionRule: MemberAdmission.FoundersAndMembers,
  exileRule: MemberAdmission.FoundersOnly,
  votePercentage: 51,
  whoMayPropose: ProposalPermission.FoundersOrMembers,
  legalFramework: '',
  jurisdiction: '',
  allowCorporateMembers: false,
};

export interface CommunitySummary {
  address: Address;
  name: string;
  memberCount: number;
  founderCount: number;
  aiAgentCount: number;
  isMember: boolean;
  isFounder: boolean;
  legalFramework: string;
  jurisdiction: string;
  createdAt: number;
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

export interface HistoryEvent {
  text: string;
  stamp: string;
  blockNumber: bigint;
  txHash: string;
}
