/**
 * Example Usage of Aquarius MCP Tools in Goose
 * 
 * Demonstrates how Goose agents would use these tools for
 * self-registration, DAO interaction, and on-chain governance.
 * 
 * This would be loaded as a Goose extension via the extension manager.
 */

import { aquariusTools } from './aquarius-mcp.js';
import { AgentCard } from './types.js';

// Example agent card (matches the one in cards/)
const exampleAgentCard: AgentCard = {
  name: "Example-Goose-Agent",
  description: "Demonstration agent showing full registration and governance flow",
  version: "1.0.0",
  capabilities: ["governance", "validation", "treasury-query"],
  mcpEndpoints: [
    { name: "queryDAOState", uri: "mcp://dao/state", description: "Get DAO state" }
  ],
  a2aEndpoints: [
    { protocol: "A2A", uri: "https://a2a.aquarius.dao/example", methods: ["query", "propose"] }
  ],
  paymentAddress: "0x1111111111111111111111111111111111111111",
  reputationLink: "https://reputation.aquarius.dao/agents/example",
  securityNotes: {
    usesAA: true,
    tbaAddress: "0x2222222222222222222222222222222222222222",
    keyManagement: "ERC-6551 + ERC-4337. Session keys only."
  }
};

async function demonstrateAgentFlow() {
  console.log('🚀 Starting Aquarius Agent Demonstration...\n');
  
  // 1. Self Registration
  console.log('Step 1: Agent Self-Registration');
  const registration = await aquariusTools.registerSelf('agents/cards/governance-agent.json');
  console.log('Registration result:', registration);
  
  // 2. Query DAO State
  console.log('\nStep 2: Querying DAO State');
  const daoState = await aquariusTools.queryDAOState();
  console.log('DAO State:', {
    proposals: daoState.proposals.length,
    treasuryBalance: daoState.treasuryBalance.toString(),
    totalAgents: daoState.totalAgents
  });
  
  // 3. Check Reputation & Get NFT Data
  console.log('\nStep 3: Checking Agent Identity & Reputation');
  const agentData = await aquariusTools.getAgentNFTData('1');
  console.log('Agent NFT Data:', agentData);
  
  // 4. Create Proposal (if reputation sufficient)
  console.log('\nStep 4: Creating Sample Proposal');
  try {
    const proposalResult = await aquariusTools.createProposal({
      targets: ['0xTreasuryAddress'],
      values: [BigInt(1000000000000000000)],
      calldatas: ['0x'],
      description: 'Proposal to allocate 1 ETH for AI research initiatives #Aquarius'
    });
    console.log('Proposal created:', proposalResult);
  } catch (error) {
    console.log('Proposal creation failed (as expected in demo):', (error as Error).message);
  }
  
  // 5. Demonstrate ERC-6551/AA pattern
  console.log('\nStep 5: ERC-6551/AA Identity Control');
  const agentWithTBA = await aquariusTools.getAgentWithTBA('1');
  console.log('Agent with TBA:', {
    nftId: agentWithTBA.tokenId,
    tbaAddress: agentWithTBA.tbaAddress,
    keyManagement: agentWithTBA.keyManagement
  });
  
  console.log('\n✅ Demonstration complete!');
  console.log('\nKey Takeaways:');
  console.log('- Agents register via JSON card → IPFS → IdentityRegistry');
  console.log('- All actions are reputation-gated');
  console.log('- No private keys exposed - uses ERC-6551 TBAs + ERC-4337 AA');
  console.log('- Fully compatible with Alice\'s smart contracts');
  console.log('- Ready for production Goose MCP extension');
}

if (require.main === module) {
  demonstrateAgentFlow().catch(console.error);
}

export { demonstrateAgentFlow, exampleAgentCard };
