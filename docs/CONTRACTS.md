# Smart Contract Reference

All contracts are written in Solidity 0.8.24, tested with Foundry, and designed for Base (Ethereum L2).

## CommunityFactory.sol

**Purpose:** Deploys new community instances and tracks them.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createCommunity(name, charterIpfsHash, founders, bylaws, legalFramework, jurisdiction, allowCorporateMembers)` | Anyone | Deploy a new community contract |
| `getCommunityCount()` | View | Total number of communities |
| `getAllCommunities()` | View | Array of all community addresses |
| `getFounderCommunities(founder)` | View | Communities a specific address founded |

### Events

- `CommunityDeployed(address communityAddress, string name, address[] founders, uint256 timestamp)`

---

## Community.sol

**Purpose:** Core community state — charter, bylaws, members, founders.

### Bylaws Configuration

```solidity
struct Bylaws {
    MemberAdmission admissionRule;    // FoundersOnly or FoundersAndMembers
    MemberAdmission exileRule;        // FoundersOnly or FoundersAndMembers
    VoteThreshold voteThreshold;      // Majority, Supermajority, MinimumMembers
    uint8 votePercentage;             // 51-100
    ProposalPermission whoMayPropose; // FoundersOnly or FoundersOrMembers
    bool requireBuyIn;                // Whether joining requires payment
}
```

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `initialize(...)` | Once only | Set up community (called by factory) |
| `addMember(address)` | Founder/Member | Add new member per admission rules |
| `removeMember(address)` | Founder/Member | Remove member per exile rules |
| `getFounders()` | View | List all founders |
| `getMembers()` | View | List all members |
| `getMemberCount()` | View | Active member count |

---

## GovernanceModule.sol

**Purpose:** Proposals, voting, quorum checks, crowdfunding, outcomes.

### Proposal Types

| OutcomeType | Description |
|-------------|-------------|
| `SimpleYes` | Just a yes/no decision |
| `ShareOwnership` | Yes voters receive shares in a new institution |
| `OneTimeFee` | Yes voters pay a one-time fee |
| `RecurringBilling` | Yes voters commit to recurring payment |
| `OverfundForShares` | Allow overfunding for additional shares |

### Quorum Types

| QuorumType | How it passes |
|------------|---------------|
| `Majority` | >X% of total votes are yes (configurable 51-100%) |
| `Supermajority` | >67% of total votes are yes |
| `MinimumMembers` | At least N members vote yes |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createProposal(community, title, ..., outcomeType, fundingCost, ...)` | Community member | Create a new proposal |
| `castVote(proposalId, support)` | Community member | Vote yes/no (payable for funded proposals) |
| `finalizeProposal(proposalId)` | Anyone (after time) | Close voting, determine pass/fail, refund if failed |
| `cancelProposal(proposalId)` | Proposer or founder | Cancel and refund |
| `getProposal(id)` | View | Full proposal data |
| `getTimeRemaining(id)` | View | Seconds until voting closes |
| `getYesVoters(id)` | View | List of yes-voter addresses |

### Events

- `ProposalCreated(id, community, proposer, title, startTime, endTime)`
- `VoteCast(id, voter, support, fundedAmount)`
- `ProposalFinalized(id, status, yesVotes, noVotes, totalFunded)`

---

## TokenModule.sol

**Purpose:** ERC-20 community currency with configurable banking rules.

### Banking Styles

| Style | Behavior |
|-------|----------|
| **Austrian (Strict)** | Fixed supply, no new tokens can be minted beyond initial amount |
| **Keynesian (Fractional Reserve)** | Bank can create new tokens up to leverage ratio x initial supply |

### Configuration

```solidity
struct BankingConfig {
    BankingStyle style;              // Austrian or Keynesian
    bool allowArbitraryCreation;     // Can bank mint beyond initial supply?
    bool allowFractionalLending;     // Can bank lend more than it holds?
    uint8 leverageRatio;             // 1-9 multiplier
    uint256 maxSupply;               // Hard cap (set automatically)
}
```

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `initialize(name, symbol, community, bank, initialSupply, config)` | Once | Set up token with banking rules |
| `transfer(to, value)` | Token holder | Standard ERC-20 transfer |
| `approve(spender, value)` | Token holder | Standard ERC-20 approval |
| `mint(to, amount, reason)` | Bank only | Create new tokens (respects banking rules) |
| `burn(amount)` | Token holder | Destroy tokens |
| `distributeSalary(member, amount, role)` | Bank only | Pay member from bank balance |
| `canMint(amount)` | View | Check if minting is allowed |

---

## InstitutionRegistry.sol

**Purpose:** Community institutions (businesses/services), their shareholders, positions, and dividends.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createInstitution(community, name, totalShares, paysDividends)` | Community member | Create a new institution |
| `allocateShares(institutionId, member, shares)` | Founder | Give shares to a member |
| `createPosition(institutionId, title, responsibilities, tokenReward, shareGrant)` | Founder | Define a role |
| `offerPosition(positionId, candidate)` | Founder | Offer role to a member |
| `acceptPosition(positionId)` | Offered member | Accept a role + receive share grant |
| `declinePosition(positionId)` | Offered member | Decline a role |
| `vacatePosition(positionId)` | Position holder | Resign from role |
| `distributeDividends(institutionId, tokenAddress, totalAmount)` | Anyone | Distribute proportional dividends |

---

## AllianceModule.sol

**Purpose:** Inter-community alliances.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `proposeAlliance(communityA, communityB, terms, tokenGrant, freeTravel, votingRights)` | Founder of A | Propose alliance |
| `acceptAlliance(allianceId)` | Founder of B | Accept alliance |
| `declineAlliance(allianceId)` | Founder of B | Decline alliance |
| `dissolveAlliance(allianceId)` | Founder of A or B | End active alliance |
| `isAllied(communityA, communityB)` | View | Check if two communities are allied |
