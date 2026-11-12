// Permanent progression that survives between runs: tickets, unlocks, stats, achievements, daily streak, settings.
import {
  CHARMS, CRATES, SHELLS, SHELL_TYPES, SKIES, STAKES, TICKETS_PER_NIGHT, TICKETS_PER_SHOW, TICKETS_WIN,
  type ShellType,
} from './data';
import { dailyMedal } from './run';
import type { RunState } from './types';

export interface Settings { music: boolean; sfx: boolean; haptics: boolean; reducedFx: boolean }

export interface Meta {
  v: 1;
  tickets: number;
  shells: ShellType[];
  charms: string[];
  skies: string[];
  crates: string[];
  stakeMax: number; // highest stake the player may select
  stake: number; // selected
  sky: string;
  crate: string;
  premium: boolean;
  /** Google Play purchase tokens whose tickets were already given, so a purchase is never paid out twice. */
  grantedTokens: string[];
  tutorialDone: boolean;
  settings: Settings;
  stats: { runs: number; wins: number; shows: number; shells: number; bestIgnition: number; bestChain: number; bestNight: number; bestEndless: number; tickets: number; ticketsBought?: number };
  achievements: Record<string, number>;
  daily: { last: string; streak: number; bestStreak: number; scores: Record<string, { score: number; medal: number }> };
}

export function defaultMeta(): Meta {
  return {
    v: 1, tickets: 0,
    shells: SHELL_TYPES.filter((t) => SHELLS[t].unlock === 0),
    charms: CHARMS.filter((c) => c.unlock === 0).map((c) => c.id),
    skies: ['harbor'], crates: ['classic'],
    stakeMax: 1, stake: 1, sky: 'harbor', crate: 'classic',
    premium: false, grantedTokens: [], tutorialDone: false,
    settings: { music: true, sfx: true, haptics: true, reducedFx: false },
    stats: { runs: 0, wins: 0, shows: 0, shells: 0, bestIgnition: 0, bestChain: 0, bestNight: 0, bestEndless: 0, tickets: 0 },
    achievements: {},
    daily: { last: '', streak: 0, bestStreak: 0, scores: {} },
  };
}

/** Fill in anything missing from an older or partial save so new fields never crash old players. */
export function migrateMeta(raw: unknown): Meta {
  const d = defaultMeta();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<Meta>;
  const m: Meta = { ...d, ...r, v: 1 };
  m.settings = { ...d.settings, ...(r.settings ?? {}) };
  m.stats = { ...d.stats, ...(r.stats ?? {}) };
  m.daily = { ...d.daily, ...(r.daily ?? {}), scores: { ...(r.daily?.scores ?? {}) } };
  m.achievements = { ...(r.achievements ?? {}) };
  m.grantedTokens = Array.isArray(r.grantedTokens) ? r.grantedTokens.filter((t) => typeof t === 'string').slice(-300) : [];
  const uniq = <T>(a: T[]) => [...new Set(a)];
  m.shells = uniq([...d.shells, ...(r.shells ?? [])]).filter((t) => t in SHELLS);
  m.charms = uniq([...d.charms, ...(r.charms ?? [])]).filter((id) => CHARMS.some((c) => c.id === id));
  m.skies = uniq([...d.skies, ...(r.skies ?? [])]).filter((id) => SKIES.some((s) => s.id === id));
  m.crates = uniq([...d.crates, ...(r.crates ?? [])]).filter((id) => CRATES.some((c) => c.id === id));
  m.stakeMax = Math.min(STAKES.length, Math.max(1, Math.floor(Number(m.stakeMax) || 1)));
  m.stake = Math.min(m.stakeMax, Math.max(1, Math.floor(Number(m.stake) || 1)));
  m.tickets = Math.max(0, Math.floor(Number(m.tickets) || 0));
  if (!skyAvailable(m, m.sky)) m.sky = 'harbor';
  if (!m.crates.includes(m.crate)) m.crate = 'classic';
  return m;
}

export const skyAvailable = (m: Meta, id: string) => {
  const s = SKIES.find((x) => x.id === id);
  return !!s && (s.premium ? m.premium : m.skies.includes(id));
};

export type UnlockKind = 'shell' | 'charm' | 'sky' | 'crate';
export function unlockCost(kind: UnlockKind, id: string): number {
  if (kind === 'shell') return SHELLS[id as ShellType]?.unlock ?? 0;
  if (kind === 'charm') return CHARMS.find((c) => c.id === id)?.unlock ?? 0;
  if (kind === 'sky') return SKIES.find((s) => s.id === id)?.unlock ?? 0;
  return CRATES.find((c) => c.id === id)?.unlock ?? 0;
}
export function isUnlocked(m: Meta, kind: UnlockKind, id: string): boolean {
  if (kind === 'shell') return m.shells.includes(id as ShellType);
  if (kind === 'charm') return m.charms.includes(id);
  if (kind === 'sky') return skyAvailable(m, id);
  return m.crates.includes(id);
}
export function unlock(m: Meta, kind: UnlockKind, id: string): boolean {
  const cost = unlockCost(kind, id);
  if (isUnlocked(m, kind, id) || m.tickets < cost) return false;
  if (kind === 'sky' && SKIES.find((s) => s.id === id)?.premium) return false;
  m.tickets -= cost;
  if (kind === 'shell') m.shells.push(id as ShellType);
  else if (kind === 'charm') m.charms.push(id);
  else if (kind === 'sky') m.skies.push(id);
  else m.crates.push(id);
  return true;
}

// ---------------------------------------------------------------- achievements
export interface AchievementDef { id: string; name: string; desc: string; tickets: number }
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first', name: 'Opening Night', desc: 'Clear your first show.', tickets: 3 },
  { id: 'chain10', name: 'Long Fuse', desc: 'Set off a chain of 10 bursts.', tickets: 3 },
  { id: 'chain20', name: 'Sky on Fire', desc: 'Set off a chain of 20 bursts.', tickets: 6 },
  { id: 'ign10k', name: 'Roar', desc: 'Score 10,000 applause from one Match.', tickets: 4 },
  { id: 'ign100k', name: 'Deafening', desc: 'Score 100,000 applause from one Match.', tickets: 8 },
  { id: 'night3', name: 'On Tour', desc: 'Clear Night 3.', tickets: 4 },
  { id: 'win', name: 'Grand Festival', desc: 'Complete all 6 nights.', tickets: 10 },
  { id: 'win3', name: 'City Gala', desc: 'Complete the festival on stake 3 or higher.', tickets: 12 },
  { id: 'win5', name: 'World Expo', desc: 'Complete the festival on stake 5.', tickets: 20 },
  { id: 'endless8', name: 'Small Hours', desc: 'Complete Night 8 in Endless play.', tickets: 10 },
  { id: 'kit', name: 'Full Kit', desc: 'Hold 5 charms at once.', tickets: 3 },
  { id: 'daily3', name: 'Regular', desc: 'Play the Daily Show 3 days in a row.', tickets: 5 },
  { id: 'daily7', name: 'Headliner', desc: 'Play the Daily Show 7 days in a row.', tickets: 10 },
  { id: 'gold', name: 'Gold Standard', desc: 'Earn a gold medal in a Daily Show.', tickets: 8 },
  { id: 'collector', name: 'Collector', desc: 'Unlock every shell.', tickets: 10 },
];

function grant(m: Meta, id: string, out: AchievementDef[]): void {
  if (m.achievements[id]) return;
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) return;
  m.achievements[id] = Date.now();
  m.tickets += def.tickets;
  m.stats.tickets += def.tickets;
  out.push(def);
}

/** Check achievements that can trigger mid-run or from menus. Returns newly earned ones. */
export function checkAchievements(m: Meta, run: RunState | null): AchievementDef[] {
  const out: AchievementDef[] = [];
  if (run) {
    if (run.stats.showsCleared >= 1) grant(m, 'first', out);
    if (run.stats.bestChain >= 10) grant(m, 'chain10', out);
    if (run.stats.bestChain >= 20) grant(m, 'chain20', out);
    if (run.stats.bestIgnition >= 10000) grant(m, 'ign10k', out);
    if (run.stats.bestIgnition >= 100000) grant(m, 'ign100k', out);
    if (run.charms.length >= 5) grant(m, 'kit', out);
    if (run.mode === 'endless' && run.stats.nightsCleared >= 8) grant(m, 'endless8', out);
    if (run.mode === 'festival') {
      if (run.stats.nightsCleared >= 3) grant(m, 'night3', out);
      if (run.stats.nightsCleared >= 6) {
        grant(m, 'win', out);
        if (run.stake >= 3) grant(m, 'win3', out);
        if (run.stake >= 5) grant(m, 'win5', out);
      }
    }
  }
  if (m.daily.streak >= 3) grant(m, 'daily3', out);
  if (m.daily.streak >= 7) grant(m, 'daily7', out);
  if (Object.values(m.daily.scores).some((s) => s.medal >= 3)) grant(m, 'gold', out);
  if (SHELL_TYPES.every((t) => m.shells.includes(t))) grant(m, 'collector', out);
  return out;
}

// ---------------------------------------------------------------- end-of-run rewards
export interface RunReward { tickets: number; parts: Array<{ label: string; n: number }>; won: boolean; newStake: number | null; medal: number; dailyBest: boolean; endlessBest: boolean }

/** Tickets a finished run is worth (before any doubling). */
export function runTickets(run: RunState): RunReward {
  const parts: Array<{ label: string; n: number }> = [];
  const won = (run.mode === 'festival' && run.stats.nightsCleared >= 6) || (run.mode === 'daily' && run.phase === 'won');
  let medal = 0;
  if (run.mode === 'daily') {
    medal = dailyMedal(run.stats.totalApplause);
    parts.push({ label: 'Daily Show played', n: 6 });
    if (medal > 0) parts.push({ label: ['', 'Bronze medal', 'Silver medal', 'Gold medal'][medal], n: medal * 4 });
  } else {
    const mult = STAKES[run.stake - 1].ticketMult;
    parts.push({ label: `${run.stats.showsCleared} shows cleared`, n: Math.round(run.stats.showsCleared * TICKETS_PER_SHOW * mult) });
    if (run.stats.nightsCleared) parts.push({ label: `${run.stats.nightsCleared} nights completed`, n: Math.round(run.stats.nightsCleared * TICKETS_PER_NIGHT * mult) });
    if (run.mode === 'festival' && run.stats.nightsCleared >= 6) parts.push({ label: 'Festival complete', n: Math.round(TICKETS_WIN * mult) });
  }
  return { tickets: parts.reduce((a, p) => a + p.n, 0), parts, won, newStake: null, medal, dailyBest: false, endlessBest: false };
}

/** Bank a finished run into the meta save. Call exactly once per run. */
export function bankRun(m: Meta, run: RunState, today: string): RunReward {
  const reward = runTickets(run);
  m.stats.runs++;
  m.stats.shows += run.stats.showsCleared;
  m.stats.shells += run.stats.shellsBurst;
  m.stats.bestIgnition = Math.max(m.stats.bestIgnition, run.stats.bestIgnition);
  m.stats.bestChain = Math.max(m.stats.bestChain, run.stats.bestChain);
  if (run.mode === 'festival') {
    m.stats.bestNight = Math.max(m.stats.bestNight, run.stats.nightsCleared);
    if (run.stats.nightsCleared >= 6) {
      m.stats.wins++;
      if (run.stake >= m.stakeMax && m.stakeMax < STAKES.length) { m.stakeMax++; reward.newStake = m.stakeMax; }
    }
  } else if (run.mode === 'endless') {
    reward.endlessBest = run.stats.nightsCleared > m.stats.bestEndless;
    m.stats.bestEndless = Math.max(m.stats.bestEndless, run.stats.nightsCleared);
  } else {
    const prev = m.daily.scores[today];
    reward.dailyBest = !prev || run.stats.totalApplause > prev.score;
    if (prev) {
      // replays only pay the difference for a better medal
      const better = Math.max(0, reward.medal - prev.medal);
      reward.parts = better ? [{ label: 'Better medal', n: better * 4 }] : [];
      reward.tickets = better * 4;
    } else {
      m.daily.streak = m.daily.last === previousDay(today) ? m.daily.streak + 1 : 1;
      m.daily.bestStreak = Math.max(m.daily.bestStreak, m.daily.streak);
      m.daily.last = today;
    }
    if (reward.dailyBest) m.daily.scores[today] = { score: run.stats.totalApplause, medal: Math.max(reward.medal, prev?.medal ?? 0) };
    // keep the history small
    const keys = Object.keys(m.daily.scores).sort();
    while (keys.length > 60) delete m.daily.scores[keys.shift()!];
  }
  m.tickets += reward.tickets;
  m.stats.tickets += reward.tickets;
  return reward;
}

export function dayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function previousDay(key: string): string {
  const [y, mo, d] = key.split('-').map(Number);
  return dayKey(new Date(y, mo - 1, d - 1));
}
/** The streak is only still alive if the last daily was today or yesterday. */
export function liveStreak(m: Meta, today: string): number {
  return m.daily.last === today || m.daily.last === previousDay(today) ? m.daily.streak : 0;
}

// ---------------------------------------------------------------- store purchases
/** One purchase as reported by Google Play. state: '1' = paid; anything else = pending or not completed. */
export interface StorePurchase { productId: string; token: string; state: string; acknowledged: boolean }
export interface PackDef { productId: string; tickets: number }
export interface Reconciled {
  /** tickets added to the save by this call */
  tickets: number;
  /** ticket purchases whose tickets are safely recorded: tell Google they are consumed (so the pack can be bought again) */
  consume: string[];
  /** Premium purchases to acknowledge (Google refunds unacknowledged purchases after 3 days) */
  acknowledge: string[];
  premiumGranted: boolean;
  /** paid-for but not yet cleared ticket purchases (cash, carrier billing ...) */
  pending: number;
}

/**
 * Deliver whatever Google Play says the player has paid for and not yet received. Idempotent: a purchase token
 * is only ever paid out once, however many times this runs. The caller must SAVE the meta before consuming,
 * so a crash between the two can only cause a retry, never a loss or a double payout.
 */
export function reconcilePurchases(m: Meta, purchases: StorePurchase[], packs: PackDef[], premiumId: string): Reconciled {
  const out: Reconciled = { tickets: 0, consume: [], acknowledge: [], premiumGranted: false, pending: 0 };
  for (const p of purchases) {
    const pack = packs.find((k) => k.productId === p.productId);
    if (p.state !== '1') { if (pack) out.pending++; continue; }
    if (pack) {
      if (!m.grantedTokens.includes(p.token)) {
        m.grantedTokens.push(p.token);
        m.tickets += pack.tickets;
        m.stats.ticketsBought = (m.stats.ticketsBought ?? 0) + pack.tickets;
        out.tickets += pack.tickets;
      }
      out.consume.push(p.token);
    } else if (p.productId === premiumId) {
      if (!m.premium) { m.premium = true; out.premiumGranted = true; }
      if (!p.acknowledged) out.acknowledge.push(p.token);
    }
  }
  if (m.grantedTokens.length > 300) m.grantedTokens = m.grantedTokens.slice(-300);
  return out;
}
