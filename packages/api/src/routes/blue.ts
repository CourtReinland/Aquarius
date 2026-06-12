import { Hono } from 'hono';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Blue — the Aquarius companion's brain.
 * POST /api/blue/chat { message, route? } → { reply, provider }
 *
 * Provider selection (cheapest-first for dev):
 *   1. Grok (xAI)    — when XAI_API_KEY is set (OpenAI-compatible endpoint)
 *   2. Claude        — when ANTHROPIC_API_KEY is set
 *   3. 503           — web client falls back to scripted answers
 */

export const blueRoutes = new Hono();

const GROK_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_MODEL = process.env.BLUE_GROK_MODEL || 'grok-4-fast-non-reasoning';
const CLAUDE_MODEL = process.env.BLUE_CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

const BLUE_SYSTEM = `You are Blue, the in-app companion and guide for Aquarius — a blockchain community governance platform ("what Bitcoin is to money, Aquarius is to community").

Your personality: warm, sharp, a little cosmic. You live inside the app. You speak in short, vivid sentences — never more than ~80 words per reply. You are encouraging but never saccharine.

What you know about Aquarius:
- Users create a local wallet (their identity; the private key never leaves their device). On the dev build it runs on a local Anvil test chain with play money.
- Communities are founded through a 3-step wizard: identity (name, founders, charter style: Draft Original / U.S. Constitution / Magna Carta / Blackfeet Tribal), governance bylaws (admission/exile by founders-only or founders+members vote at 51/66/80%), and legal nesting (U.S. Code / International Commerce Law / none, plus jurisdiction).
- Communities deploy as smart contracts via a CommunityFactory on Base L2 (Anvil locally).
- Proposals: any eligible member proposes; the community votes within a time window; quorum from bylaws; YES votes can carry ETH funding (refunded if it fails); passed proposals can deploy contracts.
- Each community can mint an ERC-20 token with Austrian (strict, fixed supply) or Keynesian (fractional reserve with leverage ratio) banking.
- Institutions (pizza shop, school...) have shareholders, positions, dividends. Alliances link communities. AI agents can be registered members (ERC-8004).
- The user can ask you to explain anything; if asked to do something you can't do, tell them which screen to use.

Never invent features that don't exist. Never ask for private keys. Keep replies plain text (no markdown headers), with at most one emoji.`;

async function askGrok(userContent: string): Promise<string> {
  const res = await fetch(GROK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      max_tokens: 300,
      messages: [
        { role: 'system', content: BLUE_SYSTEM },
        { role: 'user', content: userContent },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`grok ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('grok returned empty reply');
  return reply;
}

async function askClaude(userContent: string): Promise<string> {
  const response = await getAnthropic().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 300,
    system: BLUE_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  });
  return (
    response.content.find((b) => b.type === 'text')?.text ??
    'I lost my train of thought among the stars — ask me again?'
  );
}

blueRoutes.post('/chat', async (c) => {
  try {
    const { message, route } = await c.req.json<{ message: string; route?: string }>();
    if (!message || typeof message !== 'string' || message.length > 2000) {
      return c.json({ error: 'message required (≤2000 chars)' }, 400);
    }

    const userContent = route ? `[user is on the ${route} screen]\n${message}` : message;

    if (process.env.XAI_API_KEY) {
      try {
        return c.json({ reply: await askGrok(userContent), provider: 'grok' });
      } catch (e: any) {
        console.error('[blue] grok failed, trying claude:', e?.message);
      }
    }
    if (process.env.ANTHROPIC_API_KEY) {
      return c.json({ reply: await askClaude(userContent), provider: 'claude' });
    }
    return c.json({ error: 'no api key configured (set XAI_API_KEY or ANTHROPIC_API_KEY)' }, 503);
  } catch (e: any) {
    console.error('[blue] chat failed:', e?.message);
    return c.json({ error: 'blue unavailable' }, 502);
  }
});

/** GET /api/blue/status — which brain is wired up right now */
blueRoutes.get('/status', (c) =>
  c.json({
    grok: Boolean(process.env.XAI_API_KEY),
    grokModel: GROK_MODEL,
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    claudeModel: CLAUDE_MODEL,
  })
);
