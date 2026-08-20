/**
 * Event ABIs for the indexer stub.
 * Names and args match packages/contracts/src (not a full contract ABI).
 */

export const communityFactoryEventsAbi = [
  {
    type: 'event',
    name: 'CommunityDeployed',
    inputs: [
      { name: 'communityAddress', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'founders', type: 'address[]', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const communityEventsAbi = [
  {
    type: 'event',
    name: 'CommunityCreated',
    inputs: [
      { name: 'name', type: 'string', indexed: false },
      { name: 'founders', type: 'address[]', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MemberAdded',
    inputs: [
      { name: 'member', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MemberRemoved',
    inputs: [
      { name: 'member', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AIAgentRegistered',
    inputs: [
      { name: 'agentAddress', type: 'address', indexed: true },
      { name: 'agentId', type: 'string', indexed: false },
      { name: 'metadataURI', type: 'string', indexed: false },
      { name: 'permissionClass', type: 'uint8', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AIAgentDeactivated',
    inputs: [
      { name: 'agentAddress', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const governanceEventsAbi = [
  {
    type: 'event',
    name: 'ProposalCreated',
    inputs: [
      { name: 'proposalId', type: 'uint256', indexed: true },
      { name: 'community', type: 'address', indexed: true },
      { name: 'proposer', type: 'address', indexed: true },
      { name: 'title', type: 'string', indexed: false },
      { name: 'startTime', type: 'uint256', indexed: false },
      { name: 'endTime', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'VoteCast',
    inputs: [
      { name: 'proposalId', type: 'uint256', indexed: true },
      { name: 'voter', type: 'address', indexed: true },
      { name: 'support', type: 'bool', indexed: false },
      { name: 'fundedAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProposalFinalized',
    inputs: [
      { name: 'proposalId', type: 'uint256', indexed: true },
      { name: 'status', type: 'uint8', indexed: false },
      { name: 'yesVotes', type: 'uint256', indexed: false },
      { name: 'noVotes', type: 'uint256', indexed: false },
      { name: 'totalFunded', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const FACTORY_EVENT_NAMES = ['CommunityDeployed'] as const;
export const COMMUNITY_EVENT_NAMES = [
  'CommunityCreated',
  'MemberAdded',
  'MemberRemoved',
  'AIAgentRegistered',
  'AIAgentDeactivated',
] as const;
export const GOVERNANCE_EVENT_NAMES = [
  'ProposalCreated',
  'VoteCast',
  'ProposalFinalized',
] as const;
