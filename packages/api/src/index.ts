import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { communityRoutes } from './routes/community.js';
import { healthRoutes } from './routes/health.js';
import { legalRoutes } from './routes/legal.js';

const app = new Hono();

app.use('/*', cors());

// Routes
app.route('/health', healthRoutes);
app.route('/api/communities', communityRoutes);
app.route('/api/legal', legalRoutes);

const port = Number(process.env.PORT) || 3001;

console.log(`Aquarius API running on port ${port}`);
console.log(`  Health:     http://localhost:${port}/health`);
console.log(`  Legal:      http://localhost:${port}/api/legal/templates`);
console.log(`  Communities: http://localhost:${port}/api/communities`);

serve({ fetch: app.fetch, port });

export default app;
