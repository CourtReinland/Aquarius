/**
 * Procedural planet generator.
 * Every community renders as a unique world whose colors/rings/moons are
 * deterministically derived from its on-chain address — same address,
 * same planet, everywhere, forever.
 */

export interface PlanetStyle {
  base: string;
  accent: string;
  glow: string;
  hasRing: boolean;
  ringTilt: number;
  moons: number;
  surface: 'bands' | 'swirl' | 'craters';
}

const PALETTES: Array<[string, string, string]> = [
  ['#2dd4bf', '#0f766e', 'rgba(45,212,191,0.5)'],   // aqua world
  ['#38bdf8', '#1e40af', 'rgba(56,189,248,0.5)'],   // ocean giant
  ['#8b5cf6', '#4c1d95', 'rgba(139,92,246,0.5)'],   // violet gas
  ['#fbbf24', '#b45309', 'rgba(251,191,36,0.5)'],   // amber desert
  ['#f472b6', '#9d174d', 'rgba(244,114,182,0.5)'],  // rose nebular
  ['#34d399', '#065f46', 'rgba(52,211,153,0.5)'],   // verdant moon
  ['#fb923c', '#9a3412', 'rgba(251,146,60,0.5)'],   // ember dwarf
  ['#a5b4fc', '#3730a3', 'rgba(165,180,252,0.5)'],  // ice giant
];

export function planetFor(seedStr: string): PlanetStyle {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = (Math.imul(h, 31) + seedStr.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(h);
  const [base, accent, glow] = PALETTES[abs % PALETTES.length];
  return {
    base,
    accent,
    glow,
    hasRing: abs % 3 === 0,
    ringTilt: -24 + (abs % 49),
    moons: abs % 4,
    surface: (['bands', 'swirl', 'craters'] as const)[abs % 3],
  };
}
