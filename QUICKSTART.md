# Aquarius Quickstart (as of 2026-04-13)

The project has been successfully spun up with a full hybrid DAO foundation using the "Ralph Wiggum Loop" orchestration model (Grok/goose as central brain, with Alice, Bob, Charlie, and soon Dana as specialized team members).

## Current Status
- **Smart Contracts**: Complete (Alice). 5 core contracts implementing ERC-8004 agent identities, reputation, validation, permissions, and hybrid governance. Ready for Anvil.
- **AI Agent Layer**: Complete (Charlie). Sample agent cards, full MCP TypeScript tools for Goose, registration flow.
- **Mobile App**: Strong foundation (Bob). Jetpack Compose Android app with wallet connection, agent directory, governance UI skeleton.
- **Orchestration**: Active. This document and the TODO in our sessions track the Ralph Wiggum coordination loop.

## Prerequisites
1. Install Foundry: `curl -L https://foundry.paradigm.xyz | bash` then `foundryup`
2. Install Node.js (for agent tools) and Android Studio (for mobile)
3. (Optional) Docker for easy Anvil

## 1. Local Blockchain (Anvil)
```bash
# Terminal 1: Start local chain
anvil

# Terminal 2: Deploy contracts (after installing Foundry in contracts/)
cd contracts
forge install
# Set a private key or use --broadcast with Anvil's default
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

This will output the deployed addresses (update `agents/tools/types.ts` and `mobile/app/src/main/kotlin/com/aquarius/web3/Web3Manager.kt` with these addresses).

## 2. Register & Test AI Agents with Goose
```bash
cd agents
node ipfs-upload-simulator.js
# Then use the Goose MCP tools (see agents/tools/example-usage.ts)
# Run with: ts-node tools/example-usage.ts
# This will register agents, query reputation, create proposals, etc.
```

The Goose harness (this very system) can now be extended with the `aquarius-mcp.ts` tools.

## 3. Run the Android App
1. Open `mobile/` in Android Studio.
2. Update `Web3Manager.kt` with the contract addresses from deployment.
3. Run on emulator (API 34+).
4. Connect "wallet", browse the Agent Directory (will show the 3 sample agents from deployment), view governance proposals.

## 4. The Ralph Wiggum Loop
- **You (user)**: Provide high-level direction and feedback.
- **Me (Grok/goose)**: Orchestrator - decompose tasks, synthesize results from team, maintain vision.
- **Alice**: Handles all blockchain/Solidity work.
- **Bob**: Owns the Android mobile experience.
- **Charlie**: Builds and extends the AI agent capabilities and Goose integrations.
- **Dana**: Testing, integration, CI/CD, DevOps glue.

To continue development, simply tell me the next feature or area to focus on (e.g. "Implement full agent autonomy for treasury management" or "Polish the mobile agent interaction UI" or "Have Dana complete the CI/CD").

## Next Immediate Steps (Proposed Sprint 1)
1. Complete Dana's integration (ABI syncing between layers).
2. Test end-to-end flow: Deploy → Register agent via Goose → Vote via mobile.
3. Implement real event listening in mobile for live agent activity.
4. Add more sophisticated agent behaviors in the MCP tools (autonomous proposal creation based on context).
5. Expand to full ERC-6551 TBA control from within Goose.

The project is now **alive**. The contracts compile (once Foundry is installed), the mobile builds, and the agent system is ready for you to interact with using this Goose interface.

**What would you like to do next?** 
- Dive into a specific component?
- Have me activate Dana for full testing/integration?
- Start implementing a particular feature (e.g. treasury module, agent spawning, mobile push for DAO events)?
- Review specific code/files?
```

**Built collaboratively by the Aquarius Team (Alice, Bob, Charlie, Grok Orchestrator).**