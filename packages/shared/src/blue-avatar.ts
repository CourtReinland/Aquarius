export type BlueAvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'confirming';
export type BlueExpression = 'serene' | 'attentive' | 'thoughtful' | 'gentle-smile';
export type BlueMouthShape = 'closed' | 'ah' | 'ee' | 'oh' | 'oo' | 'smile';

export interface BlueAvatarCueOptions {
  text?: string;
  audioLevel?: number;
}

export interface BlueAvatarCue {
  state: BlueAvatarState;
  expression: BlueExpression;
  prompt: string;
  floatIntensity: number;
  blinkIntervalMs: number;
  lipSyncEnabled: boolean;
}

export interface BlueMouthFrameInput {
  state: BlueAvatarState;
  elapsedMs: number;
  text?: string;
  audioLevel?: number;
}

export interface BlueMouthFrame {
  shape: BlueMouthShape;
  openness: number;
  width: number;
  smile: number;
}

export const BLUE_AVATAR_STATES: readonly BlueAvatarState[] = [
  'idle',
  'listening',
  'thinking',
  'speaking',
  'confirming',
] as const;

export const BLUE_AVATAR_FRAMEWORK = {
  current: {
    renderer: 'react-native-reanimated-2d',
    reason: 'Uses the provided Blue portrait immediately on mobile, with smooth native-thread idle motion and mouth cues.',
  },
  future: {
    renderer: 'react-three-fiber-vrm',
    reason: 'When a VRM/GLB rig exists, the same cue model can drive @react-three/fiber, @pixiv/three-vrm, and morph-target visemes.',
  },
  lipSync: {
    visemeStrategy: 'viseme-ready-mouth-cues',
    fallback: 'text-and-audio-level procedural mouth frames',
  },
} as const;

const STATE_CUES: Record<BlueAvatarState, Omit<BlueAvatarCue, 'state' | 'prompt'>> = {
  idle: {
    expression: 'serene',
    floatIntensity: 0.35,
    blinkIntervalMs: 4200,
    lipSyncEnabled: false,
  },
  listening: {
    expression: 'attentive',
    floatIntensity: 0.42,
    blinkIntervalMs: 3600,
    lipSyncEnabled: false,
  },
  thinking: {
    expression: 'thoughtful',
    floatIntensity: 0.48,
    blinkIntervalMs: 5000,
    lipSyncEnabled: false,
  },
  speaking: {
    expression: 'gentle-smile',
    floatIntensity: 0.58,
    blinkIntervalMs: 3900,
    lipSyncEnabled: true,
  },
  confirming: {
    expression: 'gentle-smile',
    floatIntensity: 0.5,
    blinkIntervalMs: 3600,
    lipSyncEnabled: false,
  },
};

const DEFAULT_PROMPTS: Record<BlueAvatarState, string> = {
  idle: "Hi, I'm Blue. I'm here to help you get set up.",
  listening: "I'm listening.",
  thinking: 'Give me a second to think through the safest next step.',
  speaking: "Hi, I'm Blue. I'm here to help you get set up.",
  confirming: 'That looks good. I can keep the defaults simple and safe.',
};

export function createBlueAvatarCue(
  state: BlueAvatarState,
  options: BlueAvatarCueOptions = {}
): BlueAvatarCue {
  const cue = STATE_CUES[state];
  return {
    state,
    ...cue,
    prompt: options.text?.trim() || DEFAULT_PROMPTS[state],
  };
}

const VOWEL_TO_SHAPE: Record<string, BlueMouthShape> = {
  a: 'ah',
  e: 'ee',
  i: 'ee',
  o: 'oh',
  u: 'oo',
  y: 'ee',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function frameFromShape(shape: BlueMouthShape, openness: number): BlueMouthFrame {
  const safeOpen = clamp(openness, 0, 0.72);
  switch (shape) {
    case 'ah':
      return { shape, openness: safeOpen, width: 0.7, smile: 0.08 };
    case 'ee':
      return { shape, openness: safeOpen * 0.68, width: 0.95, smile: 0.18 };
    case 'oh':
      return { shape, openness: safeOpen * 0.82, width: 0.58, smile: 0.04 };
    case 'oo':
      return { shape, openness: safeOpen * 0.6, width: 0.48, smile: 0.02 };
    case 'smile':
      return { shape, openness: safeOpen * 0.35, width: 0.9, smile: 0.35 };
    case 'closed':
    default:
      return { shape: 'closed', openness: 0, width: 0.72, smile: 0.12 };
  }
}

export function getBlueMouthFrame(input: BlueMouthFrameInput): BlueMouthFrame {
  if (input.state !== 'speaking') {
    return frameFromShape('closed', 0);
  }

  if (typeof input.audioLevel === 'number' && input.audioLevel > 0) {
    const openness = clamp(input.audioLevel * 0.8, 0.08, 0.72);
    return frameFromShape(openness > 0.55 ? 'ah' : 'ee', openness);
  }

  const text = (input.text || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!text) {
    return frameFromShape('smile', 0.12);
  }

  const frameIndex = Math.floor(input.elapsedMs / 95);
  const char = text[frameIndex % text.length];
  const shape = VOWEL_TO_SHAPE[char] || (frameIndex % 4 === 0 ? 'smile' : 'closed');
  const openness = shape === 'closed' ? 0 : 0.24 + ((frameIndex % 3) * 0.08);

  return frameFromShape(shape, openness);
}
