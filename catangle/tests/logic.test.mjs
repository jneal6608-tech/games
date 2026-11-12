// Run: node tests/logic.test.mjs
// Verifies every generated level is valid, deterministic and winnable with zero mistakes.
import assert from 'node:assert/strict';
import { generateLevel, generateDaily, levelParams } from '../web/js/levelgen.js';
import { LevelState } from '../web/js/game.js';

function validate(def, label) {
  const seen = new Set();
  assert.ok(def.cats.length >= 2, `${label}: too few cats`);
  for (const c of def.cats) {
    assert.ok(c.cells.length >= 2, `${label}: short cat`);
    for (let i = 0; i < c.cells.length; i++) {
      const [x, y] = c.cells[i];
      assert.ok(x >= 0 && y >= 0 && x < def.w && y < def.h, `${label}: out of bounds`);
      assert.ok(def.mask[y * def.w + x], `${label}: cat on masked cell`);
      const k = y * def.w + x;
      assert.ok(!seen.has(k), `${label}: overlap`); seen.add(k);
      if (i) {
        const [px, py] = c.cells[i - 1];
        assert.equal(Math.abs(px - x) + Math.abs(py - y), 1, `${label}: broken body`);
      }
    }
  }
  // The planned order wins with no mistakes and no fuse failure.
  const s = new LevelState(def);
  for (const id of def.order) {
    const r = s.tap(id);
    assert.equal(r && r.type, 'exit', `${label}: planned order blocked at cat ${id}`);
    if (s.cats.size) assert.equal(s.status, 'play', `${label}: planned order lost (${s.lostReason})`);
  }
  assert.equal(s.status, 'won', `${label}: not won`);
  assert.equal(s.hearts, 3);
  // The hint engine alone must also win (this is what stuck players lean on).
  const h = new LevelState(def);
  let guard = 0;
  while (h.status === 'play' && guard++ < 500) {
    const m = h.bestMove();
    assert.notEqual(m, null, `${label}: hint engine found no move`);
    assert.equal(h.tap(m).type, 'exit');
  }
  assert.equal(h.status, 'won', `${label}: hint engine lost (${h.lostReason})`);
  // Without fuses, any greedy order must win (no dead ends).
  if (!def.cats.some((c) => c.fuse)) {
    const g = new LevelState(def);
    while (g.status === 'play') { const f = g.freeIds(); assert.ok(f.length, `${label}: dead end`); g.tap(f[f.length - 1]); }
    assert.equal(g.status, 'won');
  }
}

const t0 = Date.now();
let maxMs = 0, cats = 0, sleepy = 0, grumpy = 0;
const N = 600;
for (let n = 1; n <= N; n++) {
  const a = Date.now();
  const def = generateLevel(n);
  maxMs = Math.max(maxMs, Date.now() - a);
  validate(def, `level ${n}`);
  cats += def.cats.length;
  sleepy += def.cats.filter((c) => c.sleep).length;
  grumpy += def.cats.filter((c) => c.fuse).length;
  const p = levelParams(n);
  const cells = def.cats.reduce((s, c) => s + c.cells.length, 0);
  const avail = def.mask.filter(Boolean).length;
  assert.ok(cells / avail > 0.45, `level ${n}: board too empty (${(cells / avail).toFixed(2)})`);
  if (p.grumpy) assert.ok(def.cats.some((c) => c.fuse), `level ${n}: expected a grumpy cat`);
}
assert.deepEqual(generateLevel(42), generateLevel(42), 'generation must be deterministic');
for (let d = 20000; d < 20120; d++) validate(generateDaily(d), `daily ${d}`);

// Rules: bump costs a heart, three bumps lose, revive restores play.
{
  const def = generateLevel(25);
  const s = new LevelState(def);
  const blocked = [...s.cats.values()].find((c) => s.isAwake(c) && s.ray(c).blocker >= 0);
  assert.ok(blocked);
  assert.equal(s.tap(blocked.id).type, 'bump'); assert.equal(s.hearts, 2);
  s.tap(blocked.id); s.tap(blocked.id);
  assert.equal(s.status, 'lost'); assert.equal(s.lostReason, 'hearts');
  assert.equal(s.tap(blocked.id), null);
  s.revive(); assert.equal(s.status, 'play'); assert.equal(s.hearts, 1);
  assert.equal(s.lure(blocked.id).type, 'lure'); assert.ok(!s.cats.has(blocked.id));
}
// Rules: ignoring a grumpy cat loses by fuse; revive extends it.
{
  let n = 30; let def = generateLevel(n);
  const s = new LevelState(def);
  const g = [...s.cats.values()].find((c) => c.fuse);
  let guard = 0;
  while (s.status === 'play' && guard++ < 200) {
    const f = s.freeIds().filter((id) => id !== g.id);
    if (!f.length) break;
    s.tap(f[0]);
  }
  if (s.status === 'lost') {
    assert.equal(s.lostReason, 'fuse');
    s.revive(); assert.equal(s.status, 'play'); assert.ok(s.fuseLeft(s.cats.get(g.id)) >= 3);
  }
}
console.log(`OK  ${N} levels + 120 dailies valid. avg cats/level ${(cats / N).toFixed(1)}, sleepy ${sleepy}, grumpy ${grumpy}, slowest gen ${maxMs} ms, total ${Date.now() - t0} ms`);
