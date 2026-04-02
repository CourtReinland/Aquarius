/**
 * Core domain types matching the Aquarius mind map and smart contracts.
 */

export enum MemberAdmission {
  FoundersOnly = 0,
  FoundersAndMembers = 1,
}

export enum VoteThreshold {
  Majority = 0,
  Supermajority = 1,
  MinimumMembers = 2,
}

export enum ProposalPermission {
  FoundersOnly = 0,
  FoundersOrMembers = 1,
}

export interface Bylaws {
  admissionRule: MemberAdmission;
  exileRule: MemberAdmission;
  voteThreshold: VoteThreshold;
  votePercentage: number; // 51-100
  whoMayPropose: ProposalPermission;
  requireBuyIn: boolean;
}

export interface CommunityInfo {
  name: string;
  charterIpfsHash: string;
  legalFramework: string;
  jurisdiction: string;
  allowCorporateMembers: boolean;
  createdAt: number;
}

export interface Community {
  address: string;
  info: CommunityInfo;
  bylaws: Bylaws;
  founders: string[];
  memberCount: number;
}

export type CharterTemplate =
  | 'draft-original'
  | 'us-constitution'
  | 'magna-carta'
  | 'blackfeet-tribal';

export type BankingStyle = 'austrian-strict' | 'keynesian-fractional';

export interface BankingConfig {
  startingTokenAmount: number;
  bankingStyle: BankingStyle;
  allowArbitraryTokenCreation: boolean;
  allowFractionalLending: boolean;
  leverageRatio: number; // 1-9
}

/**
 * Wizard state for the 3-step community creation flow.
 * Step 1: Name, founders, charter template
 * Step 2: Bylaws (admission, exile, voting rules)
 * Step 3: Legal nesting (legal framework, jurisdiction, member types)
 */
export interface CommunityWizardState {
  // Step 1
  name: string;
  founderCount: 'single' | 'multiple';
  founderAddresses: string[];
  charterTemplate: CharterTemplate;
  charterText: string;

  // Step 2
  admissionRule: MemberAdmission;
  exileRule: MemberAdmission;
  votePercentage: number;
  whoMayPropose: ProposalPermission;

  // Step 3
  legalFramework: string;
  jurisdiction: string;
  allowCorporateMembers: boolean;
}
