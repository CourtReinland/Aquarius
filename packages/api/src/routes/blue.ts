import { Hono } from 'hono';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Blue — the Aquarius companion's brain.
 * POST /api/blue/chat { message, route? } → { reply }
 *
 * Uses Claude when ANTHROPIC_API_KEY is set; the web client falls back to
 * scripted answers when this endpoint is unreachable, so it degrades cleanly.
 */

export const blueRoutes = new Hono();

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
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

blueRoutes.post('/chat', async (c) => {
  try {
    const { message, route } = await c.req.json<{ message: string; route?: string }>();
    if (!message || typeof message !== 'string' || message.length > 2000) {
      return c.json({ error: 'message required (≤2000 chars)' }, 400);
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return c.json({ error: 'no api key configured' }, 503);
    }

    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: BLUE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: route
            ? `[user is on the ${route} screen]\n${message}`
            : message,
        },
      ],
    });

    const reply =
      response.content.find((b) => b.type === 'text')?.text ??
      "I lost my train of thought among the stars — ask me again?";
    return c.json({ reply });
  } catch (e: any) {
    console.error('[blue] chat failed:', e?.message);
    return c.json({ error: 'blue unavailable' }, 502);
  }
});
