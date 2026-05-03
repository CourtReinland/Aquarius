import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { communityRoutes } from './routes/community.js';
import { healthRoutes } from './routes/health.js';
import { legalRoutes } from './routes/legal.js';
import { agentRoutes } from './routes/agents.js';
import { authRoutes } from './routes/auth.js';

export function createAquariusApiApp() {
  const app = new Hono();

  app.use('/*', cors());

  app.get('/', (c) => c.json({
    service: 'aquarius-api',
    status: 'ok',
    message: 'Aquarius API is running. Use the route links below instead of the API root.',
    routes: {
      health: '/health',
      communities: '/api/communities',
      legalTemplates: '/api/legal/templates',
      agents: '/api/agents',
      createAgent: '/api/agents/create',
      authChallenge: '/api/auth/challenge',
    },
  }));

  app.route('/health', healthRoutes);
  app.route('/api/communities', communityRoutes);
  app.route('/api/legal', legalRoutes);
  app.route('/api/agents', agentRoutes);
  app.route('/api/auth', authRoutes);

  return app;
}

export const app = createAquariusApiApp();
