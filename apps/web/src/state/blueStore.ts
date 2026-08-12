import { create } from 'zustand';

/**
 * Blue — the Aquarius companion.
 * A small state machine: she has a mood, a message queue, and an optional
 * voice. Anything in the app can call blue.say() / think() / celebrate().
 */

export type BlueMood = 'idle' | 'talking' | 'thinking' | 'celebrating';

export interface BlueChip {
  label: string;
  /** either a canned reply Blue gives, or an action id the UI handles */
  reply?: string;
  action?: string;
}

export interface BlueMessage {
  text: string;
  mood?: BlueMood;
  chips?: BlueChip[];
}

interface BlueState {
  mood: BlueMood;
  current: BlueMessage | null;
  queue: BlueMessage[];
  minimized: boolean;
  unread: boolean;
  voiceOn: boolean;
  busy: boolean; // currently typing out a message

  say: (msg: string | string[], opts?: Partial<Omit<BlueMessage, 'text'>>) => void;
  interrupt: (msg: string, opts?: Partial<Omit<BlueMessage, 'text'>>) => void;
  next: () => void;
  setBusy: (b: boolean) => void;
  think: (on: boolean) => void;
  celebrate: (msg: string, chips?: BlueChip[]) => void;
  toggleMinimized: () => void;
  toggleVoice: () => void;
  clear: () => void;
}

export const useBlueStore = create<BlueState>((set, get) => ({
  mood: 'idle',
  current: null,
  queue: [],
  minimized: false,
  unread: false,
  voiceOn: false,

  busy: false,

  say: (msg, opts = {}) => {
    const texts = Array.isArray(msg) ? msg : [msg];
    const msgs: BlueMessage[] = texts.map((text, i) => ({
      text,
      mood: opts.mood ?? 'talking',
      chips: i === texts.length - 1 ? opts.chips : undefined,
    }));
    const { current } = get();
    if (!current) {
      const [head, ...rest] = msgs;
      set({
        current: head,
        queue: rest,
        mood: head.mood ?? 'talking',
        unread: get().minimized,
      });
    } else {
      set((s) => ({ queue: [...s.queue, ...msgs], unread: s.minimized }));
    }
  },

  next: () => {
    const { queue } = get();
    if (queue.length === 0) {
      set({ current: null, mood: 'idle' });
      return;
    }
    const [head, ...rest] = queue;
    set({ current: head, queue: rest, mood: head.mood ?? 'talking' });
  },

  setBusy: (busy) => set({ busy }),

  think: (on) => set({ mood: on ? 'thinking' : 'idle' }),

  /** Network news — replaces idle chatter immediately instead of queueing. */
  interrupt: (msg, opts = {}) => {
    set({
      current: { text: msg, mood: opts.mood ?? 'talking', chips: opts.chips },
      queue: [],
      mood: opts.mood ?? 'talking',
      unread: get().minimized,
    });
  },

  celebrate: (msg, chips) => {
    set({ current: { text: msg, mood: 'celebrating', chips }, queue: [], mood: 'celebrating', unread: get().minimized });
  },

  toggleMinimized: () =>
    set((s) => ({ minimized: !s.minimized, unread: s.minimized ? s.unread : false })),

  toggleVoice: () => {
    const on = !get().voiceOn;
    if (!on) window.speechSynthesis?.cancel();
    set({ voiceOn: on });
  },

  clear: () => {
    window.speechSynthesis?.cancel();
    set({ current: null, queue: [], mood: 'idle' });
  },
}));

/** Pick a pleasant browser voice for Blue (prefers female en voices). */
export function pickBlueVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const prefs = ['Samantha', 'Karen', 'Google UK English Female', 'Victoria', 'Moira'];
  for (const p of prefs) {
    const v = voices.find((v) => v.name.includes(p));
    if (v) return v;
  }
  return voices.find((v) => v.lang.startsWith('en')) ?? null;
}

export function blueSpeak(text: string) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  // strip emoji/pictographs so the voice doesn't read them aloud
  const utter = new SpeechSynthesisUtterance(text.replace(/\p{Extended_Pictographic}/gu, ''));
  const voice = pickBlueVoice();
  if (voice) utter.voice = voice;
  utter.rate = 1.04;
  utter.pitch = 1.12;
  synth.speak(utter);
}
