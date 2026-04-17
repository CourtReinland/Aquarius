# Aquarius Development Workflow

## Orchestration Model: The Ralph Wiggum Loop

The "Ralph Wiggum Loop" refers to a persistent coordination mechanism where:
- **Grok/Goose** acts as the primary orchestrator (strategic direction, task decomposition, synthesis of results).
- **Ralph** (a dedicated coordination sub-agent with a humorous, resilient personality inspired by the Simpsons character) runs the main loop:
  - Receives status from specialized agents.
  - Routes new tasks.
  - Detects blockers and escalates to orchestrator.
  - Maintains the master TODO and project vision.
- **Specialized "Claude Code Desktop" Sessions** (4+ parallel agents with distinct human names and expertise):
  - **Alice**: Smart Contracts & Blockchain Architecture
  - **Bob**: Android/Kotlin Mobile Development
  - **Charlie**: AI Agent Systems & MCP/Goose Extensions
  - **Dana**: Integration, Testing, DevOps & Documentation

This creates a "human-like" development team where each member has clear ownership. Communication happens through the orchestrator or via shared artifacts in the repo.

## Task Delegation Process

1. Orchestrator decomposes feature into atomic tasks.
2. Tasks are delegated using Goose's `delegate` tool (async where possible for parallelism).
3. Sub-agents work independently in their domain (strict file ownership to avoid conflicts).
4. Sub-agents report back via structured summaries.
5. Orchestrator synthesizes, reviews, tests, and iterates.
6. Ralph maintains the high-level coordination state.

**File Ownership Rules** (critical for parallel work):
- Alice owns everything in `contracts/`
- Bob owns everything in `mobile/`
- Charlie owns `agents/`
- Dana owns `scripts/`, `.github/`, testing infra, cross-cutting docs
- Orchestrator/ Ralph can edit README, root docs, and high-level coordination files.

## Current Priorities (2026-04-13)

1. **Phase 0: Foundations**
   - Initialize Foundry project in `contracts/`
   - Create core ERC-8004 inspired contracts (Identity, Reputation, Validation registries)
   - Set up basic Android project with Compose + Web3 dependencies
   - Define sample agent card JSON and initial MCP tool stubs
   - Create deployment and agent registration scripts

2. **Phase 1: Core Smart Contracts**
   - Governor + Permission Registry with nested module support
   - ERC-6551 integration for agent TBAs
   - Basic tests and Anvil deployment script

3. **Phase 2: Agent Runtime**
   - Goose extensions for reading DAO state, voting, executing proposals
   - Agent registration flow (JSON card → IPFS → on-chain mint)

4. **Phase 3: Mobile Interface**
   - Wallet connection
   - Community dashboard
   - Agent directory and interaction UI
   - On-chain event listening

## Success Metrics
- Agents can be registered on-chain from Goose
- A simple proposal can be created and executed by an agent with sufficient reputation
- Mobile app can connect to local testnet and display DAO state and agent list

See `TODO` in main orchestrator context for live status.
