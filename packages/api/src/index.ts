// Load packages/api/.env if present (keys for Blue/legal generation; gitignored)
try {
  process.loadEnvFile(new URL('../.env', import.meta.url).pathname);
} catch {
  /* no .env — rely on exported shell env */
}

import { serve } from '@hono/node-server';
import { assertProductionAuthSecret } from './lib/env.js';
import { isDatabaseConfigured } from './db/client.js';
import { isIndexerDisabled } from './indexer/env.js';
import { startIndexer } from './indexer/worker.js';
import app from './app.js';

assertProductionAuthSecret();

const port = Number(process.env.PORT) || 3001;

console.log(`Aquarius API running on port ${port}`);
console.log(`  Root:       http://localhost:${port}/`);
console.log(`  Health:     http://localhost:${port}/health`);
console.log(`  Legal:      http://localhost:${port}/api/legal/templates`);
console.log(`  Communities: http://localhost:${port}/api/communities`);
console.log(`  Agents:     http://localhost:${port}/api/agents`);
console.log(`  Auth:       http://localhost:${port}/api/auth/challenge`);
console.log(`  Indexer:    http://localhost:${port}/api/indexer/health`);
console.log(`  Auth store: ${isDatabaseConfigured() ? 'postgres (DATABASE_URL)' : 'memory (no DATABASE_URL)'}`);
console.log(`  Indexer store: ${isDatabaseConfigured() ? 'postgres (DATABASE_URL)' : 'memory (no DATABASE_URL)'}`);

if (!isIndexerDisabled()) {
  startIndexer();
}

serve({ fetch: app.fetch, port });

export default app;
