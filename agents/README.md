# Aquarius Agent Layer

This directory contains the implementation for **Phase 0 & 1 (Agent Layer)** of the Aquarius hybrid DAO. As Charlie (AI Systems Architect & Goose/MCP specialist), I own everything under `agents/`.

## Architecture Overview

Aquarius implements a hybrid DAO where both humans and AI agents are first-class members:

- **Identity**: ERC-8004 (ERC-721 variant) NFTs minted via `IdentityRegistry.registerAgent(agentURI)`
- **Reputation**: Tracked in `ReputationRegistry` with on-chain scores updated via validated actions
- **Validation**: `ValidationRegistry` for proofs of correct execution
- **Communication**: MCP (Model Context Protocol) tools + A2A (Agent-to-Agent) protocol
- **Ownership**: Agents use **ERC-6551 Token Bound Accounts (TBAs)** or **Account Abstraction (ERC-4337)** to control their on-chain identity **without exposing private keys** in the Goose runtime.

See `docs/ERC architecture for Aquarius.md` for full system diagram.

## Agent Card JSON Structure

Each agent is defined by a cryptographically referenced "Agent Card" (JSON) that gets pinned to IPFS/Arweave and registered on-chain.

**Core Schema** (`cards/agent-card-schema.json`):

```json
{
  "name": "string",
  "description": "string",
  "version": "string",
  "capabilities": ["array", "of", "strings"],
  "mcpEndpoints": [{ "name": "...", "uri": "mcp://...", "description": "..." }],
  "a2aEndpoints": [{ "protocol": "A2A", "uri": "...", "methods": ["..."] }],
  "paymentAddress": "0x...",
  "reputationLink": "https://...",
  "erc8004NftId": "1",
  "identityRegistry": "0x...",
  "securityNotes": {
    "usesAA": true,
    "tbaAddress": "0x...",
    "keyManagement": "Uses ERC-6551 TBA controlled via ERC-4337 bundler. No keys in Goose."
  }
}
```

**Examples** (see `cards/`):
- `governance-agent.json` - Proposal creation, analysis, and voting
- `treasury-agent.json` - Financial management and disbursements  
- `validator-agent.json` - Auditing, scoring, and compliance

## Agent Registration Process

1. **Generate Card**: Create or iterate on JSON in `cards/`
2. **Upload to IPFS**: Use `ipfs-upload-simulator.js` (replace with real IPFS client in prod)
   ```bash
   node ipfs-upload-simulator.js cards/governance-agent.json
   ```
3. **Register On-Chain**: Goose calls `IdentityRegistry.registerAgent(ipfsUri)` which:
   - Mints ERC-721 NFT (the agent's on-chain identity)
   - Stores metadata URI
   - Links to ReputationRegistry entry (initial score = 50)
4. **Self-Configuration**: Agent queries its NFT data and configures MCP endpoints

**Example using Goose MCP tools** (implemented in `tools/`):
```typescript
// Pseudo-code for registration tool
const registerAgent = async (cardPath: string) => {
  const uri = await uploadToIPFS(cardPath);
  const tx = await identityRegistry.registerAgent(uri);
  const nftId = await getMintedTokenId(tx);
  updateAgentCardWithNftId(cardPath, nftId);
  return { success: true, nftId, uri };
};
```

## Goose MCP Extensions & Tools

Located in `tools/`. These are production-quality, secure TypeScript definitions compatible with Goose's MCP system and Alice's contracts.

### Core Tools Implemented:

**DAO State Query Tools:**
- `queryDAOState(proposalId?)`: Gets proposals, votes, treasury balance
- `getAgentNFTData(agentAddress)`: Reads from IdentityRegistry
- `getReputationScore(agentNftId)`: Queries ReputationRegistry

**Agent Action Tools:**
- `propose(action, description, parameters)`: Creates proposal (reputation-gated)
- `vote(proposalId, support, reason?)`: Casts vote with reputation weight
- `execute(proposalId)`: Executes passed proposal (with validation check)

**Registry & Self-Management Tools:**
- `registerSelf(agentCardPath)`: Complete registration flow (card → IPFS → on-chain)
- `updateReputation(delta, justification)`: Updates score via ValidationRegistry proof
- `validateAction(actionHash, proof)`: Submits validation to ValidationRegistry

**Security Features:**
- All actions check `ReputationRegistry.getScore() > THRESHOLD`
- Uses read-only RPC providers for queries
- Transaction signing via ERC-4337 bundlers or TBA executors
- No private keys ever stored in Goose runtime
- Input validation and reentrancy protection patterns

**ERC-6551 / AA Integration Pattern:**

```typescript
// How Goose agents control on-chain identity WITHOUT keys:
1. Agent NFT (ERC-8004) owns an ERC-6551 TBA (smart contract wallet)
2. Goose runtime creates UserOp (ERC-4337) with:
   - target = TBA address
   - callData = encodeFunctionData("execute", [targetContract, value, calldata])
   - signature from secure session (hardware/Cloud KMS/MPC)
3. Bundler submits to EntryPoint
4. All state reads use public RPCs
5. Reputation checks happen on-chain before execution

This ensures agents have autonomous on-chain presence while remaining secure.
```

## Tool Signatures (TypeScript)

```typescript
// tools/aquarius-mcp.ts
export interface AquariusTools {
  // DAO State
  queryDAOState: (params: { proposalId?: string }) => Promise<DAOState>;
  getTreasuryBalance: () => Promise<BigInt>;
  getProposals: (filter?: ProposalFilter) => Promise<Proposal[]>;
  
  // Agent Actions (reputation-gated)
  createProposal: (params: ProposalParams) => Promise<TxReceipt>;
  castVote: (params: { proposalId: string; support: boolean; reason?: string }) => Promise<TxReceipt>;
  executeProposal: (proposalId: string) => Promise<TxReceipt>;
  
  // Registry Interactions
  registerAgent: (cardURI: string) => Promise<{ nftId: string; txHash: string }>;
  getAgentData: (nftId: string) => Promise<AgentNFTData>;
  updateReputation: (params: { agentId: string; delta: number; proof: string }) => Promise<TxReceipt>;
  
  // Self-management
  getMyNFTId: () => Promise<string>;
  validateAndScore: (actionHash: string) => Promise<ValidationResult>;
}
```

## Production Security Considerations

1. **Key Management**: Never store private keys. Use:
   - ERC-4337 Account Abstraction with trusted bundlers
   - ERC-6551 for NFT-owned smart accounts
   - Hardware security modules for session keys
2. **Reputation Gating**: All privileged actions require `reputationScore >= MIN_THRESHOLD`
3. **Validation Layer**: Critical actions require `ValidationRegistry` proofs
4. **Rate Limiting & Monitoring**: Implemented in MCP layer
5. **Auditability**: All actions emit events traceable to agent NFT

## Next Steps (for Orchestrator/Ralph)

1. Alice to implement matching contracts in `contracts/src/` (IdentityRegistry, etc.)
2. Integrate these MCP tools into Goose runtime
3. Dana to add deployment scripts and tests
4. Test end-to-end: register agent → create proposal → vote → execute

**All files created exclusively within `agents/` as per file ownership rules.**

---
*Last updated: 2026-04-13 | Charlie (AI Systems Architect)*
