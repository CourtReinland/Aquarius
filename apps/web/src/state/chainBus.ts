import { create } from 'zustand';
import type { Registry } from '../lib/registry';

/**
 * Chain bus — a tiny shared signal layer.
 * The community watcher bumps `version` whenever something new lands
 * on-chain; any data hook that depends on `version` refetches. The
 * announcement registry cache lives here too so every component
 * (explorer badges, Blue, cards) reads one copy.
 */

interface ChainBusState {
  version: number;
  registry: Registry;
  bump: () => void;
  setRegistry: (r: Registry) => void;
}

export const useChainBus = create<ChainBusState>((set) => ({
  version: 0,
  registry: {},
  bump: () => set((s) => ({ version: s.version + 1 })),
  setRegistry: (registry) => set({ registry }),
}));
