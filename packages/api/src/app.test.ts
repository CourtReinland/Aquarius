import { describe, expect, it } from 'vitest';
import { createAquariusApiApp } from './app';

describe('Aquarius API discovery', () => {
  it('serves a useful root response instead of a browser 404 on the API port', async () => {
    const app = createAquariusApiApp();

    const response = await app.request('/');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.service).toBe('aquarius-api');
    expect(body.status).toBe('ok');
    expect(body.routes.health).toBe('/health');
    expect(body.routes.agents).toBe('/api/agents');
    expect(body.routes.createAgent).toBe('/api/agents/create');
    expect(body.routes.legalPin).toBe('/api/legal/pin');
    expect(body.routes.indexerHealth).toBe('/api/indexer/health');
    expect(body.routes.indexerCommunities).toBe('/api/indexer/communities');
  });
});
