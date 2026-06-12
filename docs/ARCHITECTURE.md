# Architecture

For a feature-by-feature snapshot of what is implemented today, read [CURRENT_BUILD.md](CURRENT_BUILD.md).

## System Overview

```
┌─────────────────────────────────────────────────┐
│           React Native (Expo) Mobile App         │
│                                                  │
│  13 Screens  |  3D Explorer (R3F)  |  Hooks     │
│              |  Particle Field     |             │
│              |  Community Islands  |             │
│                                                  │
│         wagmi / viem (blockchain reads)          │
└──────────────┬───────────────────────────────────┘
               │ REST API
┌──────────────▼───────────────────────────────────┐
│          API Gateway (Hono / TypeScript)          │
│                                                   │
│  /api/legal/generate     → Claude API → Markdown   │
│  /api/legal/templates    → Template list           │
│  /api/legal/summarize    → Charter summary         │
│  /api/auth/challenge     → Wallet login nonce      │
│  /api/auth/verify        → Signature verification  │
│  /api/agents/create      → Wallet + agent card     │
│  /api/communities        → Community CRUD          │
│  /health                 → Status check            │
└──────────────────────────────┬────────────────────┘
                               │
┌──────────────────────────────▼────────────────────┐
│              Base L2 (Ethereum)                    │
│                                                    │
│  CommunityFactory ──→ Community instances          │
│  GovernanceModule ──→ Proposals + Voting           │
│  TokenModule      ──→ ERC-20 Community Currency    │
│  InstitutionRegistry → Institutions + Positions    │
│  AllianceModule   ──→ Inter-community Alliances    │
└────────────────────────────────────────────────────┘
```

## Smart Contract Architecture

### Factory Pattern

`CommunityFactory` deploys new `Community` instances. Each community is an isolated contract with its own state. The factory tracks all communities and per-founder lookups.

### Module Pattern

Governance, Token, Institution, and Alliance modules are shared singletons that reference community contracts by address. This keeps deployment costs low while maintaining per-community isolation of state.

### On-Chain vs Off-Chain

| On-Chain (immutable, trustless) | Off-Chain (PostgreSQL + IPFS) |
|--------------------------------|------------------------------|
| Community existence + params | Charter full text (IPFS hash on-chain) |
| Member registry (addresses) | User profiles, avatars |
| Token balances + transfers | Cached read views |
| Vote records + outcomes | Proposal discussions |
| Share ownership | Legal documents (IPFS) |
| Institution ownership | Media, notifications |
| Alliance state | Search indexes |
| AI-agent registry membership | Agent cards, prompt/runtime config, encrypted keys |
| Membership/role authority | Local wallet Passport and short-lived convenience sessions |

### Key Design Decisions

1. **Solidity on Base L2** — Lowest gas, Coinbase ecosystem, ERC-4337 ready
2. **No upgradeable proxies yet** — Keep it simple for MVP; add UUPS later
3. **Events as audit trail** — Every state change emits events for the Histories Explorer
4. **ETH-denominated crowdfunding** — Proposals can require ETH per yes-vote
5. **Automatic refunds** — Failed or cancelled proposals refund all voters

## Mobile App Architecture

### Navigation Structure

```
RootStack
  ├── Home (wallet connect)
  ├── MainTabs
  │   ├── Explorer (3D/Grid toggle)
  │   ├── Proposals Tracker
  │   ├── Profile / Dashboard
  │   ├── Bi-laws Explorer
  │   └── Histories Explorer
  ├── FoundCommunity (3-step wizard)
  ├── FoundCommunitySuccess
  ├── CommunityDashboard
  ├── CreateAIAgent
  ├── BankingSetup
  ├── CongratsRole
  ├── ApproveAlliance
  └── LegalDocViewer
```

### 3D Explorer

Uses React Three Fiber with:
- `CommunityIsland` — Hexagonal platforms with beacon lights, crystal formations
- `ParticleField` — Ambient cosmic dust particles
- `ExplorerScene` — Camera controls, fog, lighting, spiral layout
- Auto-rotating orbit camera with zoom limits
- 2D card grid fallback (toggled via button)

### State Management

- **Zustand** — Wallet state (address, connection status)
- **TanStack Query** — Server/blockchain data caching (planned)
- **Local state** — Form wizards, UI toggles

### Hooks

| Hook | Purpose |
|------|---------|
| `useWalletStore` | Zustand store for wallet connection state |
| `useCommunityFactory` | Deploy communities, read factory state |
| `useCommunity` | Read individual community data |
| `useGovernance` | Create proposals, cast votes, finalize |
| `useInstitutions` | Manage institutions, positions, shares |
| `useAlliances` | Propose/accept/decline alliances |
| `useLegalGenerator` | Call API for AI charter generation |
| `useAgentCreator` | Create agent wallets/cards through the API |

## API Architecture

### Legal Document Generation Pipeline

```
Community Params (from wizard)
        │
        ▼
Template Selection (4 templates)
        │
        ▼
System Prompt (template-specific legal style)
  + User Prompt (all community parameters)
        │
        ▼
Claude Sonnet API Call (8000 max tokens)
        │
        ▼
Validation (check 15 required sections present)
        │
        ▼
Markdown Output → Display in LegalDocViewer
        │
        ▼
(On approve) → Pin to IPFS → Store CID on-chain
```

### AI Agent Creation Pipeline

```
Community Dashboard
        │
        ▼
POST /api/agents/create
        │
        ├── Generate EOA wallet
        ├── Build public ERC-8004-style agent card
        ├── Store private prompt/runtime config
        ├── Encrypt private key if AGENT_KEY_ENCRYPTION_SECRET is set
        │
        ▼
Community.registerAIAgent (optional operator tx)
        │
        ▼
Agent appears as a member in Community.sol
```

Agent cards expose public identity, capabilities, payment address, and future A2A/MCP endpoints. The API does not return private keys to clients. For production, move storage to PostgreSQL/Drizzle and use KMS, Lit Protocol, or ERC-4337 account abstraction instead of process-local key material.

### Wallet-Native Login Pipeline

```
Connect wallet locally
        │
        ▼
POST /api/auth/challenge
        │
        ▼
Wallet signs SIWE-style message
        │
        ▼
POST /api/auth/verify
        │
        ▼
Short-lived API session + local Aquarius Passport
        │
        ▼
Contracts remain the source of truth for rights
```

### Charter Templates

Each template modifies the system prompt to generate documents in a specific legal tradition:

- **Draft Original** — Modern cooperative operating agreement
- **U.S. Constitution** — Preamble, Articles, Bill of Rights, Amendments
- **Magna Carta** — Due process, limits on authority, property rights
- **Blackfeet Tribal** — Council governance, stewardship, restorative justice
