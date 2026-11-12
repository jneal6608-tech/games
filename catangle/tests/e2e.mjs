// End-to-end play test in a phone-sized Chromium (same engine family as Android WebView).
// Run: python3 -m http.server 8765 --directory web &   then   NODE_PATH=$(npm root -g) node tests/e2e.mjs [shotDir]
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2];
const URL = 'http://localhost:8765/index.html?fastads=1';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const G = (fn, arg) => p.evaluate(fn, arg);
const shot = async (n) => { if (out) await p.screenshot({ path: `${out}/${n}.png` }); };
const click = (s) => p.click(s, { force: true });
const tapCat = async (id) => { const pt = await G((i) => window.__catangle.point(i), id); await p.mouse.click(pt.x, pt.y); };
async function solve() {
  for (let i = 0; i < 300; i++) {
    const s = await G(() => ({ st: window.__catangle.view.state.status, best: window.__catangle.best(), busy: window.__catangle.view.anims.size }));
    if (s.st !== 'play') return s.st;
    if (s.busy) { await p.waitForTimeout(60); continue; }
    await tapCat(s.best); await p.waitForTimeout(25);
  }
  throw new Error('solve did not finish');
}

await p.goto(URL); await p.waitForTimeout(900);
await G(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(900);

// 1. First session: levels 1-4 straight through.
await click('#btn-play'); await p.waitForTimeout(400);
assert.match(await p.textContent('#coach'), /clear path/);
for (let lv = 1; lv <= 4; lv++) {
  assert.equal(await solve(), 'won');
  await p.waitForSelector('.modal [data-act=next]');
  if (lv === 1) { await p.waitForTimeout(900); await shot('10-win'); }
  if (lv === 2) { // double reward through the (mock) rewarded video
    const before = await G(() => window.__catangle.save.fish);
    await click('.modal [data-act=double]'); await p.waitForTimeout(500);
    assert.equal(await G(() => window.__catangle.save.fish), before + 25, 'double reward grants the same amount again');
  }
  await click('.modal [data-act=next]'); await p.waitForTimeout(350);
}
assert.equal(await G(() => window.__catangle.save.level), 5);
assert.equal(await G(() => window.__catangle.save.fish), 125, '4 perfect wins = 100 fish, +25 doubled');

// 2. Bumps cost hearts; three bumps lose; rewarded continue revives once.
for (let i = 0; i < 3; i++) { await tapCat(await G(() => window.__catangle.blocked())); await p.waitForTimeout(700); }
await p.waitForSelector('.modal [data-act=cont]'); await shot('11-lose');
await click('.modal [data-act=cont]'); await p.waitForTimeout(500);
assert.equal(await G(() => window.__catangle.view.state.hearts), 1);
await tapCat(await G(() => window.__catangle.blocked())); await p.waitForTimeout(1300);
assert.equal(await p.locator('.modal [data-act=cont]').count(), 0, 'continue is offered only once per attempt');
await click('.modal [data-act=retry]'); await p.waitForTimeout(300);
assert.equal(await G(() => window.__catangle.view.state.hearts), 3);

// 3. Hint highlights a legal cat and spends one hint; treat removes a blocked cat.
await click('#btn-hint');
assert.equal(await G(() => window.__catangle.save.hints), 2);
assert.equal(await G(() => window.__catangle.view.hintId), await G(() => window.__catangle.best()));
await shot('12-hint');
const blocked = await G(() => window.__catangle.blocked());
await click('#btn-lure'); await tapCat(blocked); await p.waitForTimeout(300);
assert.equal(await G((id) => window.__catangle.view.state.cats.has(id), blocked), false);
assert.equal(await G(() => window.__catangle.save.lures), 0);
assert.equal(await solve(), 'won'); await click('.modal [data-act=next]');

// 4. Save survives a reload.
await p.waitForTimeout(400); await p.reload(); await p.waitForTimeout(900);
assert.equal(await G(() => window.__catangle.save.level), 6);
assert.match(await p.textContent('#play-label'), /Level 6/);

// 5. Daily puzzle: reward once, streak recorded.
await click('#btn-daily'); await p.waitForTimeout(400); await shot('13-daily');
const f0 = await G(() => window.__catangle.save.fish);
assert.equal(await solve(), 'won'); await p.waitForSelector('.modal [data-act=next]');
assert.equal(await G(() => window.__catangle.save.fish), f0 + 60);
assert.equal(await G(() => window.__catangle.save.daily.streak), 1);
await click('.modal [data-act=next]'); await p.waitForTimeout(300);
assert.match(await p.textContent('#daily-sub'), /Solved/);
await click('#btn-daily'); await p.waitForTimeout(300); await solve(); await p.waitForSelector('.modal [data-act=next]');
assert.equal(await G(() => window.__catangle.save.fish), f0 + 60, 'no second daily reward');
await click('.modal [data-act=next]'); await p.waitForTimeout(300);

// 6. Shop + collection: free fish cap, buying a coat and a room, IAP unavailable in a browser.
await G(() => window.__catangle.setSave({ fish: 1000 }));
await click('#btn-shop'); await p.waitForTimeout(300); await shot('14-shop');
await click('.modal [data-free]'); await p.waitForTimeout(400);
assert.equal(await G(() => window.__catangle.save.fish), 1050);
await click('.modal [data-sku=remove_ads]'); await p.waitForTimeout(300);
assert.equal(await G(() => window.__catangle.save.noAds), false, 'no entitlement without a real store');
await click('.modal [data-close]');
await click('#btn-cats'); await p.waitForTimeout(300); await shot('15-cats');
await click('.modal [data-buy=mint]'); await p.waitForTimeout(200);
assert.ok(await G(() => window.__catangle.save.coats.includes('mint')));
await click('.modal [data-tab=rooms]'); await click('.modal [data-buyt=garden]'); await p.waitForTimeout(300);
assert.equal(await G(() => window.__catangle.save.theme), 'garden'); await shot('16-rooms');
assert.equal(await G(() => window.__catangle.save.fish), 1050 - 300 - 400);
await click('.modal [data-close]');

// 7. Chapter chest + coat unlock at level 10, feature intro at 15 and 30, interstitial pacing.
await G(() => window.__catangle.setSave({ level: 10 }));
await click('#btn-play'); await p.waitForTimeout(300); await solve(); await p.waitForSelector('.modal [data-act=next]');
assert.ok(await G(() => window.__catangle.save.coats.includes('tabby')));
await p.waitForTimeout(900); await shot('17-chapter-chest');
await click('.modal [data-act=next]'); await click('#btn-home');
await G(() => window.__catangle.setSave({ level: 15 }));
await click('#btn-play'); await p.waitForTimeout(400);
assert.match(await p.textContent('.modal h2'), /Sleepy/); await shot('18-sleepy-intro');
await click('.modal [data-close]');
const sleepy = await G(() => [...window.__catangle.view.state.cats.values()].find((c) => c.sleep).id);
await tapCat(sleepy); await p.waitForTimeout(200);
assert.equal(await G(() => window.__catangle.view.state.hearts), 3, 'tapping a sleeping cat costs nothing');
assert.equal(await solve(), 'won'); await click('.modal [data-act=next]'); await p.waitForTimeout(300);
await click('#btn-home');
await G(() => window.__catangle.setSave({ level: 30, ads: { winsSince: 3, lastAt: 0 } }));
await click('#btn-play'); await p.waitForTimeout(400);
assert.match(await p.textContent('.modal h2'), /Grumpy/); await click('.modal [data-close]'); await shot('19-grumpy');
// ignore the grumpy cat until it loses patience
for (let i = 0; i < 60; i++) {
  const r = await G(() => { const v = window.__catangle.view, st = v.state; const g = [...st.cats.values()].find((c) => c.fuse); const f = st.freeIds().filter((id) => !g || id !== g.id); return { st: st.status, id: f[0], busy: v.anims.size }; });
  if (r.st !== 'play' || r.id === undefined) break;
  await tapCat(r.id); await p.waitForTimeout(40);
}
assert.equal(await G(() => window.__catangle.view.state.lostReason), 'fuse');
await p.waitForSelector('.modal [data-act=retry]'); await click('.modal [data-act=retry]'); await p.waitForTimeout(300);
assert.equal(await solve(), 'won'); await p.waitForSelector('.modal [data-act=next]');
await click('.modal [data-act=next]');
await p.waitForSelector('.mock-ad', { timeout: 2000 }); // interstitial shows after 3 wins past level 12
await p.waitForTimeout(500);
assert.equal(await G(() => window.__catangle.save.ads.winsSince), 0);

// 8. Settings toggles + reset.
await click('#btn-home'); await click('#btn-settings'); await p.waitForTimeout(300); await shot('20-settings');
await click('.modal [data-act=sound]');
assert.equal(await G(() => window.__catangle.save.settings.sound), false);
await click('.modal [data-act=reset]'); await click('.modal [data-act=yes]'); await p.waitForTimeout(300);
assert.equal(await G(() => window.__catangle.save.level), 1);

// 9. Small and large screens lay out without overflow.
for (const [w, h] of [[320, 568], [412, 915], [800, 1280]]) {
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(200);
  await G(() => window.__catangle.setSave({ level: 90, seen: { sleepy: 1, grumpy: 1 } }));
  await click('#btn-play'); await p.waitForTimeout(400);
  const ok = await G(() => { const v = window.__catangle.view, L = v.L, r = document.querySelector('#stage').getBoundingClientRect(); return L.u >= 28 && L.ox >= 0 && L.oy >= r.top - 2 && L.oy + v.state.h * L.u <= r.bottom + 2 && L.ox + v.state.w * L.u <= innerWidth; });
  assert.ok(ok, `board fits at ${w}x${h}`);
  await shot(`21-fit-${w}x${h}`); await click('#btn-home');
}
assert.deepEqual(errs, [], 'no console errors');
console.log('E2E OK');
await b.close();
