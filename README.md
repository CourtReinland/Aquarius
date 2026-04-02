# Aquarius

**Community governance on the blockchain.**

Aquarius lets anyone create a community with its own charter, currency, voting framework, institutions, and banking system — all stored on Ethereum (Base L2). Think of it as what Bitcoin is to money, Aquarius is to community.

## What It Does

- **Found a Community** — Name it, write a charter, set bylaws, define governance rules
- **Create a Currency** — ERC-20 community token with Austrian (strict) or Keynesian (fractional reserve) banking
- **Vote on Proposals** — Crowdfunded proposals with majority, supermajority, or minimum-member quorum
- **Build Institutions** — Pizza shops, schools, cafes — each with shareholders, positions, and dividends
- **Form Alliances** — Inter-community agreements with shared benefits and mutual rights
- **AI Legal Generation** — Claude API generates real legal documents from your community parameters

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- [Foundry](https://getfoundry.sh/) (for smart contracts)
- Rust (for backend services, optional for MVP)

### Install & Run

```bash
# Clone
git clone https://github.com/CourtReinland/Aquarius.git
cd Aquarius

# Install dependencies
pnpm install

# Run smart contract tests (62/62 should pass)
cd packages/contracts
forge test

# Start the mobile app (web preview)
cd apps/mobile
npx expo start --web

# Start the API server (for legal document generation)
cd packages/api
pnpm dev
```

### Deploy Contracts (Local)

```bash
# Start local blockchain
anvil &

# Deploy all contracts
cd packages/contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url http://localhost:8545 \
  --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Deploy Contracts (Base Sepolia Testnet)

```bash
# Get testnet ETH from https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
cd packages/contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --private-key $YOUR_PRIVATE_KEY
```

After deployment, copy the contract addresses into `apps/mobile/src/config/chains.ts`.

## Project Structure

```
aquarius/
  apps/
    mobile/                    # React Native + Expo mobile app
      src/
        screens/               # 12 screens matching mockups
        components/
          explorer3d/          # 3D Community Explorer (React Three Fiber)
        hooks/                 # 7 blockchain + API interaction hooks
        config/                # Chain config, contract ABIs, wagmi
        types/                 # TypeScript domain types
        navigation/            # Stack + bottom tab navigator

  packages/
    contracts/                 # Solidity smart contracts (Foundry)
      src/
        Community.sol          # Core community: charter, bylaws, members
        CommunityFactory.sol   # Deploys community instances
        GovernanceModule.sol   # Proposals, voting, quorum, outcomes
        TokenModule.sol        # ERC-20 community currency + banking
        InstitutionRegistry.sol # Institutions, positions, dividends
        AllianceModule.sol     # Inter-community alliances
      test/                    # 62 tests across 6 suites
      script/                  # Deploy scripts

    api/                       # TypeScript API server (Hono)
      src/
        routes/                # Health, community, legal endpoints
        services/              # AI legal generator, charter templates
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile** | React Native, Expo SDK 54, TypeScript |
| **3D Explorer** | React Three Fiber, Three.js, expo-gl |
| **Navigation** | React Navigation (stack + bottom tabs) |
| **State** | Zustand (client), TanStack Query (server) |
| **Blockchain** | Base (Ethereum L2), Solidity 0.8.24, Foundry |
| **Wallet** | viem, wagmi, WalletConnect v2 |
| **API** | Hono, Node.js, TypeScript |
| **AI** | Claude API (Anthropic) for legal document generation |
| **Database** | PostgreSQL (planned), IPFS for document storage |

## Smart Contracts

6 contracts, 62 tests, full E2E integration test.

| Contract | What it does |
|----------|-------------|
| `CommunityFactory` | Deploys new community instances, tracks all communities per founder |
| `Community` | Stores charter (IPFS hash), bylaws config, member registry, founder list |
| `GovernanceModule` | Full proposal lifecycle: create, vote (with ETH funding), finalize, cancel, refund |
| `TokenModule` | ERC-20 with configurable banking: Austrian/Keynesian, leverage ratio, salary distribution |
| `InstitutionRegistry` | Create institutions, allocate shares, manage positions/roles, distribute dividends |
| `AllianceModule` | Propose, accept, decline, dissolve inter-community alliances |

### Running Tests

```bash
cd packages/contracts
forge test           # Run all 62 tests
forge test -v        # Verbose output
forge test --summary # Summary table
forge test --match-contract E2E  # Run just the full story test
```

## Mobile App Screens

12 screens matching the original SVG mockups:

| Screen | Description |
|--------|-------------|
| **Home** | Wallet connection + entry point |
| **Community Explorer** | 3D floating islands (R3F) or 2D card grid with search |
| **Found Community** | 3-step wizard: name/founders/charter, bylaws, legal nesting |
| **Success** | Celebration screen after founding on-chain |
| **My Memberships** | Dashboard with holdings, positions, tokens, upcoming votes |
| **Proposals Tracker** | Active proposals with vote tally bars, timers, vote modal |
| **Banking Setup** | Token amount, banking style, fractional reserve toggles |
| **Bi-laws Explorer** | Constitution style, stats, institution tracker, financials |
| **Histories Explorer** | Chronological blockchain event log with expandable blocks |
| **Congrats / Role** | Role election notification with Accept/Decline |
| **Alliance Approval** | Inter-community alliance invitation with inherited benefits |
| **Legal Doc Viewer** | AI-generated charter with article navigation and approve flow |

## AI Legal Generation

The API uses Claude to generate jurisdiction-aware legal documents from community parameters.

### Charter Templates

- **Draft Original** — Custom charter from scratch
- **U.S. Constitution** — Separation of powers, bill of rights, amendments
- **Magna Carta** — Limits on authority, due process, liberty
- **Blackfeet Tribal** — Communal decisions, elder councils, stewardship

### Usage

```bash
# Set API key
export ANTHROPIC_API_KEY=your_key_here

# Start API
cd packages/api
pnpm dev

# Generate a charter
curl -X POST http://localhost:3001/api/legal/generate \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cincinnati Skateville",
    "founders": ["Ryan", "Jess"],
    "charterTemplate": "us-constitution",
    "admissionRule": "founders-and-members",
    "exileRule": "founders-only",
    "votePercentage": 51,
    "whoMayPropose": "founders-or-members",
    "legalFramework": "U.S. Code",
    "jurisdiction": "State of Ohio",
    "allowCorporateMembers": false,
    "bankingStyle": "austrian",
    "startingTokenAmount": 33000000,
    "allowFractionalLending": false,
    "leverageRatio": 1
  }'
```

## The Vision

Aquarius is a "Lifestyle Design" platform. The core insight: what if a corporation traded only with its own members, optimizing for quality of life instead of profit? By making vendor and customer the same people in a closed loop, you eliminate 80% of wasted labor (marketing, competition, shipping) and compound the savings into ever-improving community life.

Read the full philosophy in the [Aquarius Book](https://aquariusapp.eth).

## Contributing

This project is in active development. Issues and PRs welcome.

## License

MIT

---

*Founded by Court Reinland, NYC. Built with Claude.*
