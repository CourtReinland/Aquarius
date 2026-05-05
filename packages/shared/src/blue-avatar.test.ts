import { describe, expect, it } from 'vitest';
import {
  BLUE_AVATAR_FRAMEWORK,
  BLUE_AVATAR_STATES,
  createBlueAvatarCue,
  getBlueMouthFrame,
} from './blue-avatar';

describe('Blue avatar framework', () => {
  it('selects a mobile-first framework with a path to VRM-grade lip sync', () => {
    expect(BLUE_AVATAR_FRAMEWORK.current.renderer).toBe('react-native-reanimated-2d');
    expect(BLUE_AVATAR_FRAMEWORK.future.renderer).toBe('react-three-fiber-vrm');
    expect(BLUE_AVATAR_FRAMEWORK.lipSync.visemeStrategy).toBe('viseme-ready-mouth-cues');
  });

  it('creates calm state cues for the Blue assistant', () => {
    const idle = createBlueAvatarCue('idle');
    const speaking = createBlueAvatarCue('speaking', { text: "Hi, I'm Blue." });

    expect(idle.expression).toBe('serene');
    expect(idle.floatIntensity).toBeLessThan(speaking.floatIntensity);
    expect(speaking.lipSyncEnabled).toBe(true);
    expect(speaking.prompt).toContain("Hi, I'm Blue");
  });

  it('derives subtle mouth frames from text and audio levels', () => {
    const closed = getBlueMouthFrame({ state: 'idle', elapsedMs: 120, text: '' });
    const textDriven = getBlueMouthFrame({ state: 'speaking', elapsedMs: 160, text: 'setup a community' });
    const audioDriven = getBlueMouthFrame({ state: 'speaking', elapsedMs: 160, text: '', audioLevel: 0.9 });

    expect(closed.openness).toBe(0);
    expect(textDriven.shape).not.toBe('closed');
    expect(textDriven.openness).toBeGreaterThan(0);
    expect(audioDriven.openness).toBeGreaterThan(textDriven.openness);
    expect(audioDriven.openness).toBeLessThanOrEqual(0.72);
  });
});
