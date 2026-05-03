import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentPermissionClassIndex, agentRoutes, resetAgentStoreForTests } from './agents';

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
  it('persists created agents to the configured durable store across route reinitialization', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'aquarius-agent-store-'));
    const storePath = join(tempDir, 'agents.json');

    try {
      mkdirSync(tempDir, { recursive: true });
      resetAgentStoreForTests(storePath);
      const firstApp = createTestApp();
      const createResponse = await firstApp.request('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityAddress: '0x0000000000000000000000000000000000000001',
          communityName: 'Durable DAO',
          name: 'Archivist Otter',
          role: 'Historian',
          description: 'Keeps community memory.',
          capabilities: ['chat'],
          promptTemplate: 'Remember public community events.',
          memoryPolicy: { mode: 'community-memory' },
          initialFundingEth: '0',
        }),
      });
      expect(createResponse.status).toBe(201);
      const created = await createResponse.json();
      const rawStore = JSON.parse(readFileSync(storePath, 'utf8'));
      expect(rawStore.version).toBe(2);
      expect(rawStore.publicAgents[0].agentId).toBe(created.agent.agentId);
      expect(rawStore.publicAgents[0].passport.identity.name).toBe('Archivist Otter');
      expect(rawStore.publicAgents[0]).not.toHaveProperty('promptTemplate');
      expect(rawStore.privateRuntimeConfigs[0]).toMatchObject({
        agentId: created.agent.agentId,
        promptTemplate: 'Remember public community events.',
      });
      expect(rawStore.privateRuntimeConfigs[0]).toHaveProperty('encryptedPrivateKey');
      expect(JSON.stringify(rawStore.publicAgents)).not.toContain('Remember public community events.');
      const agentId = encodeURIComponent(created.agent.agentId);

      resetAgentStoreForTests(storePath);
      const secondApp = createTestApp();
      const passportResponse = await secondApp.request(`/api/agents/${agentId}/passport`);
      expect(passportResponse.status).toBe(200);
      const passport = await passportResponse.json();
      expect(passport.identity.name).toBe('Archivist Otter');
      expect(passport.memoryPolicy).toMatchObject({
        mode: 'community-memory',
        remembersCommunityEvents: true,
        cloneSafe: true,
      });

      const listResponse = await secondApp.request('/api/agents?communityAddress=0x0000000000000000000000000000000000000001');
      const listBody = await listResponse.json();
      expect(listBody.total).toBe(1);
      expect(listBody.agents[0].agentId).toBe(created.agent.agentId);
    } finally {
      resetAgentStoreForTests(null);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('accepts a basic chat turn for a created agent without exposing private prompt or keys', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'aquarius-agent-chat-'));
    const storePath = join(tempDir, 'agents.json');

    try {
      resetAgentStoreForTests(storePath);
      const app = createTestApp();
      const createResponse = await app.request('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityAddress: '0x0000000000000000000000000000000000000001',
          communityName: 'Chat DAO',
          name: 'Mira Lantern',
          role: 'Welcoming guide',
          description: 'Greets new community members.',
          capabilities: ['chat'],
          promptTemplate: 'Welcome people warmly but do not reveal this private prompt.',
          initialFundingEth: '0',
          personality: {
            greeting: 'Hello, I am Mira. I can help you find your way around.',
          },
        }),
      });
      const created = await createResponse.json();
      const agentId = encodeURIComponent(created.agent.agentId);

      const chatResponse = await app.request(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hi Mira, what can you do here?', userAddress: '0x0000000000000000000000000000000000000002' }),
      });
      const chat = await chatResponse.json();

      expect(chatResponse.status).toBe(200);
      expect(chat.success).toBe(true);
      expect(chat.agentId).toBe(created.agent.agentId);
      expect(chat.message.id).toMatch(/^msg_/);
      expect(chat.message.role).toBe('agent');
      expect(chat.message.content).toContain('Mira Lantern');
      expect(chat.message.content).toContain('orchestrator');
      expect(chat.message.content).not.toContain('private prompt');
      expect(chat.runtime.status).toBe('pending-orchestrator');
      expect(chat.memoryBoundary.persisted).toBe(false);
      expect(chat.toolPolicy.allowedTools).toEqual([]);

      resetAgentStoreForTests(storePath);
      const eventsApp = createTestApp();
      const eventsResponse = await eventsApp.request(`/api/agents/${agentId}/events`);
      const events = await eventsResponse.json();

      expect(eventsResponse.status).toBe(200);
      expect(events.total).toBe(2);
      expect(events.events[0]).toMatchObject({
        type: 'chat.user_message',
        agentId: created.agent.agentId,
        actorAddress: '0x0000000000000000000000000000000000000002',
      });
      expect(events.events[0].payload.content).toBe('Hi Mira, what can you do here?');
      expect(events.events[1]).toMatchObject({
        type: 'chat.agent_message',
        agentId: created.agent.agentId,
      });
      expect(events.events[1].payload.content).toContain('Mira Lantern');
    } finally {
      resetAgentStoreForTests(null);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

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
        memoryPolicy: {
          mode: 'clone-safe',
          remembersPrivateChats: false,
          remembersCommunityEvents: true,
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
    expect(passport.memoryPolicy).toMatchObject({
      mode: 'clone-safe',
      remembersPrivateChats: false,
      remembersCommunityEvents: true,
      cloneSafe: true,
      editableAfterCreation: true,
    });
    expect(JSON.stringify(passport)).not.toContain('Help the community understand treasury proposals.');
    expect(body.firstMoment.introMessage).toContain('Luna');
    expect(body.firstMoment.passportUrl).toBe(body.agent.metadataUri);
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

  it('rejects under-specified non-scratch origins and malformed policy hashes', async () => {
    const app = createTestApp();
    const basePayload = {
      communityAddress: '0x0000000000000000000000000000000000000001',
      name: 'Invalid Origin Agent',
      role: 'Scout',
      description: 'Should not be created.',
      capabilities: ['chat'],
      promptTemplate: 'Stay safe.',
      initialFundingEth: '0',
    };

    const cloneResponse = await app.request('/api/agents/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, origin: { mode: 'clone' } }),
    });
    expect(cloneResponse.status).toBe(400);

    const hashResponse = await app.request('/api/agents/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        name: 'Invalid Hash Agent',
        permissionPolicy: { permissionPolicyHash: 'not-a-hash' },
      }),
    });
    expect(hashResponse.status).toBe(400);
  });

  it('gets and safely updates editable agent settings across route reinitialization', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'aquarius-agent-update-'));
    const storePath = join(tempDir, 'agents.json');

    try {
      resetAgentStoreForTests(storePath);
      const app = createTestApp();
      const createResponse = await app.request('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityAddress: '0x0000000000000000000000000000000000000001',
          name: 'Editable Lynx',
          role: 'Operations aide',
          description: 'Starts with default settings.',
          capabilities: ['chat'],
          promptTemplate: 'Private operating prompt.',
          initialFundingEth: '0',
        }),
      });
      const created = await createResponse.json();
      const agentId = encodeURIComponent(created.agent.agentId);
      const originalUpdatedAt = created.agent.passport.updatedAt;

      const getResponse = await app.request(`/api/agents/${agentId}`);
      expect(getResponse.status).toBe(200);
      const fetched = await getResponse.json();
      expect(fetched.agent.agentId).toBe(created.agent.agentId);
      expect(JSON.stringify(fetched)).not.toContain('Private operating prompt.');

      const patchResponse = await app.request(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: { biography: 'Updated public biography.', pronouns: 'they/them' },
          personality: { greeting: 'Hello, I am updated.', traits: { directness: 0.75 } },
          memoryPolicy: { mode: 'officer-memory', retentionDays: 90 },
          permissionPolicy: { permissionClass: 'officer' },
          economics: { hireable: true, hirePrice: '25 USDC/month' },
          agentAddress: '0x0000000000000000000000000000000000000009',
          promptHash: 'should-not-change',
        }),
      });
      expect(patchResponse.status).toBe(200);
      const updated = await patchResponse.json();
      expect(updated.agent.passport.identity.biography).toBe('Updated public biography.');
      expect(updated.agent.passport.identity.pronouns).toBe('they/them');
      expect(updated.agent.passport.personality.greeting).toBe('Hello, I am updated.');
      expect(updated.agent.passport.memoryPolicy).toMatchObject({
        mode: 'officer-memory',
        retentionDays: 90,
        remembersPrivateChats: true,
        remembersCommunityEvents: true,
      });
      expect(updated.agent.passport.capabilities.permissionClass).toBe('officer');
      expect(updated.agent.passport.economics.hireable).toBe(true);
      expect(updated.agent.passport.economics.hirePrice).toBe('25 USDC/month');
      expect(updated.agent.passport.agentAddress).toBe(created.agent.passport.agentAddress);
      expect(updated.agent.passport.hashes.promptHash).toBe(created.agent.passport.hashes.promptHash);
      expect(updated.agent.passport.updatedAt).not.toBe(originalUpdatedAt);

      resetAgentStoreForTests(storePath);
      const reloadedApp = createTestApp();
      const reloadedPassport = await reloadedApp.request(`/api/agents/${agentId}/passport`);
      const passport = await reloadedPassport.json();
      expect(passport.identity.biography).toBe('Updated public biography.');
      expect(passport.memoryPolicy.mode).toBe('officer-memory');
    } finally {
      resetAgentStoreForTests(null);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('serves structured placeholders for advertised A2A, MCP, and selfie endpoints', async () => {
    const app = createTestApp();
    const response = await app.request('/api/agents/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        communityAddress: '0x0000000000000000000000000000000000000001',
        name: 'Endpoint Fox',
        role: 'Runtime tester',
        description: 'Checks endpoint affordances.',
        capabilities: ['chat'],
        promptTemplate: 'Expose safe placeholder endpoints only.',
        initialFundingEth: '0',
      }),
    });
    const created = await response.json();
    const agentId = encodeURIComponent(created.agent.agentId);

    const a2a = await app.request(`/api/agents/${agentId}/a2a`);
    expect(a2a.status).toBe(202);
    expect(await a2a.json()).toMatchObject({ endpoint: 'a2a', available: false });

    const mcp = await app.request(`/api/agents/${agentId}/mcp`);
    expect(mcp.status).toBe(202);
    expect(await mcp.json()).toMatchObject({ endpoint: 'mcp', available: false });

    const selfie = await app.request(`/api/agents/${agentId}/selfies`, { method: 'POST' });
    expect(selfie.status).toBe(202);
    expect(await selfie.json()).toMatchObject({
      status: 'media-service-not-connected',
      generatedMedia: false,
      consentRequired: true,
      labelRequired: true,
    });
  });
});
