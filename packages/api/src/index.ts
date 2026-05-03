import { serve } from '@hono/node-server';
import { app } from './app.js';

const port = Number(process.env.PORT) || 3001;

console.log(`Aquarius API running on port ${port}`);
console.log(`  Root:       http://localhost:${port}/`);
console.log(`  Health:     http://localhost:${port}/health`);
console.log(`  Legal:      http://localhost:${port}/api/legal/templates`);
console.log(`  Communities: http://localhost:${port}/api/communities`);
console.log(`  Agents:     http://localhost:${port}/api/agents`);
console.log(`  Auth:       http://localhost:${port}/api/auth/challenge`);

serve({ fetch: app.fetch, port });

export default app;
