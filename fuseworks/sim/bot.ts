// Headless bot that plays full runs through the real engine. Used by sim/balance.ts and by tests.
import { CELLS, CHARM_BY_ID, MAX_CHARMS, SHELLS, type ShellType } from '../src/engine/data';
import { Rng } from '../src/engine/rng';
import * as G from '../src/engine/run';
import type { RunState } from '../src/engine/types';

export interface BotOpts { samples: number; shop: boolean; rng: Rng }

function bestStart(run: RunState): { idx: number; score: number } {
  let best = { idx: -1, score: -1 };
  run.show!.cells.forEach((c, i) => {
    if (!c.shell) return;
    const s = G.resolve(run, i).score;
    if (s > best.score) best = { idx: i, score: s };
  });
  return best;
}

/** Try random placements of the hand, keep the layout whose best ignition scores highest. */
function planTurn(run: RunState, o: BotOpts): number {
  const show = run.show!;
  const snapshot = JSON.stringify(run);
  let bestScore = -1;
  let bestPlan: Array<[number, number]> = []; // [shellId, cell]
  for (let k = 0; k < o.samples; k++) {
    const trial: RunState = JSON.parse(snapshot);
    const ts = trial.show!;
    const plan: Array<[number, number]> = [];
    const count = ts.hand.length;
    for (let n = 0; n < count; n++) {
      const empties: number[] = [];
      const near: number[] = [];
      for (let i = 0; i < CELLS; i++) {
        if (!G.canPlace(trial, i)) continue;
        empties.push(i);
        // prefer cells that touch (or are reached by) the existing display
        const c = G.cellCol(i), r = G.cellRow(i);
        const touching = ts.cells.some((x, j) => x.shell && Math.abs(G.cellCol(j) - c) <= 1 && Math.abs(G.cellRow(j) - r) <= 1);
        if (touching) near.push(i);
      }
      if (!empties.length) break;
      const pool = near.length && o.rng.next() < 0.85 ? near : empties;
      const cell = o.rng.pick(pool);
      const hi = o.rng.int(ts.hand.length);
      plan.push([ts.hand[hi].id, cell]);
      G.place(trial, hi, cell);
    }
    const s = bestStart(trial).score;
    if (s > bestScore) { bestScore = s; bestPlan = plan; }
  }
  for (const [id, cell] of bestPlan) {
    const hi = show.hand.findIndex((s) => s.id === id);
    if (hi >= 0) G.place(run, hi, cell);
  }
  return bestStart(run).idx;
}

const CHARM_PRIORITY = ['longfuse', 'finale', 'matchbook', 'pockets', 'metronome', 'choir', 'ovation', 'slowfuse', 'flyer', 'favourite', 'stopper', 'mono', 'spectrum'];

function shopTurn(run: RunState, o: BotOpts): void {
  const shop = run.shop!;
  if (o.shop) {
    const order = shop.charms
      .map((c, i) => ({ c, i }))
      .filter((x) => x.c)
      .sort((a, b) => {
        const pa = CHARM_PRIORITY.indexOf(a.c!.id), pb = CHARM_PRIORITY.indexOf(b.c!.id);
        return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
      });
    for (const { i } of order) if (run.charms.length < MAX_CHARMS) G.buyCharm(run, i);
    if (shop.upgrade && run.coins >= shop.upgrade.cost) G.buyUpgrade(run);
    for (let p = 0; p < shop.packs.length; p++) {
      if (G.buyPack(run, p)) {
        const pend = run.shop!.pending!;
        // take the highest-sparkle connector
        let best = 0;
        pend.forEach((s, k) => { if (SHELLS[s.type].sparkle + SHELLS[s.type].pattern.length * 3 > SHELLS[pend[best].type].sparkle + SHELLS[pend[best].type].pattern.length * 3) best = k; });
        G.choosePack(run, best);
      }
    }
  }
  G.leaveShop(run);
}

export interface RunLog { won: boolean; reached: number; ratios: number[]; charms: string[]; run: RunState }

/** Play one run to the end. `reached` = number of shows cleared (18 = festival won). */
export function playRun(run: RunState, o: BotOpts, maxShows = 18): RunLog {
  const ratios: number[] = [];
  let guard = 0;
  while (guard++ < 2000) {
    if (run.phase === 'show') {
      const start = planTurn(run, o);
      if (start < 0) { G.giveUp(run); continue; }
      G.ignite(run, start);
    } else if (run.phase === 'cleared') {
      ratios.push(run.show!.score / run.show!.target);
      if (run.stats.showsCleared >= maxShows) { G.proceed(run); (run as RunState).phase = 'won'; }
      else G.proceed(run);
    } else if (run.phase === 'failed') {
      ratios.push(run.show!.score / run.show!.target);
      G.giveUp(run);
    } else if (run.phase === 'shop') shopTurn(run, o);
    else break;
  }
  return { won: run.phase === 'won', reached: run.stats.showsCleared, ratios, charms: run.charms.map((c) => CHARM_BY_ID[c.id].name), run };
}

export const ALL_SHELLS = Object.keys(SHELLS) as ShellType[];
