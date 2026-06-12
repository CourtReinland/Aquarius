import { Hono } from 'hono';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Community announcement registry.
 *
 * The chain is the source of truth for EXISTENCE (CommunityFactory emits
 * CommunityDeployed; every client watches those events). This registry holds
 * the social metadata a contract doesn't: visibility, a founder's pitch, and
 * whether the community is actively seeking members.
 *
 * Local-first today (JSON file beside the API); the same shape can later move
 * to a public indexer or an on-chain registry for cross-network discovery.
 */

export interface CommunityAnnouncement {
  address: string;
  name: string;
  visibility: 'public' | 'unlisted';
  seekingMembers: boolean;
  pitch: string;
  founder: string;
  announcedAt: number;
}

const STORE_PATH = new URL('../../.data/registry.json', import.meta.url).pathname;

function load(): Record<string, CommunityAnnouncement> {
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function save(reg: Record<string, CommunityAnnouncement>) {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(reg, null, 2));
}

let registry = load();

export const communityRoutes = new Hono();

/** Full registry (used by explorers to badge + filter). */
communityRoutes.get('/registry', (c) => {
  return c.json({ registry, total: Object.keys(registry).length });
});

/** One community's announcement. */
communityRoutes.get('/registry/:address', (c) => {
  const a = registry[c.req.param('address').toLowerCase()];
  return a ? c.json(a) : c.json({ error: 'not announced' }, 404);
});

/** Announce a newly founded community (called by the founder's client). */
communityRoutes.post('/announce', async (c) => {
  const body = await c.req.json<Partial<CommunityAnnouncement>>();
  if (!body.address || !/^0x[0-9a-fA-F]{40}$/.test(body.address)) {
    return c.json({ error: 'valid address required' }, 400);
  }
  if (!body.name || typeof body.name !== 'string' || body.name.length > 80) {
    return c.json({ error: 'name required (≤80 chars)' }, 400);
  }
  const ann: CommunityAnnouncement = {
    address: body.address.toLowerCase(),
    name: body.name,
    visibility: body.visibility === 'unlisted' ? 'unlisted' : 'public',
    seekingMembers: body.seekingMembers !== false,
    pitch: typeof body.pitch === 'string' ? body.pitch.slice(0, 280) : '',
    founder: typeof body.founder === 'string' ? body.founder : '',
    announcedAt: Date.now(),
  };
  registry[ann.address] = ann;
  save(registry);
  return c.json(ann, 201);
});

/** Update (e.g. stop seeking members). Founder-gated properly later. */
communityRoutes.patch('/registry/:address', async (c) => {
  const key = c.req.param('address').toLowerCase();
  const existing = registry[key];
  if (!existing) return c.json({ error: 'not announced' }, 404);
  const body = await c.req.json<Partial<CommunityAnnouncement>>();
  if (body.visibility) existing.visibility = body.visibility === 'unlisted' ? 'unlisted' : 'public';
  if (body.seekingMembers !== undefined) existing.seekingMembers = Boolean(body.seekingMembers);
  if (typeof body.pitch === 'string') existing.pitch = body.pitch.slice(0, 280);
  save(registry);
  return c.json(existing);
});
