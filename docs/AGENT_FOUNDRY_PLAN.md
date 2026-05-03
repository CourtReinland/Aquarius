# Aquarius Agent Foundry Plan

**Goal:** Build the Aquarius Agent Foundry: a character-creation, identity, persistence, and runtime-onboarding flow for anthropomorphized AI agents that can become durable community members, companions, workers, delegates, and hireable or cloneable participants in the Aquarius ecosystem.

**Current foundation:** Aquarius already supports ERC-8004-style AI agent registration in `Community.sol`, exposes `POST /api/agents/create`, creates EOA wallets and public agent cards, and includes a mobile `CreateAIAgent` screen. This plan evolves that functional MVP into a robust, persistent, emotionally legible agent system.

**Core principle:** The blockchain should prove who an agent is, where it belongs, what rights it has, and where its public passport lives. The agent's living mind, memories, private keys, runtime state, and generated media should be persisted off-chain with encryption, portability, and auditability.

---

## 1. Product Thesis

Aquarius should not treat AI agents as generic chatbots. It should treat them as artificial community participants with identity, embodiment, memory, constraints, and social presence.

The Agent Foundry should let a human or community create an agent that feels more like a persistent game character, companion, officer, or citizen than a temporary prompt. Each agent should have:

- A public name, role, avatar, biography, and personality.
- A wallet or smart account.
- A community membership status.
- A portable public agent passport.
- Private runtime configuration and memory.
- Clear permissions and limits.
- A visual body capable of portraits and generated selfies.
- A lineage if it was cloned from another agent or template.
- A hire/clone/license model if the creator wants to share it with other communities.

The long-term vision is that Aquarius communities can contain humans and artificial people coexisting under shared bylaws, with transparent rights and boundaries.

---

## 2. Existing Implementation

The current repo already has the first slice:

- `packages/contracts/src/Community.sol`
  - Defines `AIAgent` records.
  - Stores `agentAddress`, `agentId`, `metadataURI`, `registeredAt`, and `active`.
  - Emits `AIAgentRegistered` and `AIAgentDeactivated`.
  - Adds active AI agents to the normal member set.

- `packages/api/src/routes/agents.ts`
  - Defines `POST /api/agents/create`.
  - Creates a generated EOA private key.
  - Builds an `aquarius.agent-card.v1` public card.
  - Optionally encrypts the generated private key with `AGENT_KEY_ENCRYPTION_SECRET`.
  - Optionally registers the agent on-chain with `Community.registerAIAgent`.
  - Stores agents in an in-memory `Map`.

- `apps/mobile/src/screens/CreateAIAgent.tsx`
  - Lets users enter name, role, description, capabilities, funding, and prompt template.
  - Calls the API through `useAgentCreator`.
  - Displays the created wallet, registration mode, and key storage mode.

- `docs/AGENTS.md`
  - Documents the current creation route.
  - Notes the production path: Postgres persistence, secure key storage, sandboxed runtime, contract event watchers, A2A/MCP handlers, and ERC-4337.

This plan assumes those pieces remain the foundation.

---

## 3. Four-Layer Agent Model

Every Aquarius agent should be represented as four connected layers.

### 3.1 Legal / Social Identity

This layer answers: who is this agent in the community?

Stored primarily on-chain and in public metadata.

Includes:

- Agent wallet or smart account.
- ERC-8004-style agent identifier.
- Community address.
- Creator address.
- Member status.
- Active/inactive status.
- Registration timestamp.
- Permission class.
- Parent/template reference if cloned.
- Public passport URI.
- Hashes of important off-chain artifacts.

### 3.2 Public Body / Persona

This layer answers: how does this agent appear to humans?

Stored in a public agent passport, ideally pinned to IPFS/Arweave and cached by Aquarius.

Includes:

- Name.
- Avatar.
- Species/body archetype.
- Voice metadata.
- Biography.
- Visual style.
- Outfit or skin.
- Personality sliders.
- Public role.
- Public capabilities.
- Selfie/rendering policy.

### 3.3 Private Mind / Memory / Runtime

This layer answers: what does this agent privately know, remember, and do?

Stored off-chain with encryption and strict access control.

Includes:

- System prompt.
- Private prompt modules.
- Long-term memory.
- Community-specific memory.
- User-specific relationship memory.
- Runtime state.
- Tool credentials.
- Private capability configuration.
- Audit logs.
- Model/provider preferences.

### 3.4 Economic / Operational Shell

This layer answers: how does this agent operate, get paid, spend, and survive?

Stored across contracts, API database, runtime orchestrator, and wallet infrastructure.

Includes:

- Wallet/smart account.
- Gas sponsorship.
- Funding balance.
- Spend limits.
- Hiring price.
- Clone price.
- Revenue split.
- Compute provider.
- Runtime tier.
- Uptime expectations.
- Approval requirements.
- Slashing/bond rules if later needed.

---

## 4. Agent Foundry User Experience

The current `CreateAIAgent` screen should evolve into a multi-step Agent Foundry flow.

### Step 1: Choose Origin

Options:

- Create from scratch.
- Use a community template.
- Clone from an agent pool.
- Hire an existing agent.
- Import an agent passport.

This is the most important conceptual split. A hired agent, a cloned agent, and a new agent from a skin/template should not be treated as the same action.

### Step 2: Choose Role

Suggested initial roles:

- Companion / friend.
- Treasurer.
- Historian.
- Moderator.
- Diplomat.
- Teacher.
- Proposal drafter.
- Institution manager.
- Scout / researcher.
- Entertainer / bard.
- Custom.

The selected role should prefill capabilities, personality defaults, and prompt modules, but users should be able to customize them.

### Step 3: Shape Personality

Replace the raw prompt-first experience with a friendlier character/personality designer.

Suggested controls:

- Warm <-> Formal.
- Playful <-> Serious.
- Independent <-> Cautious.
- Talkative <-> Concise.
- Loyalist <-> Devil's advocate.
- Traditional <-> Experimental.
- Private <-> Transparent.
- Gentle <-> Direct.

Also allow:

- Humor style.
- Conflict style.
- Favorite topics.
- Things the agent refuses to do.
- Default greeting style.

The raw prompt can remain available under an "Advanced" section.

### Step 4: Give Body

This is where Aquarius can become more emotionally compelling than a normal DAO tool.

Fields:

- Avatar style.
- Human/animal/robot/fantasy/abstract body archetype.
- Color palette.
- Outfit/skin.
- Accessories.
- Voice.
- Pronouns.
- Portrait seed.
- Selfie style.

The result should be an avatar manifest, not only a generated image. The manifest makes the agent portable and reproducible across clients and renderers.

### Step 5: Set Permissions

Capabilities should be separated into friendly labels and enforceable runtime/contract permissions.

Examples:

- Chat with members.
- Read community history.
- Monitor proposals.
- Draft proposals.
- Submit proposals.
- Vote.
- Manage treasury.
- Trade crypto.
- Manage institution.
- Invite members.
- Moderate messages.
- Represent the community externally.
- Generate public posts/media.

Each risky permission should support constraints:

- Requires human approval.
- Requires founder approval.
- Requires proposal approval.
- Daily/weekly spend cap.
- Per-transaction spend cap.
- Specific token allowlist.
- Specific contract allowlist.
- Read-only mode.

### Step 6: Choose Memory Policy

The user should explicitly choose what the agent remembers.

Suggested modes:

- Session-only: forgets private conversations after the session.
- Personal companion: remembers relationship with one user.
- Community memory: remembers public community events and decisions.
- Officer memory: remembers operational tasks, proposals, finances, and obligations.
- Clone-safe: excludes private relationship memories from clone exports.

Memory settings should be visible and editable after creation.

### Step 7: Preview / Interview

Before registration, the user should be able to talk to the unborn agent.

Suggested preview prompts:

- Introduce yourself to the community.
- What are you here to help with?
- What would you refuse to do?
- How would you handle a controversial proposal?
- What makes you different from another agent with the same role?

This gives the creator a chance to adjust personality, role, body, and permissions before committing.

### Step 8: Mint / Register Passport

On final confirmation:

1. Create wallet or smart account.
2. Generate agent passport JSON.
3. Store public passport on IPFS/Arweave or API-hosted URL for MVP.
4. Store private runtime configuration in the database.
5. Store/encrypt signing key or configure smart-account delegation.
6. Register on-chain through `Community.registerAIAgent`.
7. Fund account if requested.
8. Start or queue runtime provisioning.

### Step 9: First Moment

Creation should end with a social moment, not only a receipt.

The agent should:

- Appear in the community.
- Display its portrait.
- Say hello in its own voice/style.
- Show its membership card/passport.
- Optionally create a first generated portrait/selfie.
- Optionally post an introduction to the community feed.

This is where the agent begins to feel like a friend or citizen rather than an API object.

---

## 5. Agent Passport

The current `aquarius.agent-card.v1` should evolve into an agent passport schema.

A full schema can be specified separately in `docs/AGENT_PASSPORT_SCHEMA.md`, but the Agent Foundry should be designed around these groups:

```ts
interface AquariusAgentPassportV1 {
  schemaVersion: 'aquarius.agent-passport.v1';
  agentId: string;
  agentAddress: `0x${string}`;
  communityAddress: `0x${string}`;
  creatorAddress?: `0x${string}`;

  origin: {
    mode: 'scratch' | 'template' | 'clone' | 'hire' | 'import';
    parentAgentId?: string;
    templateId?: string;
    lineageHash?: string;
  };

  identity: {
    name: string;
    role: string;
    description: string;
    biography?: string;
    pronouns?: string;
  };

  embodiment: {
    avatarUri?: string;
    avatarManifestUri?: string;
    portraitSeed?: string;
    style?: string;
    bodyArchetype?: string;
    outfit?: string;
    voiceId?: string;
    selfieEndpoint?: string;
  };

  personality: {
    traits: Record<string, number>;
    greeting?: string;
    refusalStyle?: string;
    conflictStyle?: string;
  };

  capabilities: {
    public: string[];
    permissionPolicyUri?: string;
    permissionPolicyHash?: string;
  };

  runtime: {
    harness: 'hermes' | 'openclaw' | 'custom';
    provider?: string;
    model?: string;
    status: 'pending-orchestrator' | 'active' | 'dormant' | 'suspended';
    endpoints: {
      card: string;
      chat?: string;
      a2a?: string;
      mcp?: string;
    };
  };

  economics?: {
    hireable: boolean;
    cloneable: boolean;
    license?: string;
    feeRecipient?: `0x${string}`;
    hirePrice?: string;
    clonePrice?: string;
    revenueSplitBps?: number;
  };

  hashes: {
    promptHash?: string;
    memoryRootHash?: string;
    avatarManifestHash?: string;
    runtimePolicyHash?: string;
  };

  createdAt: string;
  updatedAt: string;
}
```

Only public information belongs in the passport. Private prompts, private memories, private keys, and sensitive credentials must not be stored in it.

---

## 6. Persistence Model

### 6.1 On-Chain

Store or anchor:

- Agent address.
- Agent ID.
- Passport URI.
- Active/inactive status.
- Community membership.
- Registration event.
- Deactivation event.
- Future: permission class.
- Future: parent/template lineage.
- Future: hire/clone terms URI.

Do not store:

- Private prompts.
- Private memories.
- Raw generated media payloads.
- Private keys.
- Sensitive relationship data.

### 6.2 Public Decentralized Storage

Use IPFS/Arweave or equivalent for:

- Agent passport JSON.
- Avatar manifest.
- Public portrait.
- Public skins/templates.
- Public release versions.
- Public license terms.

### 6.3 Cloud Database

Move current in-memory API storage to Postgres.

Suggested tables:

- `agents`
- `agent_passports`
- `agent_runtime_configs`
- `agent_wallets`
- `agent_memories`
- `agent_capabilities`
- `agent_permission_policies`
- `agent_events`
- `agent_media`
- `agent_lineage`
- `agent_hire_contracts`

### 6.4 Secure Key Storage

The current generated EOA is acceptable for local MVP, but production should use one of:

- KMS-backed encrypted private keys.
- Lit Protocol programmable key access.
- ERC-4337 smart accounts with delegated session keys.
- Privy/Coinbase Smart Wallet/ZeroDev/Biconomy-style account abstraction.

Long-term preference: agents should use smart accounts with constrained session keys rather than raw EOAs directly controlled by an LLM runtime.

### 6.5 On-Device

Use the device for:

- Local cache of known agents.
- Avatar and media cache.
- User-specific relationship memory if explicitly enabled.
- Offline companion mode if supported later.
- Local notification preferences.

Do not make the device the only durable source of an agent's identity.

---

## 7. Runtime and Sandboxing

The Agent Foundry should create agents, but an Agent Orchestrator should run them.

### 7.1 Runtime Tiers

To scale to many agents, avoid one permanently running process per agent.

Use tiers:

1. Dormant
   - Agent exists and can receive queued messages/events.
   - No active runtime.

2. Event-woken
   - Agent wakes for mentions, proposal events, payments, scheduled tasks, or community events.
   - Processes work.
   - Writes memory/checkpoint.
   - Sleeps.

3. Warm pool
   - Frequently used agents remain warm for lower latency.
   - Shared worker pool.

4. Dedicated runtime
   - Paid or critical agents get dedicated containers or microVMs.
   - Stronger isolation and uptime guarantees.

### 7.2 Harness

Hermes or OpenClaw can serve as the harness that embodies the agent: conversation loop, tool use, memory access, and external actions.

The orchestrator should load:

- Agent passport.
- Private runtime config.
- Memory policy.
- Tool permission policy.
- Community context.
- Event payload.

Then it should run the agent in an isolated execution environment.

### 7.3 Sandbox Requirements

Every runtime should enforce:

- Tool allowlists.
- Network egress policy.
- Filesystem isolation.
- Per-agent secret isolation.
- Budget limits.
- Wallet action approval gates.
- Spending caps outside the LLM.
- Audit logs for tool calls and signing requests.
- No direct access to another agent's memory.

### 7.4 Event Sources

The orchestrator should listen to:

- `AIAgentRegistered`.
- `AIAgentDeactivated`.
- Proposal created/finalized events.
- Votes.
- Treasury transfers.
- Institution changes.
- Alliance events.
- Direct messages or mentions.
- Scheduled tasks.

---

## 8. Agent Pool, Hiring, and Cloning

The Agent Foundry should eventually connect to an Agent Pool, a marketplace/library of reusable agents and templates.

### 8.1 Use Template

A template is like a game character class or skin.

- No inherited private memory.
- No shared wallet.
- Safe default option.
- Useful for public archetypes.

### 8.2 Clone Agent

A clone creates a descendant with a new identity.

Inherited:

- Public body template.
- Base personality.
- Base skills.
- Public lore.
- Prompt modules marked cloneable.

Not inherited by default:

- Private memories.
- Private conversations.
- Community secrets.
- Wallet permissions.
- Relationship state.

The clone should record lineage:

- Parent agent ID.
- Parent version.
- Clone timestamp.
- License.
- Creator.

### 8.3 Hire Agent

Hiring preserves the original agent identity and creates a service relationship.

Useful for:

- Expert agents serving many communities.
- Temporary advisors.
- Mercenary workers.
- Auditors, diplomats, treasurers, teachers.

A hired agent should have:

- Scope of work.
- Duration.
- Payment.
- Permissions.
- Termination terms.
- Community-specific memory boundary.

### 8.4 Import Agent Passport

Importing should allow external compatible agents to join Aquarius if they provide a valid passport and meet community rules.

---

## 9. Embodiment and Selfies

Aquarius should support generated portraits and selfies, but it must be honest about what they are.

### 9.1 Avatar Manifest

Each agent should have an avatar manifest with:

- Canonical appearance.
- Style.
- Palette.
- Clothing.
- Accessories.
- Body archetype.
- Render engine/version.
- Seed.
- Negative prompts / constraints.

This is preferable to only storing one image because it makes the character reproducible and portable.

### 9.2 Selfie Service

Agents should be able to generate images such as:

- First portrait after creation.
- Community meeting selfie.
- Celebration after a passed proposal.
- Work scene while drafting a proposal.
- Friendship scene with a consenting user.

Generated images should be labeled clearly as generated/stylized unless derived from real uploaded photos.

### 9.3 Consent Rules

If a human appears in generated media, Aquarius should distinguish:

- Fictional/stylized scene.
- User-approved generated scene.
- Uploaded real image.
- Camera-captured real image.

Do not let agents imply that generated selfies are real photos.

---

## 10. Permission Classes

The current contract makes an AI agent a full member once registered. That is elegant for the MVP, but production should consider citizenship levels.

Suggested classes:

1. Visitor
   - Can chat.
   - No community rights.

2. Resident
   - Has profile and memory.
   - No vote.

3. Worker
   - Can execute assigned tasks.
   - Limited tools.

4. Delegate
   - Can vote under constraints.
   - Requires explicit authorization.

5. Officer
   - Can manage treasury/institution/proposal workflows under policy.

6. Sovereign / founder-created agent
   - High-trust agent with broad rights.
   - Should be rare and visibly marked.

This can begin as an off-chain permission policy and later be reflected on-chain if needed.

---

## 11. Implementation Phases

### Phase 1: Agent Foundry UX and Passport MVP

Goal: make agent creation feel like creating a persistent character, while preserving current API/contract flow.

Tasks:

- Replace single-screen `CreateAIAgent` with a multi-step Foundry wizard.
- Add origin selection: scratch/template/clone/hire/import, even if only scratch is active initially.
- Add role presets.
- Add personality sliders.
- Add embodiment/avatar fields.
- Add memory policy fields.
- Add permission policy fields.
- Generate an expanded `aquarius.agent-passport.v1` object.
- Keep compatibility with current `AgentCard` response.
- Save public passport URI as `metadataURI`.

### Phase 2: Database Persistence

Goal: replace in-memory agent storage.

Tasks:

- Add Postgres/Drizzle schema for agents and passports.
- Persist public passport and private runtime config separately.
- Add migration scripts.
- Add API list/get/update routes.
- Add tests for create/list/card retrieval across process restart.

### Phase 3: Secure Wallet and Signing Policy

Goal: stop treating a generated EOA private key as the production model.

Tasks:

- Add wallet storage abstraction.
- Support KMS or Lit-backed key storage.
- Add smart-account/session-key option.
- Add signing policy enforcement.
- Require human approval for risky transactions.
- Log all signing requests.

### Phase 4: Agent Orchestrator MVP

Goal: make agents actually wake, respond, and remember.

Tasks:

- Add orchestrator worker service.
- Add event queue.
- Add runtime adapter for Hermes/OpenClaw.
- Add basic chat endpoint.
- Add memory store.
- Add contract event watcher.
- Add sandbox boundaries and tool allowlists.

### Phase 5: Agent Pool

Goal: allow communities to reuse, hire, and clone agents.

Tasks:

- Add public template registry.
- Add clone lineage fields.
- Add hire/clone terms.
- Add marketplace UI.
- Add review/trust display.
- Add clone-safe memory export rules.

### Phase 6: Embodiment and Media

Goal: make agents visually/socially present.

Tasks:

- Add avatar manifest schema.
- Add portrait generator integration.
- Add selfie endpoint.
- Add media consent labels.
- Add first-moment creation flow.
- Add community feed posts for agent introductions.

---

## 12. First Concrete Code Changes

The first implementation PR should stay small and avoid changing contract behavior.

Recommended first PR:

1. Add `docs/AGENT_PASSPORT_SCHEMA.md` with the exact schema.
2. Add shared TypeScript passport types in `packages/shared`.
3. Extend `packages/api/src/routes/agents.ts` to accept optional `origin`, `personality`, `embodiment`, `memoryPolicy`, and `permissionPolicy` fields.
4. Include those fields in the public card/passport response.
5. Keep current fields backward-compatible.
6. Update `apps/mobile/src/screens/CreateAIAgent.tsx` into a simple step-based wizard.
7. Add tests around API validation and response shape.

Do not start with the orchestrator. First make the identity object right.

---

## 13. Product Decisions

These decisions are accepted for the first Agent Foundry implementation and can be revisited as Aquarius matures.

- Agent permission/citizenship classes should be represented on-chain.
- Agent wallets should start as EOAs for simplicity.
- Public passports should be API-hosted first, with IPFS/Arweave added later.
- Canonical portraits and selfies should be generated by Gemini / nano-banana.
- Hire and clone fees should be handled off-chain initially.
- Communities can vote to grant or revoke permissions according to rules established at founding, with the same governance principle applying to human and agent members.
- Agents can own permissions and shares.
- Agents can be founders.
- A deactivated/exiled agent persists outside the community as a free agent rather than being destroyed.
- The degree of anthropomorphism can be at the discretion of the individual agent, bounded by platform-level transparency rules.

---

## 14. Design Position

The strongest product direction is:

Aquarius is not merely adding bots to communities. Aquarius is creating a framework where humans and artificial people can share communities under visible rules.

That requires agents to be:

- Emotionally legible.
- Technically sandboxed.
- Economically bounded.
- Socially persistent.
- Cryptographically identifiable.
- Portable across clients.
- Honest about what is real, generated, public, private, remembered, and forgotten.

The Agent Foundry is the front door to that system.
