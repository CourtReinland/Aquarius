# Implementation Plan — Aquarius Multiplayer DAO + Ralph Wiggum Loop

## 1. Ralph Wiggum Autonomous Development Loop
- Create `ralph-wiggum-supervisor.ts` that runs continuously.
- Use Ghostty terminals for Kai (Claude Code - contracts) and Luna (Claude Code - UI).
- Ralph will:
  1. Assess current code against mindmap/spec using `Summarize.summarize` on docs/ + contracts/.
  2. Score effectiveness for multiplayer on-chain state.
  3. Generate next targeted prompt.
  4. Use `Computercontroller.computerControl` or `automationScript` to inject prompt into the correct Ghostty window.
- Orchestrator (Grok) synthesizes final output and maintains quality gate.

## 2. On-Chain First Multiplayer Prototype (v0.2)
- Deploy local Anvil chain.
- Update Community.sol + GovernanceModule.sol to support:
  - Smart Proposal creation
  - ERC-8004 AI member registration
  - State updates via events (CommunityCreated, ProposalExecuted, MemberJoined)
- Create subgraph mock that listens to events.
- Update prototype HTML to show:
  - One community with glowing human + AI nodes
  - "Create Proposal" button that triggers local contract call
  - Real-time state sync visualization between "emulator" panels

## 3. Shared State Between Instances
- Start with 2 browser panels representing different "Android emulators".
- Use WebSocket + local Hardhat node for instant event propagation.
- Later replace with real Android emulators + BlueOS Rust layer.

## 4. Execution Order for Next Cycle
1. Ralph Wiggum assesses current prototype.
2. Kai improves on-chain proposal + ERC-8004 logic.
3. Luna adds multiplayer sync UI.
4. Ralph reviews both, loops again.

Next immediate actions after this plan:
- Spawn Ghostty terminals for Kai and Luna.
- Start local Anvil chain.
- Deploy updated contracts.
- Release aquarius-prototype-v0.2-onchain.html

---

**Suggestions from Orchestrator:**
- We should add a simple Hardhat project in `packages/contracts` immediately for fast on-chain testing.
- Ralph's loop should have a 60–90 second sleep between cycles to avoid rate limits.
- We can use `Developer.shell` to run `anvil` in background.

Ready for implementation.