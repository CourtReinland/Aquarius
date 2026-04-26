# Phase 1 MVP Tickets - Basic Aquarius Community

**Goal**: Deliver a working **community create/join flow** with real on-chain data. All other features are deprioritized until this is solid and aligned with the book, mind map, mobile app, and PLAN.md.

## Ticket Legend
- **Priority**: P0 (Blocker), P1 (High), P2 (Medium)
- **Labels**: `agent:pm`, `agent:ui`, `agent:contracts`, `phase:1-mvp`, `feature:communities`

---

### PM-001: Finalize Phase 1 MVP Scope & Success Criteria
**Title**: [PM] Finalize Phase 1 MVP scope — Community Create/Join with on-chain data

**Description**: Create the definitive scope document based on existing mobile app flows, smart contracts, PLAN.md, the book, and mind map.

**Acceptance Criteria**:
- One-page scope doc (or Linear wiki) created in repo
- Clear definition of on-chain vs off-chain responsibilities
- Signed off by product and tech lead
- Links to mobile app flows and relevant book chapters

**Labels**: `agent:pm`, `phase:1-mvp`
**Priority**: P0

---

### SC-001: Audit & Upgrade Community Smart Contracts
**Title**: [Contracts] Audit and prepare Community + Membership contracts for MVP

**Description**: Review `Community.sol`, factory, and membership logic. Ensure they support the exact create/join flow from the book and PLAN.md.

**Acceptance Criteria**:
- Support `createCommunity()` and `joinCommunity()` with proper events
- Gas optimization and access control reviewed
- Deployed to testnet with verified source
- Addresses and ABIs documented

**Labels**: `agent:contracts`, `phase:1-mvp`
**Priority**: P0

---

### DATA-001: Set up On-Chain Data Layer (Subgraph)
**Title**: [Data] Deploy The Graph subgraph (or lightweight indexer) for communities

**Description**: Create subgraph that indexes Community factory and membership events for fast querying.

**Acceptance Criteria**:
- Indexes `CommunityCreated` and `MemberJoined` events
- GraphQL schema matches mobile app data shape
- Deployed with documented endpoint
- Supports "my communities" and "all communities" queries

**Labels**: `agent:data`, `agent:be`, `phase:1-mvp`
**Priority**: P0

---

### FE-001: Wallet Connection & Authentication
**Title**: [FE] Implement wallet connection with account abstraction readiness

**Description**: Build wallet connection layer consistent with the mobile app.

**Acceptance Criteria**:
- Support MetaMask, WalletConnect, Coinbase Wallet
- Store connection state in context
- Display address + ENS
- Works on mobile and desktop

**Labels**: `agent:fe`, `agent:ui`, `phase:1-mvp`
**Priority**: P0

---

### FE-002: Community Creation Flow
**Title**: [FE] Build Community Creation flow (on-chain first)

**Description**: Full create community experience: form → IPFS metadata → contract call → success state.

**Acceptance Criteria**:
- Form matches contract + book fields
- Metadata uploaded to IPFS before contract call
- Loading states, tx status, error handling
- Success screen shows on-chain community card

**Labels**: `agent:fe`, `agent:ui`, `feature:communities`, `phase:1-mvp`
**Priority**: P1

---

### FE-003: Community Directory + Join Flow
**Title**: [FE] Build Community Directory and Join flow

**Description**: List communities from subgraph and allow joining.

**Acceptance Criteria**:
- Directory queries subgraph
- Real-time membership status updates
- Join button triggers contract call
- Matches mobile app visual style

**Labels**: `agent:fe`, `agent:ui`, `feature:communities`, `phase:1-mvp`
**Priority**: P1

---

### FE-004: My Communities Dashboard
**Title**: [FE] Build "My Communities" personal dashboard

**Description**: Dashboard showing communities the connected wallet has created or joined.

**Acceptance Criteria**:
- Tabs for "Created" and "Joined"
- Data from subgraph (not local state)
- Clicking opens detail view
- Consistent with mobile app

**Labels**: `agent:fe`, `agent:ui`, `phase:1-mvp`
**Priority**: P1

---

### PM-002: End-to-End Flow Validation & Polish
**Title**: [PM] Validate complete create → join → view flow against mobile app & book

**Description**: Perform end-to-end testing and visual polish.

**Acceptance Criteria**:
- Test script created and executed
- All edge cases documented
- Visual polish pass completed
- Success metrics defined

**Labels**: `agent:pm`, `agent:ux`, `phase:1-mvp`
**Priority**: P1

---

### QA-001: Smart Contract & Integration Testing
**Title**: [QA] Write automated tests for community create/join flow

**Description**: Ensure the full on-chain flow is reliable.

**Acceptance Criteria**:
- Unit + integration tests
- E2E test covering full flow
- Test coverage >85% for new code

**Labels**: `agent:qa`, `phase:1-mvp`
**Priority**: P2

---

### DOCS-001: Update Documentation
**Title**: [Docs] Update PLAN.md and architecture diagram with Phase 1 decisions

**Description**: Keep source of truth current.

**Acceptance Criteria**:
- PLAN.md updated
- New architecture diagram (Mermaid or ASCII) added
- All addresses and endpoints documented

**Labels**: `agent:pm`
**Priority**: P2

---

## MVP Flow Overview
```ascii
Wallet Connect
     ↓
[Create Community] ──→ IPFS Metadata ──→ CommunityFactory.createCommunity()
     ↓
  Subgraph indexes event
     ↓
[Community Directory] ←──── Query ───── Subgraph
     ↓
  User clicks "Join"
     ↓
Membership contract call → MemberJoined event → Subgraph
     ↓
  "My Communities" updates in real-time
```

**Next Steps**: Start with **PM-001** and **SC-001** (P0). Parallelize contract and subgraph work. Only begin heavy frontend once backend is stable.

Would you like me to generate ready-to-paste Linear ticket markdown or create a script that uses the Linear CLI to auto-create these?
