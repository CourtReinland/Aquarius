import { describe, expect, it } from 'vitest';
import {
  AGENT_PASSPORT_SCHEMA_VERSION,
  createDefaultAgentPassportInput,
} from './agent-passport';

describe('agent passport shared defaults', () => {
  it('uses the v1 passport schema and Aquarius product defaults', () => {
    const defaults = createDefaultAgentPassportInput();

    expect(AGENT_PASSPORT_SCHEMA_VERSION).toBe('aquarius.agent-passport.v1');
    expect(defaults.origin.mode).toBe('scratch');
    expect(defaults.capabilities.permissionClass).toBe('worker');
    expect(defaults.wallet.type).toBe('EOA');
    expect(defaults.embodiment.portraitProvider).toBe('gemini-nano-banana');
    expect(defaults.economics.feeMode).toBe('off-chain');
    expect(defaults.identity.anthropomorphism).toBe('agent-discretion');
    expect(defaults.memoryPolicy).toMatchObject({
      mode: 'session-only',
      remembersPrivateChats: false,
      remembersCommunityEvents: false,
      cloneSafe: true,
      editableAfterCreation: true,
    });
  });
});
