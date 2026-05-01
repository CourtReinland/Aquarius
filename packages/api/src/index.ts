import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { communityRoutes } from './routes/community.js';
import { healthRoutes } from './routes/health.js';
import { legalRoutes } from './routes/legal.js';
import { agentRoutes } from './routes/agents.js';
import { authRoutes } from './routes/auth.js';

const app = new Hono();

app.use('/*', cors());

// Routes
app.route('/health', healthRoutes);
app.route('/api/communities', communityRoutes);
app.route('/api/legal', legalRoutes);
app.route('/api/agents', agentRoutes);
app.route('/api/auth', authRoutes);

const port = Number(process.env.PORT) || 3001;

console.log(`Aquarius API running on port ${port}`);
console.log(`  Health:     http://localhost:${port}/health`);
console.log(`  Legal:      http://localhost:${port}/api/legal/templates`);
console.log(`  Communities: http://localhost:${port}/api/communities`);
console.log(`  Agents:     http://localhost:${port}/api/agents`);
console.log(`  Auth:       http://localhost:${port}/api/auth/challenge`);

serve({ fetch: app.fetch, port });

export default app;
