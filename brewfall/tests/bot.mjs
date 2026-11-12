// Headless bot used for balance checks and logic tests. Plays whole runs with real physics.
import { World, W, RADII, LINE_Y, DROP_Y } from '../web/src/physics.js';
import { Run } from '../web/src/run.js';
import * as D from '../web/src/data.js';

export function chooseX(world, tier, rng, skill = 1) {
  const r = RADII[tier];
  if (rng.next() > skill) return r + rng.next() * (W - 2 * r);
  let best = null;
  for (const b of world.bodies) {
    if (b.tier !== tier) continue;
    const blocked = world.bodies.some(o => o !== b && o.y < b.y && Math.abs(o.x - b.x) < o.r + r * 0.8);
    if (!blocked && (!best || b.y > best.y)) best = b;
  }
  if (best) return best.x;
  let bx = W / 2, bh = -1;
  for (let x = r; x <= W - r; x += 12) {
    let top = 500; for (const b of world.bodies) if (Math.abs(b.x - x) < b.r + r) top = Math.min(top, b.y - b.r);
    if (top > bh) { bh = top; bx = x; }
  }
  return bx;
}
export function playRound(run, world, opts = {}) {
  world.load(run.bodies); world.magnet = run.has('magnet') ? D.CHARM.magnet.magnet : 0;
  const limit = 2.5 * (run.has('deep') ? 2 : 1);
  const onMerge = e => run.merge(e.tier, world.bodies.length);
  const sim = secs => { for (let i = 0; i < secs * 60; i++) { world.step(1 / 60, onMerge); if (world.overT > limit) return true; } return false; };
  while (true) {
    const s = run.status(world.settled());
    if (s === 'won') { run.bodies = world.serialize(); return 'won'; }
    if (s === 'lost') return 'lost';
    if (run.dropsLeft > 0) {
      if (opts.tonics) while (run.tonics.length) run.useTonic(0, world);
      const t = run.drop(); world.add(t, chooseX(world, t, run.rng, opts.skill ?? 1), DROP_Y);
    }
    if (sim(1.6)) return 'overflow';
    if (run.dropsLeft <= 0) { if (sim(3)) return 'overflow'; if (!run.reached) return 'lost'; }
  }
}
export function playRun(seed, opts = {}) {
  const run = new Run({ seed, familiar: opts.familiar, stake: opts.stake || 0, pool: opts.pool });
  const world = new World(); const log = [];
  while (true) {
    const o = run.order, r = run.round, tgt = run.target;
    const res = playRound(run, world, opts);
    log.push({ o, r, tgt, score: run.score, res, orbs: world.bodies.length });
    if (res !== 'won') { run.loseRound(); break; }
    const w = run.winRound(); if (w.won) break;
    if (opts.shop !== false) {
      for (let pass = 0; pass < 2; pass++) {
        run.shop.charms.forEach((c, i) => run.buyCharm(i));
        if (run.sparks >= 8) run.buyRecipe();
        if (opts.tonics) run.shop.tonics.forEach((c, i) => run.buyTonic(i));
        if (pass === 0 && run.sparks >= 12 && run.charms.length < run.charmSlots) run.reroll();
      }
    }
    run.leaveShop();
  }
  return { run, log };
}
if (process.argv[1].endsWith('bot.mjs')) {
  const N = +process.argv[2] || 40;
  for (const cfg of [{ name: 'skilled, no shop', shop: false }, { name: 'skilled + shop' }, { name: 'sloppy (50%) + shop', skill: 0.5 }, { name: 'skilled + shop, all charms', pool: D.CHARMS.map(c => c.id) }]) {
    const reach = Array(10).fill(0); let wins = 0, over = 0; const ratio = {};
    for (let s = 1; s <= N; s++) {
      const { run, log } = playRun(s * 7919, cfg);
      for (let o = 1; o <= Math.min(9, run.order); o++) reach[o]++;
      if (run.won) wins++; if (log.at(-1).res === 'overflow') over++;
      for (const l of log) { const k = l.o; (ratio[k] ||= []).push(l.score / l.tgt); }
    }
    console.log(`\n${cfg.name}: wins ${wins}/${N}, ended by overflow ${over}`);
    console.log('  reached order:', reach.slice(1, 9).map((n, i) => `${i + 1}:${n}`).join(' '));
  }
}
