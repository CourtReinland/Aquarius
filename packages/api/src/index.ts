// Load packages/api/.env if present (keys for Blue/legal generation; gitignored)
try {
  process.loadEnvFile(new URL('../.env', import.meta.url).pathname);
} catch {
  /* no .env — rely on exported shell env */
}

import { serve } from '@hono/node-server';
import { assertProductionAuthSecret } from './lib/env.js';
import app from './app.js';

assertProductionAuthSecret();

const port = Number(process.env.PORT) || 3001;

console.log(`Aquarius API running on port ${port}`);
console.log(`  Health:     http://localhost:${port}/health`);
console.log(`  Legal:      http://localhost:${port}/api/legal/templates`);
console.log(`  Communities: http://localhost:${port}/api/communities`);
console.log(`  Agents:     http://localhost:${port}/api/agents`);
console.log(`  Auth:       http://localhost:${port}/api/auth/challenge`);

serve({ fetch: app.fetch, port });

export default app;
