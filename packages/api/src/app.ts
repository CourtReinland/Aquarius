import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { communityRoutes } from './routes/community.js';
import { healthRoutes } from './routes/health.js';
import { legalRoutes } from './routes/legal.js';
import { agentRoutes } from './routes/agents.js';
import { authRoutes } from './routes/auth.js';
import { blueRoutes } from './routes/blue.js';
import { resolveCorsOrigins } from './lib/env.js';

export function createApp() {
  const app = new Hono();
  const allowedOrigins = resolveCorsOrigins();

  app.use(
    '/*',
    secureHeaders({
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'no-referrer',
      // JSON API over mixed local/prod hosts — do not pin HSTS from the API process.
      strictTransportSecurity: false,
    })
  );

  app.use(
    '/*',
    cors({
      origin: (origin) => {
        // Non-browser clients (native mobile, curl) often omit Origin.
        if (!origin) return '';
        return allowedOrigins.includes(origin) ? origin : '';
      },
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Retry-After'],
      maxAge: 600,
    })
  );

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
      blue: '/api/blue',
    },
  }));

  app.route('/health', healthRoutes);
  app.route('/api/communities', communityRoutes);
  app.route('/api/legal', legalRoutes);
  app.route('/api/agents', agentRoutes);
  app.route('/api/auth', authRoutes);
  app.route('/api/blue', blueRoutes);

  return app;
}

/** Alias kept for Agent Foundry discovery tests. */
export const createAquariusApiApp = createApp;

const app = createApp();
export default app;
export { app };
