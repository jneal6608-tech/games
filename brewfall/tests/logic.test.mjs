// Rules, economy and save tests. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
const mem = new Map();
globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
const D = await import('../web/src/data.js');
const { Run } = await import('../web/src/run.js');
const S = await import('../web/src/save.js');
const { World } = await import('../web/src/physics.js');
const { playRun } = await import('./bot.mjs');
const mk = (o = {}) => new Run({ seed: 42, ...o });
const give = (run, ...ids) => ids.forEach(id => run._addCharm(id));

test('content is well formed', () => {
  const ids = new Set(); for (const c of D.CHARMS) { assert.ok(!ids.has(c.id), 'duplicate ' + c.id); ids.add(c.id); assert.ok(D.RARITY[c.rar] && c.cost > 0 && c.desc && c.name); }
  for (const id of D.STARTER_CHARMS) assert.ok(D.CHARM[id], id);
  for (const s of [...D.ORB_SKINS]) assert.equal(s.colors.length, 10);
  for (const a of D.ACHIEVEMENTS) assert.ok(a.stat in S.fresh().stats, a.stat + ' missing from stats');
  for (let o = 1; o <= 12; o++) for (let r = 0; r < 3; r++) { const t = D.targetFor(o, r); assert.ok(t > 0 && (o === 1 && r === 0 || t > D.targetFor(r ? o : o - 1, r ? r - 1 : 2) || o === 1)); }
});
test('base scoring: potency x mult, chains add mult', () => {
  const r = mk(); r.drop();
  assert.equal(r.merge(2, 3).gain, 5); // Ember 5 x1
  assert.equal(r.merge(3, 2).gain, 20); // Moss 10 x2 (chain 2)
  r.drop(); assert.equal(r.merge(4, 2).gain, 20); // chain reset by the new drop
  assert.equal(r.score, 45);
});
test('charms apply left to right and order matters', () => {
  const a = mk(); give(a, 'ladle', 'grandeur'); a.drop(); assert.equal(a.merge(7, 1).gain, 100 * (1 + 4) * 3);
  const b = mk(); give(b, 'grandeur', 'ladle'); b.drop(); assert.equal(b.merge(7, 1).gain, 100 * (1 * 3 + 4));
});
test('specific charms', () => {
  let r = mk(); give(r, 'twin'); r.drop(); assert.equal(r.merge(2, 1).gain, 10); assert.equal(r.merge(5, 1).gain, 70);
  r = mk(); give(r, 'ladle', 'mirror'); r.drop(); assert.equal(r.merge(2, 1).gain, 5 * 9);
  r = mk(); give(r, 'cascade'); r.drop(); r.merge(2, 1); assert.equal(r.merge(2, 1).gain, 15);
  r = mk(); give(r, 'gilded'); const s0 = r.sparks; r.drop(); r.merge(7, 1); assert.equal(r.sparks, s0 + 2);
  r = mk(); give(r, 'recycler'); r.drop(); const d0 = r.dropsLeft; for (let i = 0; i < 6; i++) r.merge(2, 1); assert.equal(r.dropsLeft, d0 + 1);
  r = mk(); give(r, 'hourglass'); r.startRound(); assert.equal(r.dropsLeft, D.BASE_DROPS + 3);
  r = mk(); give(r, 'snowball'); r.drop(); r.merge(2, 1); assert.equal(r.merge(2, 1).gain, (5 + 2) * 2);
  r = mk(); give(r, 'richstock'); for (let i = 0; i < 200; i++) assert.notEqual(r._draw(), 1);
});
test('recipes and golden drop', () => {
  const r = mk(); r.recipes[3] = 2; r.drop(); assert.equal(r.merge(3, 1).gain, 10 * 2 * 3);
  r.golden = true; r.drop(); assert.equal(r.merge(2, 1).gain, 25); assert.equal(r.golden, false);
});
test('round flow, payout, interest and shop', () => {
  const r = mk(); r.sparks = 10; r.score = r.target; assert.equal(r.status(true), 'won');
  const dl = r.dropsLeft, res = r.winRound();
  assert.equal(res.pay, 3 + Math.min(4, Math.floor(dl / 2)) + 2); assert.equal(r.phase, 'shop'); assert.equal(r.round, 1);
  assert.equal(r.shop.charms.length, 3); assert.equal(r.shop.tonics.length, 2);
  const before = r.sparks, c = r.shop.charms[0]; assert.equal(r.buyCharm(0), 'ok'); assert.equal(r.sparks, before - c.cost); assert.equal(r.buyCharm(0), 'gone');
  r.sparks = 0; assert.equal(r.buyCharm(1), 'poor'); assert.equal(r.reroll(), false);
  r.sparks = 50; assert.equal(r.reroll(), true); assert.equal(r.rerollCost, 3);
  const sv = r.sellValue(0), sp = r.sparks; r.sellCharm(0); assert.equal(r.sparks, sp + sv); assert.equal(r.charms.length, 0);
  r.leaveShop(); assert.equal(r.phase, 'round'); assert.equal(r.score, 0);
});
test('charm slots are enforced', () => { const r = mk(); r.score = r.target; r.winRound(); r.sparks = 999; give(r, 'ladle', 'odd', 'even', 'whisk', 'purse'); assert.equal(r.buyCharm(0), 'full'); });
test('losing, single revive, hexes', () => {
  const r = mk(); r.dropsLeft = 0; assert.equal(r.status(false), null); assert.equal(r.status(true), 'lost'); r.loseRound(); assert.ok(r.over);
  assert.equal(r.revive(), true); assert.equal(r.phase, 'round'); assert.ok(r.dropsLeft >= 8); assert.equal(r.revive(), false);
  const h = mk(); h.round = 2; h.hexOrder = ['sour']; h.startRound(); h.drop(); assert.equal(h.merge(2, 1).gain, 0); assert.ok(h.merge(5, 1).gain > 0);
  const t = mk(); t.round = 2; t.hexOrder = ['thin']; t.startRound(); assert.equal(t.dropsLeft, D.BASE_DROPS - 4);
  const s = mk(); give(s, 'ladle'); s.round = 2; s.hexOrder = ['silence']; s.startRound(); s.drop(); assert.equal(s.merge(2, 1).gain, 5);
});
test('tonics change the cauldron', () => {
  const r = mk(), w = new World(); w.load([[1, 50, 480], [1, 150, 480], [3, 250, 470], [6, 100, 300]]);
  r.tonics = ['purge', 'dissolve', 'spare']; r.useTonic(0, w); assert.equal(w.bodies.filter(b => b.tier === 1).length, 0);
  r.useTonic(0, w); assert.equal(w.bodies.length, 0); const d = r.dropsLeft; r.useTonic(0, w); assert.equal(r.dropsLeft, d + 4); assert.equal(r.tonics.length, 0);
});
test('a run survives save and restore exactly', () => {
  const a = mk(); a.drop(); a.merge(3, 2); give(a, 'sprout'); const b = new Run({ restore: JSON.parse(JSON.stringify(a)) });
  assert.equal(b.score, a.score); assert.deepEqual(b.queue, a.queue); for (let i = 0; i < 20; i++) assert.equal(b.drop(), a.drop());
});
test('same seed gives the same run (Daily Brew fairness)', () => {
  const a = playRun(777, {}), b = playRun(777, {}); assert.deepEqual(a.log, b.log);
});
test('bot plays full runs without errors and physics stays in bounds', () => {
  for (let s = 1; s <= 6; s++) { const { run, log } = playRun(s * 31, { tonics: true, pool: D.CHARMS.map(c => c.id) }); assert.ok(log.length >= 3, 'bot should clear the opening brews'); assert.ok(Number.isFinite(run.stats.total)); for (const b of run.bodies) assert.ok(b[1] >= 0 && b[1] <= 360 && b[2] <= 500 && b[2] > -200, 'body out of bounds ' + b); }
});
test('profile: save, reload, checksum and backup recovery', () => {
  mem.clear(); S.load(); S.earn(500, 7); S.save(true);
  assert.equal(S.load(), 'main'); assert.equal(S.profile.p.glints, 500); assert.equal(S.profile.p.moons, 7);
  const raw = mem.get('brewfall.save.v1'); mem.set('brewfall.save.bak', raw);
  mem.set('brewfall.save.v1', raw.replace('500', '999999')); assert.equal(S.load(), 'backup'); assert.equal(S.profile.p.glints, 500); // tampered -> rejected
  mem.set('brewfall.save.v1', '{broken'); mem.delete('brewfall.save.bak'); assert.equal(S.load(), 'reset'); assert.equal(S.profile.p.glints, 0);
});
test('spending and unlocks', () => {
  mem.clear(); S.load(); assert.equal(S.buyUnlock('orb', 'candy'), 'poor'); S.earn(600);
  assert.equal(S.buyUnlock('orb', 'candy'), 'ok'); assert.equal(S.profile.p.glints, 100); assert.equal(S.buyUnlock('orb', 'candy'), 'owned');
  assert.equal(S.buyUnlock('orb', 'founder'), 'bad'); assert.equal(S.buyUnlock('orb', 'neon'), 'poor'); assert.equal(S.pay(-5, 'g'), false);
  S.earn(0, 70); assert.equal(S.buyUnlock('orb', 'neon'), 'ok'); assert.equal(S.profile.p.moons, 10);
  assert.equal(S.exchange(), true); assert.equal(S.profile.p.moons, 0); assert.equal(S.profile.p.glints, 350); assert.equal(S.exchange(), false);
  S.earn(150); const n = S.profile.p.charms.length; assert.equal(S.buyUnlock('charm', 'brimful'), 'ok'); assert.equal(S.profile.p.charms.length, n + 1);
});
test('daily gift: once per day, streak continues or resets', () => {
  mem.clear(); S.load(); let st = S.dailyState(); assert.ok(st.available); assert.equal(st.day, 0);
  assert.deepEqual(S.claimDaily(false), { g: 50, m: 0 }); assert.equal(S.claimDaily(false), null);
  const d = new Date(); d.setDate(d.getDate() - 1); S.profile.p.daily.last = S.today(d); st = S.dailyState(); assert.equal(st.day, 1); assert.equal(st.streak, 2);
  assert.deepEqual(S.claimDaily(true), { g: 150, m: 0 });
  d.setDate(d.getDate() - 5); S.profile.p.daily.last = S.today(d); st = S.dailyState(); assert.equal(st.streak, 1); assert.equal(st.day, 0);
});
test('missions and achievements pay once', () => {
  mem.clear(); S.load(); const ms = S.missions(); assert.equal(ms.list.length, 3);
  const d0 = D.MISSIONS.find(m => m.id === ms.list[0].id); assert.equal(S.claimMission(0), 0);
  S.progress(d0.key, d0.n); const g = S.profile.p.glints; assert.equal(S.claimMission(0).g, d0.reward); assert.equal(S.profile.p.glints, g + d0.reward); assert.equal(S.claimMission(0), 0);
  for (let i = 1; i < 3; i++) { const d = D.MISSIONS.find(m => m.id === ms.list[i].id); S.progress(d.key, d.n); } S.claimMission(1); assert.equal(S.claimMission(2).m, D.MISSION_BONUS_MOON);
  assert.equal(S.claimAch('a_first'), null); S.profile.p.stats.rounds = 1; assert.ok(S.claimAch('a_first')); assert.equal(S.claimAch('a_first'), null);
});
test('finishing a run pays Glints and unlocks the next stake on a win', () => {
  mem.clear(); S.load(); const r = mk(); r.roundsWon = 24; r.bossesBeaten = 8; r.order = 9; const g = S.finishRun(r);
  assert.equal(g, 24 * D.GLINT_PER_ROUND + 8 * D.GLINT_PER_BOSS + D.GLINT_WIN); assert.equal(S.profile.p.glints, g); assert.equal(S.profile.p.stakeUnlocked, 2); assert.equal(S.profile.p.stats.wins, 1); assert.equal(S.profile.p.run, null);
});
test('purchases: granted once per token, one-time items never doubled', () => {
  mem.clear(); S.load();
  assert.equal(S.grantPurchase('moon_80', 't1'), 'granted'); assert.equal(S.grantPurchase('moon_80', 't1'), 'duplicate'); assert.equal(S.profile.p.moons, 80);
  assert.equal(S.grantPurchase('moon_80', 't2'), 'granted'); assert.equal(S.profile.p.moons, 160);
  assert.equal(S.grantPurchase('starter_pack', 't3'), 'granted'); assert.equal(S.profile.p.moons, 360); assert.ok(S.profile.p.orbSkins.includes('founder'));
  assert.equal(S.grantPurchase('starter_pack', 't4'), 'owned'); assert.equal(S.profile.p.moons, 360);
  assert.equal(S.grantPurchase('remove_ads', 't5'), 'granted'); assert.ok(S.profile.p.iap.removeAds); assert.equal(S.grantPurchase('bogus', 't6'), 'unknown');
  S.save(true); S.load(); assert.equal(S.grantPurchase('moon_80', 't2'), 'duplicate'); // still remembered after a restart
});
