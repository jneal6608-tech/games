import type { Color, ShellType, StarKind } from './data';

export interface Shell { id: number; type: ShellType; color: Color }

export interface Cell {
  shell: Shell | null;
  /** true once the shell has been through an ignition: it is now part of the display and cannot be moved */
  locked: boolean;
  star: StarKind | null;
  blocked: boolean;
}

export interface CharmInst { id: string; counter: number }

/** One burst in a chain. A shell that bursts twice produces two steps. */
export interface Step {
  idx: number; // cell index
  shell: Shell;
  order: number; // 1-based place in the chain
  wave: number; // 1 = the shell you lit
  parent: number; // cell index that triggered it, -1 for the lit shell
  repeat: number; // 0 for the first burst of this shell, 1+ for extra bursts
  hits: number[]; // in-bounds cells this burst reaches
  triggers: number[]; // cells with shells newly ignited by this burst
  dSparkle: number;
  dAwe: number;
  notes: string[]; // e.g. "Harmony", "Bright Star", "Crimson Banner"
  sparkleAfter: number;
  aweAfter: number;
}

export interface Resolution {
  steps: Step[];
  sparkle: number;
  awe: number; // after additive bonuses, before multipliers
  mults: Array<{ name: string; x: number }>;
  finalAwe: number;
  score: number;
  coins: number;
  chain: number; // number of bursts
  waves: number;
  unlit: number; // shells on the sky the chain never reached
}

export interface ShowState {
  target: number;
  weather: string | null;
  cells: Cell[];
  draw: Shell[];
  hand: Shell[];
  discard: Shell[];
  matchesLeft: number;
  matchesTotal: number;
  restocksLeft: number;
  handSize: number;
  score: number;
  ignitions: number;
  best: number; // best single ignition this show
}

export interface PackOffer { shells: Shell[]; cost: number }
export interface ShopState {
  charms: Array<{ id: string; cost: number } | null>;
  packs: Array<PackOffer | null>;
  upgrade: { type: ShellType; cost: number } | null;
  trimCost: number;
  rerolls: number;
  freeRerollUsed: boolean;
  pending: Shell[] | null; // opened pack waiting for a pick
}

export type Phase = 'show' | 'cleared' | 'failed' | 'shop' | 'won' | 'lost';
/** festival = six nights with an ending; endless = no final night, play until a show fails; daily = the seeded Daily Show */
export type Mode = 'festival' | 'daily' | 'endless';

export interface RunStats {
  showsCleared: number;
  nightsCleared: number;
  bestIgnition: number;
  bestChain: number;
  totalApplause: number;
  shellsBurst: number;
  coinsEarned: number;
}

export interface RunState {
  v: 1;
  seed: string;
  mode: Mode;
  stake: number;
  crateId: string;
  night: number; // 1-based
  showIdx: number; // 0..2
  crate: Shell[];
  nextId: number;
  levels: Partial<Record<ShellType, number>>;
  charms: CharmInst[];
  coins: number;
  phase: Phase;
  show: ShowState | null;
  shop: ShopState | null;
  shopCount: number;
  stats: RunStats;
  encoreUsed: boolean;
  endless: boolean;
  /** pools frozen at run start so mid-run unlocks never change a seeded run */
  poolShells: ShellType[];
  poolCharms: string[];
  /** reward paid for the show that was just cleared (for the results card) */
  lastReward: { base: number; matches: number; charms: number; total: number } | null;
  tutorial: boolean;
}
