import { Hono } from 'hono';
import { getIndexerHealth } from '../indexer/worker.js';
import { getIndexerStore } from '../indexer/store.js';

/**
 * Public read API for the on-chain event indexer stub.
 * Communities are public on-chain, so these routes are session-optional.
 */
export const indexerRoutes = new Hono();

indexerRoutes.get('/health', async (c) => {
  return c.json(await getIndexerHealth());
});

indexerRoutes.get('/communities', async (c) => {
  const communities = await getIndexerStore().listCommunities();
  return c.json({
    communities,
    total: communities.length,
  });
});
