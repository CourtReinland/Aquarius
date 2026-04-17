# Aquarius

**Hybrid Human-AI Community Management on Blockchain**

Aquarius is a mobile-first platform for self-sustaining communities (DAOs) that include both human members and autonomous AI agents. It leverages Ethereum smart contracts for governance, on-chain identity for agents (via ERC-8004), and the Goose agent harness for runtime execution of AI members.

## Core Architecture

(See `docs/ERC-architecture-for-Aquarius.md` for the full detailed spec.)

### Key Components
- **Hybrid DAO Core**: OpenZeppelin Governor + custom nested permission contracts for hierarchical modules (Treasury, Agent Factory, Content, etc.)
- **Agent Identity System (ERC-8004)**:
  - Identity Registry: Mints ERC-721 NFTs for agents with metadata URI (agent card)
  - Reputation Registry: On-chain scores based on contributions
  - Validation Registry: Proofs for high-stakes actions
- **Goose Harness**: Runtime for AI agents. Agents register their capabilities via MCP/A2A endpoints listed in their on-chain card. They can vote, propose, execute via Token Bound Accounts (ERC-6551) or Account Abstraction.
- **Mobile Android App**: Primary interface for humans to interact with communities, view agent activity, participate in governance, and summon/manage agents.
- **Communication Layer**: Agent-to-Agent (A2A + MCP), Agent-to-Human, on-chain event listening.

### Tech Stack
- **Smart Contracts**: Solidity 0.8.24+, Foundry for development/testing/deployment
- **Mobile**: Kotlin + Jetpack Compose, Web3j/WalletConnect, Android SDK 34+
- **AI Agents**: Goose (this system) with custom MCP extensions for DAO interaction, blockchain tools
- **Infrastructure**: IPFS/Arweave for agent metadata, The Graph or custom indexing for events, Anvil/Hardhat for local testing
- **Orchestration**: Goose as central orchestrator with delegated sub-agents (Ralph Wiggum coordination loop + specialized "Claude Code Desktop" style sessions)

## Project Structure
```
.
├── contracts/           # Solidity smart contracts (Foundry)
│   ├── src/
│   └── test/
├── mobile/              # Android application
│   └── app/
├── agents/              # Goose agent configurations, cards, MCP tool definitions
│   ├── cards/           # JSON agent cards (for IPFS registration)
│   └── tools/           # Custom Goose extensions/MCP tools for DAO ops
├── docs/                # Architecture and specifications
├── scripts/             # Deployment, registration, testing scripts
├── .github/workflows/   # CI/CD
├── README.md
└── ERC architecture for Aquarius.md
```

## Getting Started

**See `QUICKSTART.md` for the fastest way to run the full system locally (Anvil + contracts deployment + agent registration + Android app).**

1. **Clone & Setup**
   ```bash
   git clone https://github.com/CourtReinland/Aquarius.git
   cd Aquarius
   # Install Foundry
   curl -L https://foundry.paradigm.xyz | bash
   # Android Studio for mobile/
   ```

2. **Local Development**
   - Contracts: `cd contracts && forge build && forge test`
   - Run local Anvil fork: `anvil --fork-url <rpc>`
   - Register test agents using Goose + the registration tools
   - Mobile: Open in Android Studio, connect to local blockchain

3. **Development Workflow**
   - **Orchestrator (Grok/Goose)**: Breaks down tasks and delegates to specialized sub-agents
   - **Specialized Agents**: Alice (Solidity), Bob (Android/Kotlin), Charlie (AI/MCP), Dana (Integration/Testing)
   - Use the "Ralph Wiggum Loop" for persistent coordination and task routing (implemented via scheduled recipes or main orchestration loop)
   - All changes reviewed by orchestrator before merging

4. **Key Flows**
   - Humans vote with governance tokens
   - Agents vote via their ERC-8004 NFT + reputation threshold
   - Agents perform autonomous maintenance of the DAO (spawning new agents, updating permissions, treasury management)
   - Mobile app serves as the human-friendly dashboard and agent summoning interface

## Contributing

This is a collaborative human-AI development project. Tasks are delegated to specialized sub-agents via the Goose delegation system. See `docs/development-workflow.md` (to be created).

## License
TBD - Likely AGPL or MIT with blockchain considerations.

---

**Status**: Early stage - Project structure initialized. Next: Implement core ERC-8004 contracts and Android foundation.
