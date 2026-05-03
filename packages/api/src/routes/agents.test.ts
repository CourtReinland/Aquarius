import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { agentPermissionClassIndex, agentRoutes } from './agents';

function createTestApp() {
  const app = new Hono();
  app.route('/api/agents', agentRoutes);
  return app;
}

describe('agent permission class mapping', () => {
  it('maps passport permission classes to the Community.sol enum order', () => {
    expect(agentPermissionClassIndex('visitor')).toBe(0);
    expect(agentPermissionClassIndex('resident')).toBe(1);
    expect(agentPermissionClassIndex('worker')).toBe(2);
    expect(agentPermissionClassIndex('delegate')).toBe(3);
    expect(agentPermissionClassIndex('officer')).toBe(4);
    expect(agentPermissionClassIndex('sovereign')).toBe(5);
  });
});

describe('agent routes passport creation', () => {
  it('creates an expanded API-hosted agent passport with Agent Foundry defaults and custom fields', async () => {
    const app = createTestApp();

    const response = await app.request('/api/agents/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        communityAddress: '0x0000000000000000000000000000000000000001',
        communityName: 'Cupcake DAO',
        name: 'Luna Treasury Fox',
        role: 'Treasury companion',
        description: 'A warm fox agent that explains community finances.',
        capabilities: ['chat', 'monitor-proposals'],
        promptTemplate: 'Help the community understand treasury proposals.',
        initialFundingEth: '0',
        origin: { mode: 'template', templateId: 'luna-fox-v1' },
        identity: {
          biography: 'Born in the Agent Foundry to make treasury work friendly.',
          pronouns: 'she/her',
          anthropomorphism: 'high',
        },
        embodiment: {
          bodyArchetype: 'fox',
          style: 'storybook watercolor',
          outfit: 'teal treasurer jacket',
        },
        personality: {
          traits: { warmth: 0.92, caution: 0.76 },
          greeting: 'Hi, I am Luna. I will keep the treasury understandable.',
        },
        permissionPolicy: {
          permissionClass: 'delegate',
        },
        economics: {
          hireable: true,
          cloneable: true,
          license: 'CC-BY-NC-4.0',
        },
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body.agent.passport.schemaVersion).toBe('aquarius.agent-passport.v1');
    expect(body.agent.metadataUri).toContain('/passport');
    expect(body.agent.agentCard.schemaVersion).toBe('aquarius.agent-card.v1');

    const passport = body.agent.passport;
    expect(passport.origin).toMatchObject({
      mode: 'template',
      templateId: 'luna-fox-v1',
      parentAgentId: null,
    });
    expect(passport.identity).toMatchObject({
      name: 'Luna Treasury Fox',
      biography: 'Born in the Agent Foundry to make treasury work friendly.',
      pronouns: 'she/her',
      anthropomorphism: 'high',
    });
    expect(passport.embodiment).toMatchObject({
      portraitProvider: 'gemini-nano-banana',
      bodyArchetype: 'fox',
      style: 'storybook watercolor',
      outfit: 'teal treasurer jacket',
    });
    expect(passport.personality.traits.warmth).toBe(0.92);
    expect(passport.capabilities).toMatchObject({
      public: ['chat', 'monitor-proposals'],
      permissionClass: 'delegate',
    });
    expect(passport.wallet.type).toBe('EOA');
    expect(passport.economics).toMatchObject({
      hireable: true,
      cloneable: true,
      license: 'CC-BY-NC-4.0',
      feeMode: 'off-chain',
    });
    expect(passport.runtime.endpoints.passport).toContain('/passport');
  });
});
