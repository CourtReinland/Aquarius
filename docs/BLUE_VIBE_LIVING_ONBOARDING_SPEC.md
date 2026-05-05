# Blue onboarding and vibe living spec

> Working product spec for simplifying Aquarius onboarding and agent generation.
> This document sits beside `AGENT_FOUNDRY_PLAN.md`. It does not replace the passport, wallet, runtime, or agent-foundry specs. It defines the first user experience that hides that machinery until the user needs it.

## Goal

Aquarius should feel simple enough for a displaced knowledge worker to use on a bad week.

The first session should not start with dashboards, governance nouns, crypto configuration, agent permission matrices, or editable passport internals. It should start with Blue, a friendly guide who helps the user either found a community or join one.

The advanced dashboard still matters. It becomes the under-the-hood layer. The first-run experience should be closer to setup with a caring guide than configuration with a form.

## The n-of-1 user

The first user is a recently unemployed knowledge worker.

They may be anxious, cash-constrained, and overloaded. They may have skills but no stable container for applying them. They need a path from disorientation to a small functioning community that can help them survive, coordinate, earn, and belong.

For this user, Aquarius is not introduced as a DAO factory. It is introduced as a way to start vibe living.

## Vibe living

Vibe living is the product primitive Aquarius is trying to make legible.

It combines:

- club membership: belonging, status, rituals, mutual expectations
- condo or neighborhood association: shared rules, shared property, local responsibilities
- cooperative or company ownership: rights, shares, value creation, dividends or upside
- agent-assisted operations: AI members that help the community function before it has a large human staff

The promise is not "make a DAO." The promise is "set up a small living/economic loop with people and agents who help you stabilize."

## Product maxim

Computers should be as simple to use as a toaster.

Aquarius should apply that maxim this way:

- Show one friendly interface first.
- Ask one question at a time.
- Prefer defaults that are good enough.
- Hide expert controls until the user asks for them.
- Let Blue explain what matters in plain language.
- Let the user start with a working community, then edit details later.

## Musk algorithm applied

### 1. Question requirements

Current agent creation asks the user to understand too much too early:

- origin mode
- role preset
- personality sliders
- body and portrait settings
- memory policy
- permission class
- capabilities
- economics
- advanced prompt template
- passport/runtime consequences

Most of these are real requirements for the system. They are not all requirements for the first screen.

The first-run requirement is smaller:

A user should be able to open Aquarius, meet Blue, choose Found Community or Join Community, and get to a functioning community setup path in under a minute.

Everything else can be defaulted, inferred, postponed, or moved under Advanced.

### 2. Delete

Delete from the initial path:

- raw prompt editing
- visible origin taxonomy beyond Found or Join
- visible clone/hire/import/template choices
- personality sliders
- detailed body controls
- permission class labels
- capability checklists
- memory policy names
- wallet storage settings
- fee/revenue settings
- public passport vocabulary
- A2A/MCP/runtime endpoint vocabulary
- dashboard-wide option panels

These are not removed from the product. They move behind:

- Advanced
- Review details
- Edit later
- Agent settings
- Community settings

### 3. Simplify and optimize

Replace the initial agent/community creation experience with Blue-led setup.

Blue asks:

"Hi, I'm Blue. I'm here to help you get set up. Would you like to found a community or join an existing one?"

The first screen has two choices:

1. Found community
2. Join community

If the user chooses Join community:

- show QR scanner
- allow invite link/code fallback
- explain in one line: "Scan an invite from an existing Aquarius community."

If the user chooses Found community:

Blue runs a short setup wizard:

1. Name the community.
2. Choose its survival focus.
3. Accept a starter charter.
4. Invite financial agents.
5. Set up the hab survival loop.
6. Invite humans.
7. Enter the simple dashboard.

### 4. Accelerate

The first useful outcome should arrive fast:

- The user can create a community with defaults.
- The community receives a starter charter automatically.
- The community gets at least one financial agent offer immediately.
- The user sees what to do next.

The first session should not require the user to understand all governance, agent, or crypto details.

### 5. Automate

Blue should fill in defaults:

- charter
- first roles
- first financial agent shortlist
- starter permissions
- starter memory policy
- starter community icon/theme
- survival-loop checklist
- invite copy

Blue should ask for confirmation before creating anything with legal, financial, or on-chain weight, but she should not ask the user to configure every underlying field.

## Blue

Blue is the main OS interface for first-run Aquarius.

She is not just a mascot. She is the visible shell over the app's configuration depth.

### Role

Blue should:

- guide setup
- reduce anxiety
- explain choices in plain language
- choose safe defaults
- invite the right agents at the right time
- help the user understand their community as a living/economic loop
- expose advanced controls only when asked

### First line

"Hi, I'm Blue. I'm here to help you get set up. Would you like to found a community or join an existing one?"

Primary buttons:

- Found community
- Join community

### Visual direction

Blue can begin as anime-adjacent, in the broad emotional lane of xAI's Ani, but she should feel more like a calm guide than a seductive companion.

Initial direction:

- late-teen/young-adult coded but clearly adult
- blue-black hair or blue highlights
- soft cyberpunk / civic steward aesthetic
- warm eyes, expressive face
- simple outfit that reads as guide, concierge, or community steward
- no heavy sexuality in default app context
- emotionally alive but not chaotic
- trustworthy enough for money/community setup

Blue should be friendly enough to lower stress, but serious enough to guide legal, financial, and community decisions.

### Voice

Blue's voice should be short, warm, and practical.

Good:

"We can keep this simple. I'll set up safe defaults and you can edit everything later."

Bad:

"Welcome to the decentralized autonomous agentic community formation portal."

## First-run information architecture

The primitive app shell should feel like a slim mobile OS with one main interface: Blue.

The user should not begin in a tabbed dashboard. The dashboard appears after setup, and even then Blue remains the front door.

### Initial states

1. New user, no community
   - show Blue setup
   - Found community / Join community

2. User has invite
   - show Blue plus QR scanner
   - allow paste invite code/link

3. User already belongs to a community
   - show Blue home
   - one primary next action
   - dashboard available as secondary

4. Advanced user
   - can open dashboard/settings directly
   - can expose full configuration

## Found community path

### Step 1: name

Blue asks:

"What should we call your community?"

Fields:

- community name
- optional one-line vibe

Default if skipped:

- "My first Aquarius community"

### Step 2: survival focus

Blue asks:

"What should this community help you stabilize first?"

Choices:

- Earn income
- Trade/invest carefully
- Housing or shared living
- Mutual aid
- Build a project
- Learn/retrain
- Something else

This choice should drive defaults for agents, charter language, and next actions.

### Step 3: starter charter

Blue says:

"I'll start you with a simple charter. It protects members, keeps money actions gated, and lets the community edit rules later."

User choices:

- Use starter charter
- Preview
- Advanced edit

Default:

Use starter charter.

Charter should be generally acceptable:

- members owe honesty and basic respect
- treasury actions require visible approval
- agents cannot spend or sign without policy
- members can propose edits later
- records should be public where appropriate and private where necessary
- the community can invite agents and humans
- emergency pause exists for safety

### Step 4: invite financial agents

Immediately after founding the community, Blue asks:

"Every community needs a financial basis. Do you want me to invite a starter finance agent?"

Preselected agents:

1. Work scout
   - helps find work, clients, grants, bounties, partnerships
   - safe capabilities: research, draft outreach, track applications
   - risky capabilities off by default

2. Treasury steward
   - explains balances and cashflow
   - prepares budgets and proposals
   - cannot spend without human approval

3. Trading analyst
   - watches markets and explains risk
   - can draft trades
   - cannot execute trades by default

Recommended default for the first user:

- Work scout selected
- Treasury steward selected
- Trading analyst optional and clearly marked higher risk

The current detailed Agent Foundry should become the advanced editor behind these preselected offers.

### Step 5: hab setup

Blue asks:

"Now let's set up your hab: the basic survival loop for this community."

Hab means the minimal living/economic loop that keeps the community alive.

Use the pizza machine framework:

- inputs: money, food, shelter, internet, tools, skills, members
- machine: routines, roles, agents, rules, shared work
- outputs: income, meals, stable housing, mutual aid, learning, shared upside
- feedback: weekly check-in, treasury review, needs list, proposal queue

Initial UI should show this as a simple checklist, not a diagram-heavy operations tool.

Starter checklist:

- What do we need this week?
- What can we sell or earn?
- What bills or risks are urgent?
- Who can help?
- Which agents should watch the loop?

### Step 6: invite humans

After agents and hab basics, Blue asks:

"Do you want to invite people now, or keep building privately first?"

Choices:

- Invite people
- Keep private for now

Invite people path:

- QR code
- invite link
- short explanation generated by Blue
- role suggestions: founder, member, advisor, contributor, resident

## Join community path

If the user chooses Join community:

1. Show QR scanner.
2. Allow paste invite link/code.
3. Blue explains the community in plain language before joining.
4. Show what rights and responsibilities the invite grants.
5. Confirm join.

The join path should not expose Foundry controls unless the invite includes agent setup duties.

## Agent generation simplification

The existing `CreateAIAgent` flow should become two layers.

### Layer 1: guided invite

This is what most users see first.

Blue presents agents as helpful people with jobs:

- "Work scout"
- "Treasury steward"
- "Trading analyst"

Each card should show:

- what they help with
- what they are allowed to do
- what they are not allowed to do
- one primary button: Invite
- one secondary link: Customize

No raw capabilities, prompts, memory modes, wallet policies, or passport fields should appear on the card.

### Layer 2: advanced foundry

This is the current dashboard-style configuration.

It remains available under Customize / Advanced.

It includes:

- origin
- role preset
- personality
- body
- permissions
- memory policy
- economics
- prompt template
- passport preview
- signing/wallet policy
- runtime status

The advanced layer should be treated as a power-user editor, not the default creation experience.

## Starter financial agents

### Work scout

Purpose:

Help the community find work and income.

Default capabilities:

- chat
- research opportunities
- draft proposals and outreach
- track leads
- generate public posts

Default restrictions:

- cannot sign contracts
- cannot spend funds
- cannot impersonate members
- must label uncertain information

Default memory:

Community memory.

### Treasury steward

Purpose:

Keep the community financially aware.

Default capabilities:

- chat
- read community history
- monitor proposals
- draft budgets
- prepare treasury proposals

Default restrictions:

- cannot transfer funds
- cannot execute trades
- all risky actions require human approval

Default memory:

Officer/community memory, with private member data excluded from public exports.

### Trading analyst

Purpose:

Help the community understand markets and risk.

Default capabilities:

- chat
- market research
- risk summaries
- draft trade proposals

Default restrictions:

- cannot execute trades by default
- cannot manage treasury by default
- requires explicit human approval for any signing request
- should explain downside before upside

Default memory:

Community memory, not personal companion memory.

## Starter charter defaults

The starter charter should be safe enough for a first community and plain enough to read.

Draft principles:

1. The community exists to help members stabilize and create shared upside.
2. Members should act honestly and avoid knowingly harming the community.
3. Treasury actions require visible approval.
4. Agents may advise, draft, remember, and monitor within their role.
5. Agents may not spend, sign, trade, punish, or bind the community unless the community has approved that power.
6. Members may propose edits to the charter.
7. Private personal information should stay private unless a member explicitly makes it public.
8. The community may pause agent powers if safety is at risk.

This charter can later map to existing legal template and bilaw systems.

## What to do with the current Agent Foundry screen

Do not throw it away.

Reframe it:

- current screen becomes Advanced Agent Foundry
- new first-run screen becomes Blue setup
- starter financial agent cards call existing agent creation API with default presets
- Customize opens the current advanced flow with the preset loaded
- Foundry Test Window becomes a developer/advanced monitor, not user-facing first-run UI

## Mobile implementation direction

First mobile slice should create these screens/components:

- `BlueOnboardingScreen`
- `BlueGuideCard`
- `FoundOrJoinChoice`
- `JoinCommunityScannerPlaceholder`
- `FoundCommunitySimpleWizard`
- `StarterAgentInviteCards`
- `HabSetupChecklist`
- `StarterCharterPreview`

Routing:

- New users land on Blue onboarding.
- Existing `/agent-foundry` can stay available for preview and advanced editing.
- Found community flow can reuse existing `FoundCommunityWizard` logic after simplification.
- Agent invite cards should reuse `useAgentCreator` with preset payloads.

## Required defaults behind the simple UI

The simple UI should still create valid rich objects.

For a starter finance agent, hidden defaults should include:

- origin: template
- memory policy: community-memory or clone-safe where appropriate
- permission class: worker or officer
- wallet policy: human approval required
- signing requests: approval-gated
- prompt template: generated from role and charter
- economics: off-chain, not hireable/cloneable by default unless user opts in
- passport: public fields only
- runtime: pending orchestrator until connected

The user sees:

"Blue will invite a Work Scout who can find opportunities and draft outreach. It cannot spend money or sign anything."

The system stores the full policy.

## Design rules for this UX

1. One question per screen.
2. Two obvious choices when possible.
3. Use defaults unless the user asks to customize.
4. Advanced controls exist but do not interrupt setup.
5. Money and signing actions always get plain-language warnings.
6. Agents are introduced by job-to-be-done, not by capability matrix.
7. Blue should explain consequences before irreversible actions.
8. The user should be able to reach a functioning community before learning the whole system.

## Success metrics

For the first mobile implementation:

- User can choose Found or Join in one screen.
- Join path reaches QR scanner or placeholder.
- Found path creates or reaches a starter community flow with fewer than six visible decisions.
- User can invite at least one starter financial agent without opening advanced settings.
- Advanced agent settings remain reachable.
- The created agent still uses the existing passport/runtime/persistence model.
- No private prompt, key, or sensitive memory appears in public UI or public passport.

## Open decisions for Court

1. Should Blue be mandatory as the first-run shell, or can power users skip directly to dashboard on first launch?
2. Should the first community be framed around one person stabilizing themselves, or around a small founding group from the start?
3. What is the exact starter charter text we want to ship first?
4. Should Trading analyst be shown in the first three financial agents, or hidden under "more agents" because it introduces financial risk too early?
5. Should Blue be the only default guide character, or should communities eventually choose a different setup guide skin?
6. What does "hab" mean in user-facing copy: do we use the word immediately, or introduce it later as an Aquarius concept?

## Proposed next implementation slice

Build the Blue first-run shell without deleting the current Agent Foundry.

1. Add `BlueOnboardingScreen` as the new mobile entry for new users.
2. Show Blue's greeting and the two choices: Found community / Join community.
3. Implement Join community as QR placeholder plus invite-code field.
4. Implement Found community as a simplified wizard with name, survival focus, starter charter, starter agents, hab checklist, invite humans.
5. Add starter agent cards for Work scout, Treasury steward, and optional Trading analyst.
6. Wire each card to `useAgentCreator` with hidden defaults.
7. Keep "Customize" linking to the current `CreateAIAgent` advanced flow.
8. Verify mobile typecheck and preview route.

This is the bridge from dashboard-first Aquarius to Blue-first Aquarius.
