// Static game data: shells, colours, charms, weather, crates, skies, stakes, balance constants.
// Everything tunable lives here so balance passes never touch logic.

export const COLS = 5;
export const ROWS = 6;
export const CELLS = COLS * ROWS;

export type Color = 0 | 1 | 2 | 3;
export const COLOR_NAMES = ['Crimson', 'Gold', 'Jade', 'Azure'] as const;
export const COLOR_HEX = ['#ff4d6d', '#ffc94d', '#4de3a1', '#4db8ff'] as const;
/** Each colour also has a token outline shape so the game never relies on hue alone. */
export const COLOR_SHAPES = ['circle', 'diamond', 'hex', 'square'] as const;

export type ShellType =
  | 'peony' | 'crossette' | 'ring' | 'comet' | 'willow' | 'wave' | 'brocade'
  | 'palm' | 'chrys' | 'strobe' | 'salute' | 'glitter' | 'kamuro' | 'dragon';

export interface ShellDef {
  type: ShellType;
  name: string;
  sparkle: number;
  /** [dCol, dRow] offsets this shell's burst reaches. Negative row = up the sky. */
  pattern: ReadonlyArray<readonly [number, number]>;
  desc: string;
  /** Tickets to unlock in the Workshop. 0 = available from the start. */
  unlock: number;
  /** relative weight in shell packs */
  weight: number;
}

const line = (dc: number, dr: number, n: number) =>
  Array.from({ length: n }, (_, i) => [dc * (i + 1), dr * (i + 1)] as const);

export const SHELLS: Record<ShellType, ShellDef> = {
  peony: { type: 'peony', name: 'Peony', sparkle: 10, unlock: 0, weight: 10,
    pattern: [[0, -1], [1, 0], [0, 1], [-1, 0]], desc: 'Bursts to the 4 cells beside it.' },
  crossette: { type: 'crossette', name: 'Crossette', sparkle: 10, unlock: 0, weight: 8,
    pattern: [[-1, -1], [1, -1], [1, 1], [-1, 1]], desc: 'Bursts to the 4 diagonal cells.' },
  ring: { type: 'ring', name: 'Ring', sparkle: 6, unlock: 0, weight: 6,
    pattern: [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]], desc: 'Bursts to all 8 surrounding cells. Low Sparkle, great connector.' },
  comet: { type: 'comet', name: 'Comet', sparkle: 16, unlock: 0, weight: 7,
    pattern: line(0, -1, 3), desc: 'Streaks straight up through 3 cells.' },
  willow: { type: 'willow', name: 'Willow', sparkle: 16, unlock: 0, weight: 7,
    pattern: [[-1, 1], [0, 1], [1, 1], [0, 2]], desc: 'Droops down: the 3 cells below, and one further down.' },
  wave: { type: 'wave', name: 'Wave', sparkle: 14, unlock: 0, weight: 7,
    pattern: [[-2, 0], [-1, 0], [1, 0], [2, 0]], desc: 'Sweeps sideways, 2 cells each way.' },
  brocade: { type: 'brocade', name: 'Brocade', sparkle: 28, unlock: 0, weight: 5,
    pattern: [[-1, 0], [1, 0]], desc: 'Big Sparkle, but only reaches left and right.' },
  palm: { type: 'palm', name: 'Palm', sparkle: 16, unlock: 12, weight: 6,
    pattern: [[0, -1], [0, -2], [-1, -2], [1, -2]], desc: 'Rises 2 cells, then fans out left and right.' },
  chrys: { type: 'chrys', name: 'Chrysanthemum', sparkle: 12, unlock: 16, weight: 6,
    pattern: [...line(0, -1, 2), ...line(1, 0, 2), ...line(0, 1, 2), ...line(-1, 0, 2)], desc: 'A wide plus: 2 cells in each of 4 directions.' },
  salute: { type: 'salute', name: 'Salute', sparkle: 45, unlock: 12, weight: 4,
    pattern: [], desc: 'A huge bang worth lots of Sparkle. Reaches nothing, so end a chain on it.' },
  glitter: { type: 'glitter', name: 'Glitter', sparkle: 4, unlock: 20, weight: 5,
    pattern: [[-1, 0], [1, 0], [0, -1]], desc: '+1 Awe when it bursts. Reaches left, right and up.' },
  strobe: { type: 'strobe', name: 'Strobe', sparkle: 9, unlock: 28, weight: 4,
    pattern: [[0, -1], [1, 0], [0, 1], [-1, 0]], desc: 'Bursts twice. Reaches the 4 cells beside it.' },
  kamuro: { type: 'kamuro', name: 'Kamuro', sparkle: 0, unlock: 36, weight: 4,
    pattern: [[0, -1], [1, 0], [0, 1], [-1, 0]], desc: 'Sparkle = 4 x its place in the chain. Save it for late.' },
  dragon: { type: 'dragon', name: 'Dragon', sparkle: 14, unlock: 45, weight: 3,
    pattern: [...line(0, -1, 5), ...line(1, 0, 4), ...line(0, 1, 5), ...line(-1, 0, 4)], desc: 'Roars across its entire row and column.' },
};
export const SHELL_TYPES = Object.keys(SHELLS) as ShellType[];

/** Sparkle added per Workshop level of a shell type (in-run upgrade). */
export const LEVEL_SPARKLE = 10;
export const KAMURO_PER_PLACE = 4;
export const KAMURO_LEVEL_PER_PLACE = 2;

export type StarKind = 'bright' | 'awe' | 'twin';
export const STAR_INFO: Record<StarKind, { name: string; desc: string }> = {
  bright: { name: 'Bright Star', desc: '+25 Sparkle for the shell placed here.' },
  awe: { name: 'Awe Star', desc: '+2 Awe when the shell placed here bursts.' },
  twin: { name: 'Twin Star', desc: 'The shell placed here bursts twice.' },
};
export const STAR_BRIGHT = 25;
export const STAR_AWE = 2;

// ---------------------------------------------------------------- charms
export interface CharmDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  unlock: number; // tickets; 0 = default
  icon: string; // single glyph drawn inside the charm medallion
  hue: number; // medallion tint
}

export const CHARMS: CharmDef[] = [
  { id: 'matchbook', name: 'Spare Match', desc: '+1 Match every show.', cost: 8, unlock: 0, icon: '🔥', hue: 20 },
  { id: 'pockets', name: 'Big Pockets', desc: '+1 hand size.', cost: 7, unlock: 0, icon: '✋', hue: 280 },
  { id: 'flag0', name: 'Crimson Banner', desc: 'Crimson shells give +12 Sparkle.', cost: 4, unlock: 0, icon: '⚑', hue: 348 },
  { id: 'flag1', name: 'Gold Banner', desc: 'Gold shells give +12 Sparkle.', cost: 4, unlock: 0, icon: '⚑', hue: 42 },
  { id: 'flag2', name: 'Jade Banner', desc: 'Jade shells give +12 Sparkle.', cost: 4, unlock: 0, icon: '⚑', hue: 152 },
  { id: 'flag3', name: 'Azure Banner', desc: 'Azure shells give +12 Sparkle.', cost: 4, unlock: 0, icon: '⚑', hue: 204 },
  { id: 'metronome', name: 'Metronome', desc: 'Every 3rd burst in a chain gives +2 Awe.', cost: 6, unlock: 0, icon: '♪', hue: 190 },
  { id: 'finale', name: 'Grand Finale', desc: 'x2 Awe on the last Match of a show.', cost: 7, unlock: 0, icon: '✺', hue: 320 },
  { id: 'opening', name: 'Opening Act', desc: '+60 Sparkle on the first Match of a show.', cost: 4, unlock: 0, icon: '☀', hue: 50 },
  { id: 'edge', name: 'Edge Lights', desc: 'Shells on the border of the sky give +8 Sparkle.', cost: 5, unlock: 0, icon: '▣', hue: 170 },
  { id: 'flyer', name: 'High Flyer', desc: 'Shells bursting in the top two rows give +1 Awe.', cost: 6, unlock: 0, icon: '⇈', hue: 230 },
  { id: 'tipjar', name: 'Tip Jar', desc: '+2 coins after every show.', cost: 5, unlock: 0, icon: '◉', hue: 45 },
  { id: 'favourite', name: 'Crowd Favourite', desc: 'Peonies give +1 Awe.', cost: 5, unlock: 0, icon: '❀', hue: 330 },
  { id: 'restocker', name: 'Spare Crate', desc: '+1 Restock every show.', cost: 4, unlock: 0, icon: '⟳', hue: 100 },
  { id: 'choir', name: 'Choir', desc: 'Harmony gives +3 Awe instead of +1.', cost: 6, unlock: 10, icon: '♬', hue: 265 },
  { id: 'spectrum', name: 'Full Spectrum', desc: 'x1.5 Awe if the chain contains all 4 colours.', cost: 6, unlock: 10, icon: '◐', hue: 290 },
  { id: 'mono', name: 'Monochrome', desc: 'x3 Awe if a chain of 4+ bursts is all one colour.', cost: 7, unlock: 18, icon: '●', hue: 0 },
  { id: 'echo', name: 'Echo', desc: 'The shell you light bursts twice.', cost: 5, unlock: 10, icon: '❞', hue: 210 },
  { id: 'slowfuse', name: 'Slow Fuse', desc: '+1 Awe for each wave the chain travels.', cost: 6, unlock: 14, icon: '≋', hue: 30 },
  { id: 'longfuse', name: 'Long Fuse', desc: 'x2 Awe for chains of 10 or more bursts.', cost: 8, unlock: 22, icon: '➳', hue: 15 },
  { id: 'stargazer', name: 'Stargazer', desc: 'Star cells are twice as strong.', cost: 6, unlock: 14, icon: '★', hue: 55 },
  { id: 'lucky', name: 'Lucky Star', desc: '+2 star cells every show.', cost: 5, unlock: 10, icon: '✦', hue: 60 },
  { id: 'penny', name: 'Penny Sparkler', desc: 'Earn 1 coin per 6 bursts in a chain (up to 3).', cost: 6, unlock: 14, icon: '¢', hue: 40 },
  { id: 'corner', name: 'Corner Pockets', desc: 'Crossettes and Rings give +14 Sparkle.', cost: 4, unlock: 8, icon: '✕', hue: 180 },
  { id: 'stopper', name: 'Showstopper', desc: 'The last burst of a chain gives +4 Awe.', cost: 5, unlock: 10, icon: '❢', hue: 340 },
  { id: 'ovation', name: 'Standing Ovation', desc: 'Gains x0.1 Awe for every show you clear while holding it.', cost: 8, unlock: 26, icon: '♛', hue: 48 },
  { id: 'solo', name: 'Travelling Light', desc: 'x1.5 Awe while your crate holds 14 shells or fewer.', cost: 6, unlock: 18, icon: '⚖', hue: 130 },
  { id: 'piggy', name: 'Piggy Bank', desc: '+1 Awe for every 4 coins you hold (up to +8).', cost: 6, unlock: 14, icon: '♨', hue: 320 },
];
export const CHARM_BY_ID: Record<string, CharmDef> = Object.fromEntries(CHARMS.map((c) => [c.id, c]));
export const MAX_CHARMS = 5;

// ---------------------------------------------------------------- weather (Finale modifiers)
export interface WeatherDef { id: string; name: string; desc: string; icon: string }
export const WEATHER: WeatherDef[] = [
  { id: 'drizzle', name: 'Drizzle', desc: 'Every shell gives 4 less Sparkle.', icon: '☂' },
  { id: 'fog', name: 'Fog', desc: 'No star cells this show.', icon: '≡' },
  { id: 'crosswind', name: 'Crosswind', desc: 'Every burst drifts one cell to the right.', icon: '➤' },
  { id: 'lowcloud', name: 'Low Clouds', desc: 'The top row of the sky is blocked.', icon: '☁' },
  { id: 'shortfuse', name: 'Short Fuses', desc: 'One fewer Match this show.', icon: '✂' },
  { id: 'crowded', name: 'Crowded Sky', desc: '4 extra cells are blocked.', icon: '▦' },
  { id: 'damp', name: 'Damp Crate', desc: 'Hand size is 1 smaller.', icon: '♒' },
  { id: 'tough', name: 'Tough Crowd', desc: 'Harmony gives no Awe this show.', icon: '☹' },
];
export const WEATHER_BY_ID: Record<string, WeatherDef> = Object.fromEntries(WEATHER.map((w) => [w.id, w]));

// ---------------------------------------------------------------- crates (starting decks)
export interface CrateDef { id: string; name: string; desc: string; unlock: number; build: () => Array<[ShellType, Color]> }
const perColor = (types: ShellType[]): Array<[ShellType, Color]> =>
  ([0, 1, 2, 3] as Color[]).flatMap((c) => types.map((t) => [t, c] as [ShellType, Color]));
export const CRATES: CrateDef[] = [
  { id: 'classic', name: 'Classic Crate', desc: 'A balanced mix. 18 shells in four colours.', unlock: 0,
    build: () => [...perColor(['peony', 'peony', 'crossette']), ['comet', 0], ['willow', 1], ['wave', 2], ['ring', 3], ['brocade', 1], ['brocade', 3]] },
  { id: 'duotone', name: 'Duotone Crate', desc: 'Only Crimson and Azure: Harmony comes easily. 16 shells.', unlock: 30,
    build: () => ([0, 3] as Color[]).flatMap((c) => (['peony', 'peony', 'peony', 'crossette', 'crossette', 'comet', 'wave', 'ring'] as ShellType[]).map((t) => [t, c] as [ShellType, Color])) },
  { id: 'skyline', name: 'Skyline Crate', desc: 'Long-reach shells for sprawling chains. 18 shells.', unlock: 30,
    build: () => [...perColor(['comet', 'willow', 'wave', 'peony']), ['ring', 0], ['ring', 2]] },
  { id: 'heavy', name: 'Heavy Crate', desc: 'Few shells, big Sparkle. 14 shells.', unlock: 40,
    build: () => [...perColor(['brocade', 'peony', 'ring']), ['comet', 1], ['willow', 2]] },
];
export const CRATE_BY_ID: Record<string, CrateDef> = Object.fromEntries(CRATES.map((c) => [c.id, c]));

// ---------------------------------------------------------------- skies (cosmetic venues)
export interface SkyDef { id: string; name: string; unlock: number; premium?: boolean; top: string; bottom: string; glow: string }
export const SKIES: SkyDef[] = [
  { id: 'harbor', name: 'Harbour Night', unlock: 0, top: '#050816', bottom: '#14204a', glow: '#3b5bdb' },
  { id: 'lake', name: 'Mountain Lake', unlock: 20, top: '#04101a', bottom: '#123a44', glow: '#2fb5a0' },
  { id: 'city', name: 'City Rooftops', unlock: 20, top: '#0b0618', bottom: '#3a1a4d', glow: '#d6477f' },
  { id: 'dunes', name: 'Desert Dunes', unlock: 30, top: '#0a0714', bottom: '#4a2a22', glow: '#e08a3c' },
  { id: 'aurora', name: 'Aurora', unlock: 0, premium: true, top: '#020b12', bottom: '#0d3b3a', glow: '#58f0b0' },
];
export const SKY_BY_ID: Record<string, SkyDef> = Object.fromEntries(SKIES.map((s) => [s.id, s]));

// ---------------------------------------------------------------- stakes (difficulty tiers)
export interface StakeDef { level: number; name: string; desc: string; targetMult: number; restocks: number; charmCost: number; startCoins: number; ticketMult: number }
export const STAKES: StakeDef[] = [
  { level: 1, name: 'Village Fête', desc: 'The standard festival.', targetMult: 1, restocks: 0, charmCost: 0, startCoins: 0, ticketMult: 1 },
  { level: 2, name: 'Town Fair', desc: 'Crowds expect 25% more applause.', targetMult: 1.25, restocks: 0, charmCost: 0, startCoins: 0, ticketMult: 1.25 },
  { level: 3, name: 'City Gala', desc: '+25% applause, and one fewer Restock.', targetMult: 1.25, restocks: -1, charmCost: 0, startCoins: 0, ticketMult: 1.5 },
  { level: 4, name: 'Royal Jubilee', desc: '+50% applause, one fewer Restock, charms cost 1 more.', targetMult: 1.5, restocks: -1, charmCost: 1, startCoins: 0, ticketMult: 1.75 },
  { level: 5, name: 'World Expo', desc: '+90% applause, one fewer Restock, charms cost 1 more, start with 2 fewer coins.', targetMult: 1.9, restocks: -1, charmCost: 1, startCoins: -2, ticketMult: 2 },
];

// ---------------------------------------------------------------- run structure & economy
export const NIGHTS = 6;
export const SHOWS_PER_NIGHT = 3;
export const SHOW_NAMES = ['Opening', 'Feature', 'Finale'] as const;
export const NIGHT_NAMES = ['Village Green', 'Riverside', 'Old Town', 'Harbour Front', 'Capital Square', 'Grand Festival'] as const;

/** Applause needed for the Opening show of each night; Feature/Finale multiply it. Tuned with sim/balance.ts. */
export const NIGHT_BASE = [600, 1400, 3000, 8000, 18000, 32000];
export const SHOW_MULT = [1, 1.5, 2.2];
/** Endless: each night past the last multiplies the base again. */
export const ENDLESS_GROWTH = 1.8;

export const BASE_HAND = 5;
export const BASE_MATCHES = 3;
export const BASE_RESTOCKS = 2;
export const START_COINS = 4;
export const SHOW_COINS = [4, 5, 7];
export const COINS_PER_UNUSED_MATCH = 2;
export const PACK_COST = 3;
export const PACK_SIZE = 3;
export const UPGRADE_BASE_COST = 4;
export const TRIM_COST = 2;
export const REROLL_BASE_COST = 2;
export const SHOP_CHARMS = 3;
export const SHOP_PACKS = 2;

export const TICKETS_PER_SHOW = 2;
export const TICKETS_PER_NIGHT = 4;
export const TICKETS_WIN = 25;

export function targetFor(night: number, showIdx: number, stake: number): number {
  const base = night <= NIGHTS
    ? NIGHT_BASE[night - 1]
    : NIGHT_BASE[NIGHTS - 1] * Math.pow(ENDLESS_GROWTH, night - NIGHTS);
  const raw = base * SHOW_MULT[showIdx] * STAKES[Math.min(stake, STAKES.length) - 1].targetMult;
  // round to a tidy number
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 1));
  return Math.round(raw / mag) * mag;
}
