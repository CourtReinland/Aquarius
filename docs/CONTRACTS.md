# Smart Contract Reference

All contracts are written in Solidity 0.8.24, tested with Foundry, and designed for Base (Ethereum L2).

## Security Hardening & Assumptions

Hardening pass focused on reentrancy, initializer access control, unsafe ETH handling, and smart-proposal execution. Product economics (quorum math, leverage ratios, share soft-targets) were intentionally not redesigned.

### Hardened assumptions

| Area | Assumption / behavior |
|------|------------------------|
| Community creation | `CommunityFactory.createCommunity` deploys + initializes in one tx. `Community.initialize` is **deployer-only** (factory is deployer in the normal path). |
| Token creation | Each community should `new TokenModule()` + `initialize` in one tx from the same address. `initialize` is **deployer-only**. The Deploy script `tokenTemplate` is a template address unless initialized in the same broadcast. |
| Governance refunds | On fail/cancel, funded amounts are moved to `claimableRefunds` (effects), then best-effort pushed. Failed pushes remain claimable via `claimRefund()`. Entry points are `nonReentrant`. |
| Smart proposals | `executeProposal` stays **permissionless**. Status flips to `Executed` **before** `CREATE` so constructors cannot double-deploy. Bytecode is untrusted; voters/proposers must review it off-chain. |
| Dividends | `distributeDividends` is `nonReentrant`. Payouts use `outstandingShares` (includes position grants, which may exceed the soft `totalShares` target). |
| Passed proposal ETH | Funding for **Passed** proposals remains in `GovernanceModule` until a future treasury/institution funding flow is added. |

### Remaining audit follow-ups

- Formal external audit before mainnet / significant TVL.
- Invariant + fuzz campaigns (refund conservation, share/dividend conservation, proposal status machine).
- ERC-4337 / account-abstraction integration (deferred).
- UUPS/proxy upgrade system (deferred by product plan).
- Explicit treasury withdrawal / institution funding for Passed proposal ETH.
- Contracts that permanently reject ETH cannot pull refunds; operators should prefer EOAs or claimable-friendly receivers.
- Malicious smart-proposal bytecode remains a governance/social risk even with safe status transitions.

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

**Purpose:** Core community state — charter, bylaws, members, founders, and AI-agent membership.

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
| `initialize(...)` | Deployer, once only | Set up community (called by factory in same tx) |
| `addMember(address)` | Founder/Member | Add new member per admission rules |
| `removeMember(address)` | Founder/Member | Remove member per exile rules |
| `registerAIAgent(agentAddress, agentId, metadataURI)` | Founder/Member | Register an AI agent and add it as a first-class member |
| `deactivateAIAgent(agentAddress)` | Founder | Deactivate an AI agent and remove active member status |
| `getAIAgents()` | View | List registered AI-agent addresses |
| `getAIAgentCount()` | View | Count registered AI agents |
| `getFounders()` | View | List all founders |
| `getMembers()` | View | List all members |
| `getMemberCount()` | View | Active member count |

### AI Agent Registry

```solidity
struct AIAgent {
    address agentAddress;
    string agentId;
    string metadataURI;
    uint256 registeredAt;
    bool active;
}
```

AI agents are regular members once registered. They can vote, propose, and hold rights/shares wherever the rest of the contract system grants those powers to members.

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
| `createSmartProposal(community, title, ..., bytecode)` | Community member | Create a proposal that deploys contract bytecode if passed |
| `executeProposal(proposalId)` | Anyone | Deploy a passed smart proposal's bytecode (status→Executed before CREATE) |
| `castVote(proposalId, support)` | Community member | Vote yes/no (payable for funded proposals; rejects unexpected ETH) |
| `finalizeProposal(proposalId)` | Anyone (after time) | Close voting, determine pass/fail, refund if failed |
| `cancelProposal(proposalId)` | Proposer or founder | Cancel and refund |
| `claimRefund()` | Claimable account | Pull refund if push failed (hostile receiver) |
| `getProposal(id)` | View | Full proposal data |
| `getTimeRemaining(id)` | View | Seconds until voting closes |
| `getYesVoters(id)` | View | List of yes-voter addresses |

### Events

- `ProposalCreated(id, community, proposer, title, startTime, endTime)`
- `VoteCast(id, voter, support, fundedAmount)`
- `ProposalFinalized(id, status, yesVotes, noVotes, totalFunded)`
- `SmartProposalRegistered(id, proposer, bytecodeSize)`
- `SmartContractDeployed(id, deployedAddress, community)`
- `ProposalExecuted(id)`

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
| `initialize(name, symbol, community, bank, initialSupply, config)` | Deployer, once | Set up token with banking rules |
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
