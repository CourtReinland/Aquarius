import type { BlueChip } from '../state/blueStore';

/**
 * Blue's scripted brain — her personality and route-aware guidance.
 * When the API is reachable she can also answer free-form questions
 * via Claude (/api/blue/chat); these lines are her local instincts.
 */

export interface ScriptEntry {
  lines: string[];
  short?: string[]; // revisits get one of these instead
  chips?: BlueChip[];
}

export const BLUE_NAME = 'Blue';

export const routeScript: Record<string, ScriptEntry> = {
  '/': {
    lines: [
      "Hey, I'm Blue — your guide to Aquarius. ✨",
      'Out here, communities are worlds: each one has its own charter, currency, and laws — all living on the blockchain.',
      'First things first: you need a wallet. It costs nothing and stays on your device. Want me to walk you through it?',
    ],
    short: ['Welcome back. Ready when you are.', 'Good to see you again. Your passport is on this device.'],
    chips: [
      { label: 'What is a wallet?', reply: "A wallet is your identity out here — a cryptographic keypair only you control. No username, no password, no company in the middle. Your wallet signs everything you do: founding, voting, joining. Tap 'Generate Dev Wallet' and I'll make you one instantly." },
      { label: 'Is this safe?', reply: "On this dev build we're on a local test chain — play money, zero risk. When we go live, your private key never leaves your device. I'll never ask you for it. Nobody legitimate ever will." },
      { label: "Let's go!", action: 'generate-wallet' },
    ],
  },
  '/explorer': {
    lines: [
      'This is the Community Explorer — every world you see is a real community on the chain.',
      'Each planet is generated from its on-chain address, so no two look alike. Tap one to visit, or found your own.',
    ],
    short: ['Scanning the cosmos… all communities up to date.', 'New worlds appear here the moment they touch the chain.'],
    chips: [
      { label: 'Found my own', action: 'go-found' },
      { label: 'How do I join one?', reply: 'Visit any community and request admission — the members (or founders, depending on their bylaws) vote you in. Democracy from day one.' },
    ],
  },
  '/found': {
    lines: [
      "Founding a community is the most powerful thing you can do here. Let's design yours together.",
      "Step 1 is identity: the name, the founders, and the charter style. Don't overthink — bylaws can be amended later by vote.",
    ],
    short: ['Back to the forge. Your world awaits.', "Let's design a world."],
    chips: [
      { label: 'What is a charter?', reply: "The charter is your community's constitution — its founding story and values. You can draft an original or build on templates like the U.S. Constitution or the Magna Carta. Later, I can generate a full legal document from it." },
      { label: 'Fill it for me', action: 'wizard-demo' },
    ],
  },
  '/proposals': {
    lines: [
      'The Proposals Tracker — where decisions are made.',
      'Any eligible member can propose; the community votes; the chain enforces the outcome. No take-backs, no backroom deals.',
    ],
    short: ['Votes in progress. Make your voice count.'],
    chips: [
      { label: 'How does voting work?', reply: 'Each proposal sets its own quorum — 51%, 66%, or 80%. Some proposals also crowdfund: a YES vote can carry ETH with it, and if the proposal passes, the funds execute the plan. If it fails, everyone is refunded.' },
    ],
  },
  '/banking': {
    lines: [
      'Banking Setup — this is where your community designs its economy.',
      'Austrian style is strict: fixed supply, no leverage. Keynesian allows fractional reserve up to a ratio you choose. There is no wrong answer — only what fits your people.',
    ],
    short: ['The economy bends to your design.'],
    chips: [
      { label: 'Austrian vs Keynesian?', reply: 'Austrian: tokens are scarce, like digital gold — nobody can mint more without a vote. Keynesian: the community bank can extend credit beyond reserves, growing the money supply with the economy. Pick strict if you value predictability; fractional if you want growth dynamics.' },
    ],
  },
  '/memberships': {
    lines: [
      'Your memberships — every world you belong to, every share you hold, every role you play.',
    ],
    short: ['Your portfolio of worlds.'],
  },
};

export const eventScript = {
  walletCreated: (addr: string) => [
    `Beautiful. Your wallet is alive: ${addr.slice(0, 6)}…${addr.slice(-4)}. That address is yours across every community in Aquarius.`,
    'Now — shall we explore the cosmos, or found your own world?',
  ],
  walletImported: (addr: string) => [
    `Welcome back, ${addr.slice(0, 6)}…${addr.slice(-4)}. Passport verified. ✨`,
  ],
  deployStarted: () => 'Broadcasting your community to the blockchain… signing the genesis transaction now.',
  deploySuccess: (name: string) =>
    `IT'S ALIVE! ${name} exists on the blockchain — permanently, unstoppably, yours. Congratulations, founder. 🪐`,
  deployFailed: (err: string) =>
    `Hmm, the chain rejected that: "${err}". Check that the local chain is running and your wallet has gas — then we try again. I'm not going anywhere.`,
  voteCast: () => 'Vote cast and sealed on-chain. Your voice is now part of the permanent record.',
  proposalCreated: () => 'Proposal published! The community clock is ticking — time to rally your voters.',
  wizardStep2: () => 'Step 2: governance. Who may join, who may be exiled, and what share of votes carries a decision. This is the soul of your bylaws.',
  wizardStep3: () => 'Last step: legal grounding. Optionally nest your community inside a real-world legal framework — useful when your world touches the old one.',
};

/** Local fallbacks when the Claude-powered API is unreachable. */
export const faqFallback: Array<{ match: RegExp; answer: string }> = [
  { match: /wallet|key|login|password/i, answer: 'Your wallet is your identity: a keypair generated on your device. The private key signs your actions; the public address is your name on-chain. I never see your key — neither does anyone else.' },
  { match: /charter|constitution/i, answer: "The charter is your community's founding document. Pick a style in the Found wizard and I can generate a full legal text from your parameters." },
  { match: /token|currency|money|bank/i, answer: 'Every community can mint its own ERC-20 currency with banking rules — strict Austrian or fractional Keynesian. Configure it in Banking Setup.' },
  { match: /vote|proposal|quorum/i, answer: 'Proposals are created by eligible members and decided by on-chain vote within a time window. Quorum and percentage come from your bylaws. Passing proposals can execute funds or even deploy contracts automatically.' },
  { match: /alliance/i, answer: 'Alliances link two communities: shared benefits, mutual rights, inter-community trade. Either side can propose; both must approve; either can dissolve by vote.' },
  { match: /agent|ai member/i, answer: 'AI agents can be registered members of a community (ERC-8004 style) — with their own wallets and agent cards. Humans and AIs, governing together.' },
  { match: /aquarius|this app|what is/i, answer: 'Aquarius is what Bitcoin is to money — but for community. Found a world with friends: charter, currency, governance, institutions. All on-chain, all yours.' },
];

export function localAnswer(q: string): string {
  for (const { match, answer } of faqFallback) {
    if (match.test(q)) return answer;
  }
  return "That one's beyond my local memory — when my uplink to the API is live I can think much deeper. Try asking about wallets, charters, tokens, votes, or alliances.";
}
