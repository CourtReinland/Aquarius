# Aquarius + BlueOS Development Plan

## Confirmation of Ingestion
- **Local directories read**: Yes, fully confirmed via `Developer.tree`.
  - `/Users/blue/Projects/aquarius/`: Contains `apps/mobile/` (React Native/Expo app with App.tsx, screens, navigation), `packages/contracts/` (Solidity smart contracts for Community, Governance, Token, Alliance modules + tests), `docs/` with ARCHITECTURE.md, CONTRACTS.md, SETUP.md, and From User/ folder.
  - From User files: `Aquarius BOOK final.md` (full book), 3 PDFs (Pitch Deck, YC Pitch, MindMap) - text successfully extracted (~3k chars each for pitches, 1.5k for mindmap).
  - Previous Claude work: Mobile app skeleton, web3 contracts focused on communities, governance, institutions.
- **External links**: X post on agenticOS principles retrieved via webScrape. Wafer blog noted as closed-source.

## Project Vision Summary (from ingested docs)
Aquarius is ambitious community management software for humanity benefit. Features include:
- Community creation, membership, governance (tokenized?).
- Agentic AI assistants for moderation, events, knowledge sharing.
- Target users: communities, DAOs, local groups, institutions.
- BlueOS: Agentic-first Android OS layer (inspired by wafer.systems/utop, agenticOS principles from X post: autonomous agents, intent-based UI, AI-orchestrated workflows).
- Novel UI: Minimalist 3D interface using Three.js.

## High-Level Architecture
```
Aquarius Ecosystem
├── BlueOS (Agentic Android Base)
│   ├── Rust Kernel Modules (drivers, security, agent runtime)
│   ├── Agentic Runtime (LLM orchestration, intent parser)
│   ├── Modified AOSP/Launcher with Three.js UI layer (WebView + RN bridge?)
│   └── APIs for Aquarius integration
├── Aquarius App
│   ├── Frontend: React Native + Three.js (for 3D community viz)
│   ├── Backend: Node/TS API + Solidity Contracts (on ETH or L2)
│   ├── Agent Layer: Autonomous agents for community tasks (using Rust or TS)
│   └── Data: Local-first + on-chain (tokens, governance)
└── Orchestration (Goose PM)
    ├── Agents: UI-Agent, Rust-OS-Agent, Contracts-Agent, Integration-Agent
    └── Iterative Loop: Plan → Build → Test → Refine
```

## Modules & Dependencies
1. **BlueOS Layer**
   - Rust: For native modules, perhaps using cargo-ndk for Android, or Fuchsia-like but for Android.
   - Feasibility note: Full custom OS hard; start with custom Android app/launcher + Rust FFI. Use Android NDK.
   - Deps: Rust, cargo, Android SDK, Three.js (via WebView).

2. **Aquarius Core**
   - Smart Contracts: Existing Solidity (Community.sol, GovernanceModule.sol etc.)
   - API: TS/Express in packages/api
   - Frontend: RN/Expo (existing), add Three.js via @react-three/fiber or web.

3. **Agentic Features**
   - Use local LLMs or API for agents.
   - Intent-based interactions.

4. **UI/UX**
   - Minimalist 3D: Three.js scenes for community graphs, spaces.

**Tech Stack Recommendation**:
- Rust for performance-critical (crypto, agents).
- React Native for cross-platform mobile (Android first).
- Solidity for web3.
- Three.js for novel UI.
- Avoid full kernel mod initially.

## MVP Roadmap (Fastest to Value)
**Phase 0: Setup (1-2 days)**
- Update SETUP.md with new plan.
- Install deps: pnpm install, Rust toolchain, Android SDK.

**Phase 1: MVP - Basic Aquarius Community (1 week)**
- Use existing contracts + mobile app.
- Features: Create community, join, basic profile, view on-chain data.
- Test with foundry tests.
- UI: Simple RN screens, later enhance with 3D.

**Phase 2: Add Agentic Features (2 weeks)**
- Simple AI agent for community suggestions (use API).
- Integrate basic Three.js viz for community map.

**Phase 3: BlueOS Prototype (4+ weeks)**
- Custom launcher app.
- Rust module for agent runtime.
- Research AOSP mods.

**Phase 4: Polish & Ports**

## Orchestration & Team Structure
- **Goose Orchestrator**: Use `Orchestrator.startAgent` for specialized sub-agents:
  - `ui-agent`: Three.js & RN UI.
  - `rust-agent`: BlueOS Rust components.
  - `contracts-agent`: Smart contract improvements.
  - `pm-agent`: Overall coordination.
- **Knowledge Organization**: 
  - **Obsidian**: Perfect for md files, mindmaps, linking book content, daily notes.
  - **Linear or GitHub Projects**: For tickets, assign to agents (use labels like "agent:ui").
  - Track in Todo tool + docs/PLAN.md.

## Autonomous Iterative Pattern
1. PM Agent creates ticket.
2. Specialized agent builds/tests.
3. Review with summarize/analyze.
4. Refine with edit/write.
5. Repeat with load(result).

ASCII Project Structure:
```
.
├── docs/
│   ├── PLAN.md          <- This plan
│   ├── From User/       <- All specs
│   └── ARCHITECTURE.md
├── apps/
│   └── mobile/          <- RN App (MVP target)
├── packages/
│   ├── contracts/       <- Solidity
│   ├── api/ 
│   └── rust-blueos/     <- New Rust crate
├── agents/              <- Session logs
└── README.md
```

Next Action: Create Obsidian vault symlink or folder, start Phase 0 by updating files.
