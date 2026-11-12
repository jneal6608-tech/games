import { describe, expect, it } from 'vitest';
import { CHARMS, CRATES, MAX_CHARMS, SHELLS, SHELL_TYPES, WEATHER, targetFor, type Color, type ShellType } from '../src/engine/data';
import { ACHIEVEMENTS, reconcilePurchases, bankRun, checkAchievements, dayKey, defaultMeta, liveStreak, migrateMeta, previousDay, unlock } from '../src/engine/meta';
import { Rng } from '../src/engine/rng';
import * as G from '../src/engine/run';
import type { RunState } from '../src/engine/types';
import { ALL_SHELLS, playRun } from '../sim/bot';

const starterShells = SHELL_TYPES.filter((t) => SHELLS[t].unlock === 0);
const starterCharms = CHARMS.filter((c) => c.unlock === 0).map((c) => c.id);
const fresh = (seed = 'TEST', extra: Partial<G.NewRunOpts> = {}) => G.newRun({ seed, poolShells: starterShells, poolCharms: starterCharms, ...extra });

/** A run with an empty, modifier-free sky and nothing in hand, for exact scoring checks. */
function lab(): RunState {
  const run = fresh('LAB');
  const show = run.show!;
  show.cells.forEach((c) => { c.star = null; c.blocked = false; c.shell = null; c.locked = false; });
  show.weather = null;
  return run;
}
let uid = 1000;
const put = (run: RunState, c: number, r: number, type: ShellType, color: Color = 0) => {
  run.show!.cells[G.cellIdx(c, r)].shell = { id: uid++, type, color };
  return G.cellIdx(c, r);
};

describe('rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = new Rng('x'), b = new Rng('x'), c = new Rng('y');
    const seqA = Array.from({ length: 20 }, () => a.next());
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(seqA);
    expect(Array.from({ length: 20 }, () => c.next())).not.toEqual(seqA);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });
  it('shuffle keeps every element', () => {
    const arr = Array.from({ length: 30 }, (_, i) => i);
    expect(new Rng('s').shuffle(arr.slice()).sort((x, y) => x - y)).toEqual(arr);
  });
});

describe('chain resolution and scoring', () => {
  it('a single shell scores Sparkle x 1', () => {
    const run = lab();
    const i = put(run, 2, 2, 'peony');
    const res = G.resolve(run, i);
    expect(res).toMatchObject({ chain: 1, sparkle: 10, awe: 1, score: 10 });
  });
  it('chain adds +1 Awe per extra burst, and Harmony +1 for same colour', () => {
    const run = lab();
    const a = put(run, 2, 2, 'peony', 0);
    put(run, 2, 3, 'peony', 0); // same colour: harmony
    put(run, 3, 2, 'peony', 1); // different colour
    const res = G.resolve(run, a);
    expect(res.chain).toBe(3);
    expect(res.sparkle).toBe(30);
    expect(res.awe).toBe(1 + 2 + 1);
    expect(res.score).toBe(120);
    expect(res.steps.filter((s) => s.notes.includes('Harmony')).length).toBe(1);
  });
  it('reach is directional: a comet fires upward only', () => {
    const run = lab();
    const comet = put(run, 2, 4, 'comet');
    const above = put(run, 2, 2, 'salute');
    expect(G.resolve(run, comet).chain).toBe(2);
    expect(G.resolve(run, above).chain).toBe(1);
  });
  it('unreached shells are reported as unlit and do not score', () => {
    const run = lab();
    const a = put(run, 0, 0, 'peony');
    put(run, 4, 5, 'brocade');
    const res = G.resolve(run, a);
    expect(res.chain).toBe(1);
    expect(res.unlit).toBe(1);
  });
  it('star cells: bright +25 Sparkle, awe +2 Awe, twin bursts twice', () => {
    const run = lab();
    const a = put(run, 1, 1, 'peony');
    run.show!.cells[a].star = 'bright';
    expect(G.resolve(run, a).score).toBe(35);
    run.show!.cells[a].star = 'awe';
    expect(G.resolve(run, a).score).toBe(10 * 3);
    run.show!.cells[a].star = 'twin';
    const twin = G.resolve(run, a);
    expect(twin.chain).toBe(2);
    expect(twin.score).toBe(20 * 2);
  });
  it('strobe bursts twice, glitter adds Awe, kamuro scales with its place, salute ends chains', () => {
    const run = lab();
    const s = put(run, 2, 2, 'strobe');
    expect(G.resolve(run, s)).toMatchObject({ chain: 2, sparkle: 18, awe: 2 });
    const run2 = lab();
    const g = put(run2, 2, 2, 'glitter');
    expect(G.resolve(run2, g).awe).toBe(2);
    const run3 = lab();
    const p = put(run3, 2, 2, 'peony', 0);
    put(run3, 2, 3, 'kamuro', 1);
    expect(G.resolve(run3, p).sparkle).toBe(10 + 4 * 2);
    expect(SHELLS.salute.pattern.length).toBe(0);
  });
  it('blocked cells stop a burst reaching through them', () => {
    const run = lab();
    const a = put(run, 2, 2, 'peony');
    const b = put(run, 2, 3, 'peony');
    run.show!.cells[b].shell = null;
    run.show!.cells[b].blocked = true;
    expect(G.reach(run.show!, a, 'peony')).not.toContain(b);
  });
  it('crosswind shifts every pattern one cell right', () => {
    const run = lab();
    run.show!.weather = 'crosswind';
    const a = put(run, 1, 2, 'peony');
    const reached = G.reach(run.show!, a, 'peony');
    expect(reached).toContain(G.cellIdx(3, 2));
    expect(reached).toContain(G.cellIdx(2, 1));
    expect(reached).not.toContain(G.cellIdx(0, 2));
    expect(reached).not.toContain(a);
  });
  it('drizzle and tough crowd weather change scoring', () => {
    const run = lab();
    const a = put(run, 2, 2, 'peony', 0);
    put(run, 2, 3, 'peony', 0);
    run.show!.weather = 'drizzle';
    expect(G.resolve(run, a).sparkle).toBe(12);
    run.show!.weather = 'tough';
    expect(G.resolve(run, a).awe).toBe(2);
  });
  it('refining a shell type adds 10 Sparkle per level', () => {
    const run = lab();
    const a = put(run, 2, 2, 'peony');
    run.levels.peony = 2;
    expect(G.resolve(run, a).sparkle).toBe(30);
  });
});

describe('charms', () => {
  const withCharm = (id: string) => { const run = lab(); run.charms = [{ id, counter: 0 }]; return run; };
  it('banner adds Sparkle to its colour only', () => {
    const run = withCharm('flag0');
    const a = put(run, 2, 2, 'peony', 0);
    put(run, 2, 3, 'peony', 1);
    expect(G.resolve(run, a).sparkle).toBe(10 + 12 + 10);
  });
  it('grand finale doubles Awe only on the last Match', () => {
    const run = withCharm('finale');
    const a = put(run, 2, 2, 'peony');
    run.show!.matchesLeft = 2;
    expect(G.resolve(run, a).mults).toEqual([]);
    run.show!.matchesLeft = 1;
    expect(G.resolve(run, a).score).toBe(20);
  });
  it('echo makes the lit shell burst twice', () => {
    const run = withCharm('echo');
    expect(G.resolve(run, put(run, 2, 2, 'peony')).chain).toBe(2);
  });
  it('monochrome needs 4+ bursts of one colour', () => {
    const run = withCharm('mono');
    const a = put(run, 1, 2, 'wave', 0);
    put(run, 0, 2, 'salute', 0); put(run, 2, 2, 'salute', 0);
    expect(G.resolve(run, a).mults).toEqual([]);
    put(run, 3, 2, 'salute', 0);
    expect(G.resolve(run, a).mults).toEqual([{ name: 'Monochrome', x: 3 }]);
  });
  it('standing ovation grows as shows are cleared', () => {
    const run = withCharm('ovation');
    const a = put(run, 2, 2, 'peony');
    expect(G.resolve(run, a).score).toBe(10);
    run.charms[0].counter = 5;
    expect(G.resolve(run, a).finalAwe).toBe(1.5);
  });
  it('passive charms change the show setup', () => {
    const base = fresh('P');
    const run = fresh('P');
    run.charms = [{ id: 'matchbook', counter: 0 }, { id: 'pockets', counter: 0 }, { id: 'restocker', counter: 0 }, { id: 'lucky', counter: 0 }];
    G.startShow(run);
    expect(run.show!.matchesTotal).toBe(base.show!.matchesTotal + 1);
    expect(run.show!.handSize).toBe(base.show!.handSize + 1);
    expect(run.show!.restocksLeft).toBe(base.show!.restocksLeft + 1);
    expect(run.show!.cells.filter((c) => c.star).length).toBe(base.show!.cells.filter((c) => c.star).length + 2);
  });
  it('every charm resolves to a finite score on a busy sky', () => {
    for (const c of CHARMS) {
      const run = lab();
      run.charms = [{ id: c.id, counter: 3 }];
      run.coins = 20;
      const a = put(run, 2, 2, 'ring', 0);
      (['peony', 'crossette', 'comet', 'willow', 'wave', 'brocade', 'strobe', 'kamuro'] as ShellType[]).forEach((t, i) => put(run, [1, 3, 2, 2, 1, 3, 1, 3][i], [2, 2, 1, 3, 1, 1, 3, 3][i], t, (i % 4) as Color));
      const res = G.resolve(run, a);
      expect(Number.isFinite(res.score), c.id).toBe(true);
      expect(res.score, c.id).toBeGreaterThan(0);
      expect(res.steps[res.steps.length - 1].aweAfter, c.id).toBe(res.awe);
    }
  });
});

describe('show flow', () => {
  it('starts with a full hand and the crate split between hand and draw pile', () => {
    const run = fresh();
    expect(run.show!.hand.length).toBe(5);
    expect(run.show!.hand.length + run.show!.draw.length).toBe(run.crate.length);
    expect(run.show!.target).toBe(targetFor(1, 0, 1));
  });
  it('place, move, pick up, and restock behave', () => {
    const run = fresh();
    const first = run.show!.hand[0];
    const free = run.show!.cells.findIndex((c) => !c.blocked);
    expect(G.place(run, 0, free)).toBe(true);
    expect(G.place(run, 0, free)).toBe(false); // occupied
    expect(run.show!.cells[free].shell).toBe(first);
    const other = run.show!.cells.findIndex((c, i) => !c.blocked && i !== free);
    expect(G.move(run, free, other)).toBe(true);
    expect(G.pickup(run, other)).toBe(true);
    expect(run.show!.hand).toContain(first);
    const before = run.show!.hand.map((s) => s.id);
    expect(G.restock(run)).toBe(true);
    expect(run.show!.hand.map((s) => s.id)).not.toEqual(before);
    expect(run.show!.restocksLeft).toBe(1);
  });
  it('igniting locks the display, spends a Match and refills the hand', () => {
    const run = fresh();
    run.show!.target = 1e9;
    const cell = run.show!.cells.findIndex((c) => !c.blocked);
    G.place(run, 0, cell);
    const res = G.ignite(run, cell)!;
    expect(res.chain).toBeGreaterThan(0);
    expect(run.show!.cells[cell].locked).toBe(true);
    expect(G.pickup(run, cell)).toBe(false);
    expect(run.show!.matchesLeft).toBe(2);
    expect(run.show!.hand.length).toBe(5);
    expect(run.show!.score).toBe(res.score);
  });
  it('the display fires again on later Matches', () => {
    const run = fresh();
    run.show!.target = 1e9;
    const cell = run.show!.cells.findIndex((c) => !c.blocked && !c.star);
    G.place(run, 0, cell);
    const a = G.ignite(run, cell)!;
    const b = G.ignite(run, cell)!;
    expect(b.score).toBe(a.score);
    expect(run.show!.score).toBe(a.score * 2);
  });
  it('reaching the target clears the show and pays coins; unused Matches pay extra', () => {
    const run = fresh();
    run.show!.target = 1;
    const coins = run.coins;
    const cell = run.show!.cells.findIndex((c) => !c.blocked);
    G.place(run, 0, cell);
    G.ignite(run, cell);
    expect(run.phase).toBe('cleared');
    expect(run.coins).toBe(coins + 4 + 2 * 2);
    expect(run.lastReward).toMatchObject({ base: 4, matches: 4, total: 8 });
    G.proceed(run);
    expect(run.phase).toBe('shop');
  });
  it('running out of Matches fails; Encore works exactly once', () => {
    const run = fresh();
    run.show!.target = 1e9;
    const cell = run.show!.cells.findIndex((c) => !c.blocked);
    G.place(run, 0, cell);
    for (let i = 0; i < 3; i++) G.ignite(run, cell);
    expect(run.phase).toBe('failed');
    expect(G.encore(run)).toBe(true);
    expect(run.phase).toBe('show');
    expect(run.show!.matchesLeft).toBe(1);
    G.ignite(run, cell);
    expect(run.phase).toBe('failed');
    expect(G.encore(run)).toBe(false);
    G.giveUp(run);
    expect(run.phase).toBe('lost');
  });
  it('weather only appears on finales after night 1, and modifies the show', () => {
    const run = fresh('W');
    expect(run.show!.weather).toBeNull();
    run.night = 3; run.showIdx = 2;
    G.startShow(run);
    expect(WEATHER.map((w) => w.id)).toContain(run.show!.weather);
  });
  it('the tutorial show always deals the scripted opening hand', () => {
    for (const seed of ['A', 'B', 'C']) {
      const run = fresh(seed, { tutorial: true });
      expect(run.show!.hand.map((s) => `${s.type}${s.color}`)).toEqual(['peony0', 'peony0', 'crossette1', 'peony2', 'comet0']);
      expect(run.show!.cells[G.cellIdx(2, 2)].star).toBe('bright');
    }
  });
});

describe('market', () => {
  const toShop = (seed = 'SHOP') => {
    const run = fresh(seed);
    run.show!.target = 1;
    const cell = run.show!.cells.findIndex((c) => !c.blocked);
    G.place(run, 0, cell); G.ignite(run, cell); G.proceed(run);
    return run;
  };
  it('offers charms, packs and a refinement; identical for the same seed', () => {
    const a = toShop(), b = toShop();
    expect(a.shop!.charms.length).toBe(3);
    expect(a.shop!.packs.length).toBe(2);
    expect(a.shop!.upgrade).not.toBeNull();
    expect(JSON.stringify(a.shop)).toBe(JSON.stringify(b.shop));
    expect(JSON.stringify(toShop('OTHER').shop)).not.toBe(JSON.stringify(a.shop));
  });
  it('buying respects coins and the 5-charm limit; selling refunds half', () => {
    const run = toShop();
    run.coins = 0;
    expect(G.buyCharm(run, 0)).toBe(false);
    run.coins = 100;
    const id = run.shop!.charms[0]!.id, cost = run.shop!.charms[0]!.cost;
    expect(G.buyCharm(run, 0)).toBe(true);
    expect(run.coins).toBe(100 - cost);
    expect(run.charms[0].id).toBe(id);
    expect(G.buyCharm(run, 0)).toBe(false); // slot now empty
    run.charms = Array.from({ length: MAX_CHARMS }, () => ({ id: 'edge', counter: 0 }));
    expect(G.buyCharm(run, 1)).toBe(false);
    const c = run.coins;
    G.sellCharm(run, 0);
    expect(run.coins).toBe(c + G.sellValue('edge'));
  });
  it('packs add exactly the chosen shell; the market cannot be left mid-pick', () => {
    const run = toShop();
    run.coins = 50;
    const size = run.crate.length;
    expect(G.buyPack(run, 0)).toBe(true);
    const pick = run.shop!.pending![1];
    G.leaveShop(run);
    expect(run.phase).toBe('shop');
    G.choosePack(run, 1);
    expect(run.crate.length).toBe(size + 1);
    expect(run.crate).toContain(pick);
    G.buyPack(run, 1); G.choosePack(run, -1);
    expect(run.crate.length).toBe(size + 1);
  });
  it('refine, trim and reroll charge the right amounts', () => {
    const run = toShop();
    run.coins = 50;
    const up = run.shop!.upgrade!;
    G.buyUpgrade(run);
    expect(run.levels[up.type]).toBe(1);
    expect(run.coins).toBe(50 - up.cost);
    const size = run.crate.length, coins = run.coins;
    expect(G.trim(run, run.crate[0].id)).toBe(true);
    expect(run.crate.length).toBe(size - 1);
    expect(run.coins).toBe(coins - 2);
    expect(run.shop!.trimCost).toBe(3);
    run.crate = run.crate.slice(0, G.MIN_CRATE);
    expect(G.trim(run, run.crate[0].id)).toBe(false);
    const c2 = run.coins;
    expect(G.reroll(run)).toBe(true);
    expect(run.coins).toBe(c2 - 2);
    expect(G.rerollCost(run)).toBe(3);
    expect(G.reroll(run, true)).toBe(true);
    expect(G.reroll(run, true)).toBe(false); // one free reroll per visit
  });
  it('leaving the market advances show and night', () => {
    const run = toShop();
    G.leaveShop(run);
    expect([run.night, run.showIdx, run.phase]).toEqual([1, 1, 'show']);
  });
});

describe('determinism and saves', () => {
  it('the same seed and the same bot produce the same run', () => {
    const play = () => playRun(fresh('DET'), { samples: 6, shop: true, rng: new Rng('bot') }).run;
    expect(JSON.stringify(play())).toBe(JSON.stringify(play()));
  });
  it('a run survives a JSON round trip mid-show and continues identically', () => {
    const a = fresh('SAVE');
    a.show!.target = 1e9;
    const cell = a.show!.cells.findIndex((c) => !c.blocked);
    G.place(a, 0, cell); G.ignite(a, cell);
    const b: RunState = JSON.parse(JSON.stringify(a));
    const next = a.show!.cells.findIndex((c, i) => !c.blocked && !c.shell && i !== cell);
    for (const r of [a, b]) { G.place(r, 0, next); G.restock(r); G.ignite(r, cell); }
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
  it('bots can finish whole runs on every crate without breaking invariants', () => {
    for (const crate of CRATES) {
      for (let i = 0; i < 4; i++) {
        const run = G.newRun({ seed: `INV${crate.id}${i}`, crateId: crate.id, stake: 1 + (i % 5), poolShells: ALL_SHELLS, poolCharms: CHARMS.map((c) => c.id) });
        const log = playRun(run, { samples: 5, shop: true, rng: new Rng(`b${i}`) });
        expect(['won', 'lost']).toContain(log.run.phase);
        expect(new Set(log.run.crate.map((s) => s.id)).size).toBe(log.run.crate.length);
        expect(log.run.charms.length).toBeLessThanOrEqual(MAX_CHARMS);
        expect(log.run.coins).toBeGreaterThanOrEqual(0);
        const show = log.run.show!;
        const onSky = show.cells.filter((c) => c.shell).length;
        expect(show.hand.length + show.draw.length + show.discard.length + onSky).toBe(log.run.crate.length);
      }
    }
  });
  it('the Daily Show is identical for everyone and always plays all three shows', () => {
    const mk = () => G.newRun({ seed: 'DAILY-2026-01-01', mode: 'daily', poolShells: starterShells, poolCharms: starterCharms });
    const a = mk(), b = mk();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.charms.length).toBe(2);
    const log = playRun(a, { samples: 4, shop: true, rng: new Rng('d') });
    expect(log.run.phase).toBe('won');
    expect(log.run.stats.showsCleared).toBe(3);
    expect(G.dailyMedal(0)).toBe(0);
    expect(G.dailyMedal(G.DAILY_MEDALS[2])).toBe(3);
  });
  it('winning the festival can continue into Endless with rising targets', () => {
    expect(targetFor(7, 0, 1)).toBeGreaterThan(targetFor(6, 0, 1));
    const run = fresh('END');
    run.night = 6; run.showIdx = 2; G.startShow(run);
    run.show!.target = 1;
    const cell = run.show!.cells.findIndex((c) => !c.blocked);
    G.place(run, 0, cell); G.ignite(run, cell);
    expect(G.isFinalShow(run)).toBe(true);
    G.proceed(run, true);
    expect(run.phase).toBe('shop');
    G.leaveShop(run);
    expect(run.night).toBe(7);
  });
});

describe('endless mode', () => {
  const endless = (seed = 'ENDLESS') => fresh(seed, { mode: 'endless', stake: 4 });
  const clearCurrentShow = (run: RunState) => {
    run.show!.target = 1;
    const cell = run.show!.cells.findIndex((c) => !c.blocked);
    G.place(run, 0, cell); G.ignite(run, cell);
  };
  it('starts as an endless run at stake 1 with festival-style targets', () => {
    const run = endless();
    expect(run.mode).toBe('endless');
    expect(run.endless).toBe(true);
    expect(run.stake).toBe(1);
    expect(run.show!.target).toBe(targetFor(1, 0, 1));
  });
  it('has no final night: the night-6 finale leads to the market and night 7', () => {
    const run = endless();
    run.night = 6; run.showIdx = 2; G.startShow(run);
    clearCurrentShow(run);
    expect(run.phase).toBe('cleared');
    expect(G.isFinalShow(run)).toBe(false);
    G.proceed(run);
    expect(run.phase).toBe('shop');
    G.leaveShop(run);
    expect([run.night, run.showIdx]).toEqual([7, 0]);
    expect(run.show!.target).toBeGreaterThan(targetFor(6, 0, 1));
  });
  it('keeps night 1 free of weather, like the festival', () => {
    const run = endless('E2');
    run.showIdx = 2; G.startShow(run);
    expect(run.show!.weather).toBeNull();
  });
  it('a bot can play it until it loses, never "winning"', () => {
    const log = playRun(endless('E3'), { samples: 5, shop: true, rng: new Rng('eb') }, 999);
    expect(log.run.phase).toBe('lost');
  });
  it('banks tickets and an Endless record, but no festival win, stake unlock or win bonus', () => {
    const m = defaultMeta();
    const run = endless('E4');
    run.stats = { ...run.stats, showsCleared: 24, nightsCleared: 8 };
    run.phase = 'lost';
    const reward = bankRun(m, run, '2026-01-01');
    expect(reward.tickets).toBe(24 * 2 + 8 * 4);
    expect(reward.won).toBe(false);
    expect(reward.endlessBest).toBe(true);
    expect(m.stats.bestEndless).toBe(8);
    expect(m.stats.wins).toBe(0);
    expect(m.stakeMax).toBe(1);
    const got = checkAchievements(m, run).map((a) => a.id);
    expect(got).toContain('endless8');
    expect(got).not.toContain('win');
    const again = endless('E5');
    again.stats = { ...again.stats, nightsCleared: 3 };
    again.phase = 'lost';
    expect(bankRun(m, again, '2026-01-01').endlessBest).toBe(false);
    expect(m.stats.bestEndless).toBe(8);
  });
  it('old saves without an Endless record load with zero', () => {
    expect(migrateMeta({ stats: { runs: 3 } }).stats).toMatchObject({ runs: 3, bestEndless: 0 });
  });
});

describe('store purchase delivery', () => {
  const packs = [{ productId: 'tickets_60', tickets: 60 }, { productId: 'tickets_200', tickets: 200 }];
  const P = (productId: string, token: string, state = '1', acknowledged = false) => ({ productId, token, state, acknowledged });
  it('delivers a paid ticket pack once and asks for it to be consumed', () => {
    const m = defaultMeta();
    const r = reconcilePurchases(m, [P('tickets_200', 'A')], packs, 'premium_unlock');
    expect(r).toMatchObject({ tickets: 200, consume: ['A'], acknowledge: [], pending: 0 });
    expect(m.tickets).toBe(200);
  });
  it('never pays the same purchase twice, but keeps asking to consume it until that succeeds', () => {
    const m = defaultMeta();
    reconcilePurchases(m, [P('tickets_60', 'A')], packs, 'premium_unlock');
    const again = reconcilePurchases(m, [P('tickets_60', 'A')], packs, 'premium_unlock'); // e.g. app died before consume
    expect(again.tickets).toBe(0);
    expect(again.consume).toEqual(['A']);
    expect(m.tickets).toBe(60);
  });
  it('a crash after saving but before consuming: the reloaded save still knows the purchase was paid', () => {
    const m = defaultMeta();
    reconcilePurchases(m, [P('tickets_200', 'B')], packs, 'premium_unlock');
    const reloaded = migrateMeta(JSON.parse(JSON.stringify(m)));
    expect(reconcilePurchases(reloaded, [P('tickets_200', 'B')], packs, 'premium_unlock').tickets).toBe(0);
    expect(reloaded.tickets).toBe(200);
  });
  it('pending payments give nothing until they clear, then deliver', () => {
    const m = defaultMeta();
    const r = reconcilePurchases(m, [P('tickets_200', 'C', '2')], packs, 'premium_unlock');
    expect(r).toMatchObject({ tickets: 0, consume: [], pending: 1 });
    expect(m.tickets).toBe(0);
    expect(reconcilePurchases(m, [P('tickets_200', 'C', '1')], packs, 'premium_unlock').tickets).toBe(200);
  });
  it('several undelivered packs at once all arrive', () => {
    const m = defaultMeta();
    const r = reconcilePurchases(m, [P('tickets_60', 'D'), P('tickets_60', 'E'), P('tickets_200', 'F')], packs, 'premium_unlock');
    expect(r.tickets).toBe(320);
    expect(r.consume).toEqual(['D', 'E', 'F']);
  });
  it('Premium is granted and acknowledged if needed, never consumed', () => {
    const m = defaultMeta();
    const r = reconcilePurchases(m, [P('premium_unlock', 'G')], packs, 'premium_unlock');
    expect(r).toMatchObject({ premiumGranted: true, acknowledge: ['G'], consume: [] });
    expect(m.premium).toBe(true);
    expect(reconcilePurchases(m, [P('premium_unlock', 'G', '1', true)], packs, 'premium_unlock')).toMatchObject({ premiumGranted: false, acknowledge: [] });
  });
  it('unknown products are ignored and old saves load with an empty delivery record', () => {
    const m = defaultMeta();
    expect(reconcilePurchases(m, [P('something_else', 'H')], packs, 'premium_unlock')).toMatchObject({ tickets: 0, consume: [], acknowledge: [] });
    expect(migrateMeta({ tickets: 5 }).grantedTokens).toEqual([]);
  });
});

describe('meta progression', () => {
  it('migrates partial or broken saves to a complete one', () => {
    expect(migrateMeta(null)).toEqual(defaultMeta());
    const m = migrateMeta({ tickets: 12.7, shells: ['dragon', 'nonsense'], stakeMax: 99, settings: { music: false }, sky: 'aurora' });
    expect(m.tickets).toBe(12);
    expect(m.shells).toContain('dragon');
    expect(m.shells).toContain('peony');
    expect(m.shells).not.toContain('nonsense');
    expect(m.stakeMax).toBe(5);
    expect(m.settings).toMatchObject({ music: false, sfx: true });
    expect(m.sky).toBe('harbor'); // aurora needs premium
  });
  it('unlocking spends tickets once', () => {
    const m = defaultMeta();
    expect(unlock(m, 'shell', 'palm')).toBe(false);
    m.tickets = 20;
    expect(unlock(m, 'shell', 'palm')).toBe(true);
    expect(m.tickets).toBe(20 - SHELLS.palm.unlock);
    expect(unlock(m, 'shell', 'palm')).toBe(false);
    expect(unlock(m, 'sky', 'aurora')).toBe(false);
  });
  it('banks tickets and stats from a finished run, and unlocks the next stake on a win', () => {
    const m = defaultMeta();
    const run = fresh('BANK');
    run.stats = { ...run.stats, showsCleared: 18, nightsCleared: 6, bestChain: 21, bestIgnition: 120000 };
    run.phase = 'won';
    const reward = bankRun(m, run, '2026-01-01');
    expect(reward.tickets).toBe(18 * 2 + 6 * 4 + 25);
    expect(m.tickets).toBe(reward.tickets);
    expect(m.stakeMax).toBe(2);
    expect(reward.newStake).toBe(2);
    const got = checkAchievements(m, run).map((a) => a.id);
    expect(got).toEqual(expect.arrayContaining(['first', 'chain10', 'chain20', 'ign10k', 'ign100k', 'night3', 'win']));
    expect(checkAchievements(m, run)).toEqual([]); // never granted twice
    expect(ACHIEVEMENTS.length).toBeGreaterThan(10);
  });
  it('tracks the daily streak and only pays replays for a better medal', () => {
    const m = defaultMeta();
    const daily = (total: number) => { const r = G.newRun({ seed: 'D', mode: 'daily', poolShells: starterShells, poolCharms: starterCharms }); r.stats.totalApplause = total; r.phase = 'won'; return r; };
    const d1 = '2026-03-01', d2 = '2026-03-02', d4 = '2026-03-04';
    expect(previousDay(d1)).toBe('2026-02-28');
    const first = bankRun(m, daily(G.DAILY_MEDALS[0]), d1);
    expect(first.tickets).toBe(6 + 4);
    expect(m.daily.streak).toBe(1);
    expect(bankRun(m, daily(100), d1).tickets).toBe(0);
    expect(m.daily.scores[d1].score).toBe(G.DAILY_MEDALS[0]);
    expect(bankRun(m, daily(G.DAILY_MEDALS[2]), d1).tickets).toBe(8);
    bankRun(m, daily(1), d2);
    expect(m.daily.streak).toBe(2);
    expect(liveStreak(m, d2)).toBe(2);
    expect(liveStreak(m, d4)).toBe(0);
    bankRun(m, daily(1), d4);
    expect(m.daily.streak).toBe(1);
    expect(m.daily.bestStreak).toBe(2);
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
