// The whole rules engine. Pure functions over a plain-JSON RunState: no DOM, no timers, no Math.random.
// The UI calls these, then animates the returned Resolution. Tests and the balance simulator call them directly.

import {
  BASE_HAND, BASE_MATCHES, BASE_RESTOCKS, CELLS, CHARM_BY_ID, COINS_PER_UNUSED_MATCH, COLS, CRATE_BY_ID,
  KAMURO_LEVEL_PER_PLACE, KAMURO_PER_PLACE, LEVEL_SPARKLE, MAX_CHARMS, NIGHTS, PACK_COST, PACK_SIZE,
  REROLL_BASE_COST, ROWS, SHELLS, SHOP_CHARMS, SHOP_PACKS, SHOWS_PER_NIGHT, SHOW_COINS, STAKES, STAR_AWE,
  STAR_BRIGHT, START_COINS, TRIM_COST, UPGRADE_BASE_COST, WEATHER, targetFor, COLOR_NAMES,
  type Color, type ShellType, type StarKind,
} from './data';
import { Rng } from './rng';
import type { Cell, Mode, Resolution, RunState, Shell, ShopState, ShowState, Step } from './types';

export const MIN_CRATE = 8;
export const DAILY_NIGHT = 2; // the Daily Show uses night-2 targets
export const DAILY_COINS = 8;

const hasCharm = (run: RunState, id: string) => run.charms.some((c) => c.id === id);
const stakeOf = (run: RunState) => STAKES[Math.min(run.stake, STAKES.length) - 1];
export const cellIdx = (c: number, r: number) => r * COLS + c;
export const cellCol = (i: number) => i % COLS;
export const cellRow = (i: number) => Math.floor(i / COLS);

// ---------------------------------------------------------------- run setup
export interface NewRunOpts {
  seed: string;
  mode?: Mode;
  stake?: number;
  crateId?: string;
  poolShells: ShellType[];
  poolCharms: string[];
  tutorial?: boolean;
}

export function newRun(o: NewRunOpts): RunState {
  const mode = o.mode ?? 'festival';
  const stake = mode === 'festival' ? o.stake ?? 1 : 1; // stakes belong to the festival
  const crateId = mode === 'daily' ? 'classic' : o.crateId ?? 'classic';
  let nextId = 1;
  const crate: Shell[] = CRATE_BY_ID[crateId].build().map(([type, color]) => ({ id: nextId++, type, color }));
  const run: RunState = {
    v: 1, seed: o.seed, mode, stake, crateId,
    night: mode === 'daily' ? DAILY_NIGHT : 1, showIdx: 0,
    crate, nextId, levels: {}, charms: [],
    coins: mode === 'daily' ? DAILY_COINS : Math.max(0, START_COINS + STAKES[stake - 1].startCoins),
    phase: 'show', show: null, shop: null, shopCount: 0,
    stats: { showsCleared: 0, nightsCleared: 0, bestIgnition: 0, bestChain: 0, totalApplause: 0, shellsBurst: 0, coinsEarned: 0 },
    encoreUsed: false, endless: mode === 'endless',
    poolShells: o.poolShells.slice(), poolCharms: o.poolCharms.slice(),
    lastReward: null, tutorial: !!o.tutorial,
  };
  if (mode === 'daily') {
    // The Daily Show hands everyone the same two charms so the puzzle is identical for all players.
    const rng = new Rng(`${o.seed}|dailycharms`);
    const basics = ['flag0', 'flag1', 'flag2', 'flag3', 'metronome', 'finale', 'opening', 'edge', 'flyer', 'favourite', 'pockets', 'restocker'];
    run.charms = rng.sample(basics, 2).map((id) => ({ id, counter: 0 }));
  }
  startShow(run);
  return run;
}

// ---------------------------------------------------------------- show setup
export function handSizeOf(run: RunState, weather: string | null): number {
  return Math.max(2, BASE_HAND + (hasCharm(run, 'pockets') ? 1 : 0) - (weather === 'damp' ? 1 : 0));
}

export function startShow(run: RunState): void {
  const rng = new Rng(`${run.seed}|show|${run.night}|${run.showIdx}`);
  const isFinale = run.showIdx === SHOWS_PER_NIGHT - 1;
  const tutorialShow = run.tutorial && run.night === 1 && run.showIdx === 0;
  const weather = isFinale && !(run.mode !== 'daily' && run.night === 1) ? rng.pick(WEATHER).id : null;

  const cells: Cell[] = Array.from({ length: CELLS }, () => ({ shell: null, locked: false, star: null, blocked: false }));
  const free = () => cells.map((c, i) => (!c.blocked && !c.star ? i : -1)).filter((i) => i >= 0);

  if (tutorialShow) {
    cells[cellIdx(2, 2)].star = 'bright';
  } else {
    if (weather === 'lowcloud') for (let c = 0; c < COLS; c++) cells[cellIdx(c, 0)].blocked = true;
    let blocked = run.night >= 6 ? 3 : run.night >= 4 ? 2 : run.night >= 2 ? 1 : 0;
    if (weather === 'crowded') blocked += 4;
    for (let i = 0; i < blocked; i++) {
      const f = free();
      if (f.length) cells[rng.pick(f)].blocked = true;
    }
    if (weather !== 'fog') {
      const stars = 3 + (run.night >= 4 ? 1 : 0) + (hasCharm(run, 'lucky') ? 2 : 0);
      for (let i = 0; i < stars; i++) {
        const f = free();
        if (f.length) cells[rng.pick(f)].star = rng.weighted<StarKind>(['bright', 'awe', 'twin'], [45, 35, 20]);
      }
    }
  }

  const matches = Math.max(1, BASE_MATCHES + (hasCharm(run, 'matchbook') ? 1 : 0) - (weather === 'shortfuse' ? 1 : 0));
  const restocks = Math.max(0, BASE_RESTOCKS + (hasCharm(run, 'restocker') ? 1 : 0) + stakeOf(run).restocks);
  const show: ShowState = {
    target: targetFor(run.night, run.showIdx, run.stake),
    weather, cells,
    draw: [], hand: [], discard: [],
    matchesLeft: matches, matchesTotal: matches, restocksLeft: restocks,
    handSize: handSizeOf(run, weather),
    score: 0, ignitions: 0, best: 0,
  };
  show.draw = new Rng(`${run.seed}|deck|${run.night}|${run.showIdx}`).shuffle(run.crate.slice());
  if (tutorialShow) {
    // Scripted opening hand so the coach marks always line up: two crimson peonies, then variety.
    const want: Array<[ShellType, Color]> = [['peony', 0], ['peony', 0], ['crossette', 1], ['peony', 2], ['comet', 0]];
    const picked: Shell[] = [];
    for (const [t, c] of want) {
      const i = show.draw.findIndex((s) => s.type === t && s.color === c && !picked.includes(s));
      if (i >= 0) picked.push(show.draw.splice(i, 1)[0]);
    }
    show.draw = [...show.draw, ...picked.reverse()]; // draw() pops from the end
  }
  run.show = show;
  run.shop = null;
  run.phase = 'show';
  run.lastReward = null;
  refill(run);
}

function drawOne(run: RunState): Shell | null {
  const show = run.show!;
  if (!show.draw.length && show.discard.length) {
    const n = show.ignitions * 31 + show.restocksLeft * 7 + show.discard.length;
    show.draw = new Rng(`${run.seed}|reshuffle|${run.night}|${run.showIdx}|${n}`).shuffle(show.discard);
    show.discard = [];
  }
  return show.draw.pop() ?? null;
}

function refill(run: RunState): void {
  const show = run.show!;
  while (show.hand.length < show.handSize) {
    const s = drawOne(run);
    if (!s) break;
    show.hand.push(s);
  }
}

// ---------------------------------------------------------------- player actions during a show
export function canPlace(run: RunState, cell: number): boolean {
  const c = run.show?.cells[cell];
  return !!c && run.phase === 'show' && !c.blocked && !c.shell;
}

/** Move a shell from the hand onto an empty cell. */
export function place(run: RunState, handIndex: number, cell: number): boolean {
  const show = run.show!;
  if (!canPlace(run, cell) || !show.hand[handIndex]) return false;
  show.cells[cell].shell = show.hand.splice(handIndex, 1)[0];
  show.cells[cell].locked = false;
  return true;
}

/** Take a not-yet-lit shell back into the hand. */
export function pickup(run: RunState, cell: number): boolean {
  const show = run.show!;
  const c = show.cells[cell];
  if (run.phase !== 'show' || !c?.shell || c.locked) return false;
  show.hand.push(c.shell);
  c.shell = null;
  return true;
}

/** Move a not-yet-lit shell to another empty cell. */
export function move(run: RunState, from: number, to: number): boolean {
  const show = run.show!;
  const a = show.cells[from];
  if (run.phase !== 'show' || !a?.shell || a.locked || !canPlace(run, to)) return false;
  show.cells[to].shell = a.shell;
  a.shell = null;
  return true;
}

/** Discard the whole hand and draw a fresh one. */
export function restock(run: RunState): boolean {
  const show = run.show!;
  if (run.phase !== 'show' || show.restocksLeft <= 0 || !show.hand.length) return false;
  show.discard.push(...show.hand);
  show.hand = [];
  show.restocksLeft--;
  refill(run);
  return true;
}

/** In-bounds, unblocked cells a shell at `idx` reaches. */
export function reach(show: ShowState, idx: number, type: ShellType): number[] {
  const c0 = cellCol(idx), r0 = cellRow(idx);
  const wind = show.weather === 'crosswind' ? 1 : 0;
  const out: number[] = [];
  for (const [dc, dr] of SHELLS[type].pattern) {
    const c = c0 + dc + wind, r = r0 + dr;
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
    const i = cellIdx(c, r);
    if (i === idx || show.cells[i].blocked) continue;
    out.push(i);
  }
  return out;
}

/** Work out the full chain reaction from lighting the shell at `start`. Does not change any state. */
export function resolve(run: RunState, start: number): Resolution {
  const show = run.show!;
  const has = (id: string) => hasCharm(run, id);
  const stargazer = has('stargazer') ? 2 : 1;
  const steps: Step[] = [];
  let S = 0, A = 1, order = 0, waves = 0;
  const visited = new Set<number>([start]);
  const queue: Array<{ idx: number; parent: number; wave: number }> = [{ idx: start, parent: -1, wave: 1 }];

  while (queue.length) {
    const cur = queue.shift()!;
    const cell = show.cells[cur.idx];
    const shell = cell.shell!;
    const def = SHELLS[shell.type];
    const lvl = run.levels[shell.type] ?? 0;
    const hits = reach(show, cur.idx, shell.type);
    waves = Math.max(waves, cur.wave);
    const reps = 1 + (shell.type === 'strobe' ? 1 : 0) + (cell.star === 'twin' ? stargazer : 0) + (cur.parent === -1 && has('echo') ? 1 : 0);
    for (let rep = 0; rep < reps; rep++) {
      order++;
      const notes: string[] = [];
      let dS = shell.type === 'kamuro' ? (KAMURO_PER_PLACE + KAMURO_LEVEL_PER_PLACE * lvl) * order : def.sparkle + lvl * LEVEL_SPARKLE;
      let dA = order > 1 ? 1 : 0;
      if (show.weather === 'drizzle') dS = Math.max(0, dS - 4);
      if (cell.star === 'bright') { dS += STAR_BRIGHT * stargazer; notes.push('Bright Star'); }
      if (cell.star === 'awe') { dA += STAR_AWE * stargazer; notes.push('Awe Star'); }
      if (cell.star === 'twin' && rep > 0) notes.push('Twin Star');
      if (has(`flag${shell.color}`)) { dS += 12; notes.push(`${COLOR_NAMES[shell.color]} Banner`); }
      const c = cellCol(cur.idx), r = cellRow(cur.idx);
      if (has('edge') && (c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1)) { dS += 8; notes.push('Edge Lights'); }
      if (has('corner') && (shell.type === 'crossette' || shell.type === 'ring')) { dS += 14; notes.push('Corner Pockets'); }
      if (has('opening') && order === 1 && show.ignitions === 0) { dS += 60; notes.push('Opening Act'); }
      if (rep === 0 && cur.parent >= 0 && show.weather !== 'tough' && show.cells[cur.parent].shell!.color === shell.color) {
        dA += has('choir') ? 3 : 1; notes.push('Harmony');
      }
      if (shell.type === 'glitter') { dA += 1; notes.push('Glitter'); }
      if (has('metronome') && order % 3 === 0) { dA += 2; notes.push('Metronome'); }
      if (has('flyer') && r < 2) { dA += 1; notes.push('High Flyer'); }
      if (has('favourite') && shell.type === 'peony') { dA += 1; notes.push('Crowd Favourite'); }

      const triggers: number[] = [];
      if (rep === 0) {
        for (const h of hits) {
          if (show.cells[h].shell && !visited.has(h)) {
            visited.add(h);
            triggers.push(h);
            queue.push({ idx: h, parent: cur.idx, wave: cur.wave + 1 });
          }
        }
      }
      S += dS; A += dA;
      steps.push({ idx: cur.idx, shell, order, wave: cur.wave, parent: cur.parent, repeat: rep, hits, triggers, dSparkle: dS, dAwe: dA, notes, sparkleAfter: S, aweAfter: A });
    }
  }

  // end-of-chain additive Awe lands on the final burst
  const last = steps[steps.length - 1];
  const addEnd = (name: string, awe: number) => {
    if (awe <= 0) return;
    A += awe; last.dAwe += awe; last.aweAfter = A; last.notes.push(name);
  };
  if (has('stopper')) addEnd('Showstopper', 4);
  if (has('slowfuse')) addEnd('Slow Fuse', waves);
  if (has('piggy')) addEnd('Piggy Bank', Math.min(8, Math.floor(run.coins / 4)));

  const mults: Array<{ name: string; x: number }> = [];
  const colors = new Set(steps.map((s) => s.shell.color));
  if (has('finale') && show.matchesLeft === 1) mults.push({ name: 'Grand Finale', x: 2 });
  if (has('spectrum') && colors.size === 4) mults.push({ name: 'Full Spectrum', x: 1.5 });
  if (has('mono') && order >= 4 && colors.size === 1) mults.push({ name: 'Monochrome', x: 3 });
  if (has('longfuse') && order >= 10) mults.push({ name: 'Long Fuse', x: 2 });
  const ovation = run.charms.find((c) => c.id === 'ovation');
  if (ovation && ovation.counter > 0) mults.push({ name: 'Standing Ovation', x: 1 + 0.1 * ovation.counter });
  if (has('solo') && run.crate.length <= 14) mults.push({ name: 'Travelling Light', x: 1.5 });

  const finalAwe = Math.round(mults.reduce((a, m) => a * m.x, A) * 10) / 10;
  const unlit = show.cells.filter((c, i) => c.shell && !visited.has(i)).length;
  return {
    steps, sparkle: S, awe: A, mults, finalAwe,
    score: Math.round(S * finalAwe),
    coins: has('penny') ? Math.min(3, Math.floor(order / 6)) : 0,
    chain: order, waves, unlit,
  };
}

/** Light the fuse. Scores the chain, locks the display in, spends a Match, refills the hand. */
export function ignite(run: RunState, start: number): Resolution | null {
  const show = run.show!;
  if (run.phase !== 'show' || show.matchesLeft <= 0 || !show.cells[start]?.shell) return null;
  const res = resolve(run, start);
  show.score += res.score;
  show.best = Math.max(show.best, res.score);
  show.ignitions++;
  show.matchesLeft--;
  run.coins += res.coins;
  run.stats.coinsEarned += res.coins;
  run.stats.bestIgnition = Math.max(run.stats.bestIgnition, res.score);
  run.stats.bestChain = Math.max(run.stats.bestChain, res.chain);
  run.stats.totalApplause += res.score;
  run.stats.shellsBurst += res.chain;
  for (const c of show.cells) if (c.shell) c.locked = true;

  const daily = run.mode === 'daily';
  if ((!daily && show.score >= show.target) || (daily && show.matchesLeft === 0)) clearShow(run);
  else if (show.matchesLeft === 0) run.phase = 'failed';
  else refill(run);
  return res;
}

function clearShow(run: RunState): void {
  const show = run.show!;
  const base = SHOW_COINS[run.showIdx];
  const matches = show.matchesLeft * COINS_PER_UNUSED_MATCH;
  const charms = hasCharm(run, 'tipjar') ? 2 : 0;
  const total = base + matches + charms;
  run.coins += total;
  run.stats.coinsEarned += total;
  run.lastReward = { base, matches, charms, total };
  run.stats.showsCleared++;
  if (run.showIdx === SHOWS_PER_NIGHT - 1) run.stats.nightsCleared++;
  for (const c of run.charms) if (c.id === 'ovation') c.counter++;
  run.phase = 'cleared';
}

/** True when the show just cleared was the last one of the mode (festival night 6 finale, or the daily's third show). */
export function isFinalShow(run: RunState): boolean {
  if (run.showIdx !== SHOWS_PER_NIGHT - 1) return false;
  return run.mode === 'daily' || (!run.endless && run.night === NIGHTS);
}

/** Leave the results card: go to the shop, or finish the run if that was the last show. */
export function proceed(run: RunState, continueEndless = false): void {
  if (run.phase !== 'cleared') return;
  if (isFinalShow(run)) {
    if (run.mode === 'festival' && continueEndless) run.endless = true;
    else { run.phase = 'won'; return; }
  }
  run.shopCount++;
  run.shop = rollShop(run, 0);
  run.phase = 'shop';
}

/** From 'won' on a festival run: keep playing into Endless nights. */
export function goEndless(run: RunState): void {
  if (run.phase !== 'won' || run.mode !== 'festival') return;
  run.endless = true;
  run.phase = 'cleared';
  proceed(run, true);
}

/** One extra Match after failing a show (granted by a rewarded ad, or free with Premium). Once per run. */
export function encore(run: RunState): boolean {
  if (run.phase !== 'failed' || run.encoreUsed) return false;
  run.encoreUsed = true;
  run.show!.matchesLeft = 1;
  run.phase = 'show';
  refill(run);
  return true;
}

export function giveUp(run: RunState): void {
  if (run.phase === 'failed' || run.phase === 'show') run.phase = 'lost';
}

// ---------------------------------------------------------------- shop
function rollShop(run: RunState, rerolls: number, prev?: ShopState): ShopState {
  const rng = new Rng(`${run.seed}|shop|${run.shopCount}|${rerolls}`);
  const owned = new Set(run.charms.map((c) => c.id));
  const charmPool = run.poolCharms.filter((id) => !owned.has(id));
  const charms = rng.sample(charmPool, SHOP_CHARMS).map((id) => ({ id, cost: CHARM_BY_ID[id].cost + stakeOf(run).charmCost }));
  const types = run.poolShells;
  const weights = types.map((t) => SHELLS[t].weight);
  const packs = Array.from({ length: SHOP_PACKS }, () => ({
    cost: PACK_COST,
    shells: Array.from({ length: PACK_SIZE }, () => ({ id: run.nextId++, type: rng.weighted(types, weights), color: rng.int(4) as Color })),
  }));
  const crateTypes = [...new Set(run.crate.map((s) => s.type))];
  const upType = rng.pick(crateTypes);
  return {
    charms, packs,
    upgrade: { type: upType, cost: UPGRADE_BASE_COST + 2 * (run.levels[upType] ?? 0) },
    trimCost: prev?.trimCost ?? TRIM_COST,
    rerolls,
    freeRerollUsed: prev?.freeRerollUsed ?? false,
    pending: null,
  };
}

export const rerollCost = (run: RunState) => REROLL_BASE_COST + (run.shop?.rerolls ?? 0);

export function reroll(run: RunState, free = false): boolean {
  const shop = run.shop;
  if (run.phase !== 'shop' || !shop || shop.pending) return false;
  if (free) {
    if (shop.freeRerollUsed) return false;
  } else {
    const cost = rerollCost(run);
    if (run.coins < cost) return false;
    run.coins -= cost;
  }
  const next = rollShop(run, shop.rerolls + 1, shop);
  if (free) next.freeRerollUsed = true;
  run.shop = next;
  return true;
}

export function buyCharm(run: RunState, slot: number): boolean {
  const offer = run.shop?.charms[slot];
  if (run.phase !== 'shop' || !offer || run.coins < offer.cost || run.charms.length >= MAX_CHARMS) return false;
  run.coins -= offer.cost;
  run.charms.push({ id: offer.id, counter: 0 });
  run.shop!.charms[slot] = null;
  return true;
}

export const sellValue = (id: string) => Math.floor(CHARM_BY_ID[id].cost / 2);

export function sellCharm(run: RunState, index: number): boolean {
  const c = run.charms[index];
  if (!c || (run.phase !== 'shop' && run.phase !== 'show')) return false;
  run.coins += sellValue(c.id);
  run.charms.splice(index, 1);
  return true;
}

export function buyPack(run: RunState, slot: number): boolean {
  const shop = run.shop;
  const offer = shop?.packs[slot];
  if (run.phase !== 'shop' || !shop || !offer || shop.pending || run.coins < offer.cost) return false;
  run.coins -= offer.cost;
  shop.pending = offer.shells;
  shop.packs[slot] = null;
  return true;
}

/** Choose one shell from the opened pack (or -1 to take none). */
export function choosePack(run: RunState, pick: number): boolean {
  const shop = run.shop;
  if (!shop?.pending) return false;
  if (pick >= 0 && shop.pending[pick]) run.crate.push(shop.pending[pick]);
  shop.pending = null;
  return true;
}

export function buyUpgrade(run: RunState): boolean {
  const up = run.shop?.upgrade;
  if (run.phase !== 'shop' || !up || run.coins < up.cost) return false;
  run.coins -= up.cost;
  run.levels[up.type] = (run.levels[up.type] ?? 0) + 1;
  run.shop!.upgrade = null;
  return true;
}

export function trim(run: RunState, shellId: number): boolean {
  const shop = run.shop;
  if (run.phase !== 'shop' || !shop || run.coins < shop.trimCost || run.crate.length <= MIN_CRATE) return false;
  const i = run.crate.findIndex((s) => s.id === shellId);
  if (i < 0) return false;
  run.coins -= shop.trimCost;
  shop.trimCost++;
  run.crate.splice(i, 1);
  return true;
}

export function leaveShop(run: RunState): void {
  if (run.phase !== 'shop' || run.shop?.pending) return;
  run.showIdx++;
  if (run.showIdx >= SHOWS_PER_NIGHT) { run.showIdx = 0; run.night++; }
  startShow(run);
}

// ---------------------------------------------------------------- helpers for UI / rewards
export function sparkleOf(run: RunState, type: ShellType): number {
  const lvl = run.levels[type] ?? 0;
  return type === 'kamuro' ? KAMURO_PER_PLACE + KAMURO_LEVEL_PER_PLACE * lvl : SHELLS[type].sparkle + lvl * LEVEL_SPARKLE;
}

/** Daily Show medal thresholds (total applause over the three shows). Calibrated with sim/balance.ts. */
export const DAILY_MEDALS = [30000, 50000, 70000];
/** Daily Show medal for a total applause score: 0 none, 1 bronze, 2 silver, 3 gold. */
export function dailyMedal(total: number): number {
  return total >= DAILY_MEDALS[2] ? 3 : total >= DAILY_MEDALS[1] ? 2 : total >= DAILY_MEDALS[0] ? 1 : 0;
}
export function dailyThresholds(): number[] {
  return DAILY_MEDALS.slice();
}
