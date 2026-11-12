/* Verifies the JS <-> Android bridge contract with a mock AndroidBridge, plus save corruption recovery,
   offline earnings and a long soak run at 3x. usage: node tools/bridge_test.js */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = []; let fail = 0;
  const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) fail++; };
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    window.__calls = [];
    window.AndroidBridge = {
      ready() { __calls.push('ready'); setTimeout(() => EH.Native.onPrices({ keeper_pack: '€5,49' }), 50); },
      showRewarded(id, pl) { __calls.push('ad:' + pl); setTimeout(() => EH.Native.onRewarded(id, window.__adOk !== false), 30); },
      purchase(id, sku) { __calls.push('buy:' + sku); setTimeout(() => EH.Native.onPurchase(id, sku, true, ''), 30); },
      restorePurchases() { __calls.push('restore'); }, haptic() {}, openUrl(u) { __calls.push('url:' + u); }
    };
  });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1200);
  ok('android mode detected', await p.evaluate(() => EH.Platform.mode === 'android'));
  ok('ready + restore called at boot', await p.evaluate(() => __calls.includes('ready') && __calls.includes('restore')));
  await p.click('[data-k="go"]'); await p.waitForTimeout(500);
  await p.evaluate(() => { EH.Game.run.embers = 40; EH.Game.run.damageEmber(1e12, null); }); await p.waitForTimeout(300);
  // failed ad must not revive
  await p.evaluate(() => { window.__adOk = false; }); await p.click('[data-k="ad"]'); await p.waitForTimeout(200);
  ok('failed ad gives no revive', await p.evaluate(() => EH.Game.run.over === true));
  await p.evaluate(() => { window.__adOk = true; }); await p.click('[data-k="ad"]'); await p.waitForTimeout(200);
  ok('rewarded ad revives', await p.evaluate(() => EH.Game.run.over === false && EH.Game.run.hp > 0));
  await p.evaluate(() => { EH.Game.run.wardT = 0; EH.Game.run.damageEmber(1e12, null); }); await p.waitForTimeout(300);
  ok('second death goes straight to summary', !!(await p.$('[data-k="dbl"]')));
  const e0 = await p.evaluate(() => EH.Save.data.embers);
  await p.click('[data-k="dbl"]'); await p.waitForTimeout(200);
  ok('double embers via ad', await p.evaluate(e => EH.Save.data.embers === e * 2 && e > 0, e0));
  await p.evaluate(() => document.querySelector('[data-k="dbl"]').click()); await p.waitForTimeout(200);
  ok('cannot double twice', await p.evaluate(e => EH.Save.data.embers === e * 2, e0));
  await p.click('[data-k="menu"]'); await p.waitForTimeout(300);
  await p.click('#nav [data-to="shop"]'); await p.waitForTimeout(200);
  ok('localised price shown', (await p.textContent('#shop')).includes('€5,49'));
  const g0 = await p.evaluate(() => EH.Save.data.gems);
  await p.click('[data-act="iap"][data-id="gems_2"]'); await p.waitForTimeout(200);
  ok('gem purchase grants 600', await p.evaluate(g => EH.Save.data.gems === g + 600, g0));
  await p.click('[data-act="iap"][data-id="keeper_pack"]'); await p.waitForTimeout(200);
  ok('keeper pack owned', await p.evaluate(() => EH.Save.data.iap.keeper === true));
  const n = await p.evaluate(() => __calls.filter(c => c.startsWith('ad:')).length);
  await p.click('[data-act="adgems"]'); await p.waitForTimeout(200);
  ok('keeper skips ads', await p.evaluate(n => __calls.filter(c => c.startsWith('ad:')).length === n, n));
  await p.evaluate(() => EH.Native.onPurchase('', 'gems_1', true, '')); 
  ok('unprompted purchase delivery grants', await p.evaluate(g => EH.Save.data.gems === g + 600 + 8 + 100, g0));
  ok('back closes to home', await p.evaluate(() => EH.Native.onBack() === true && EH.Native.onBack() === false));
  // offline earnings
  await p.evaluate(() => { EH.Save.save(); const o = JSON.parse(localStorage['emberhold.save']); const d = JSON.parse(o.d); d.lastSeen -= 3 * 3600e3; d.bestEmbers = 1000; d.daily.lastClaim = EH.today();
    const s = JSON.stringify(d); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } window.__skip = true; localStorage['emberhold.save'] = JSON.stringify({ d: s, h: h.toString(36) }); EH.Save.save = () => true; });
  await p.reload(); await p.waitForTimeout(1500);
  ok('offline modal shows 3h of embers (5%/h of 1000 = 150)', (await p.textContent('#modals')).includes('+150'));
  await p.click('[data-k="one"]');
  // corruption -> backup
  await p.evaluate(() => { EH.Save.save(); EH.Save.save(); localStorage['emberhold.save'] = '{"d":"{broken","h":"x"}'; EH.Save.save = () => true; });
  await p.reload(); await p.waitForTimeout(1500);
  ok('corrupt save recovers from backup', await p.evaluate(() => EH.Save.recovered === true && EH.Save.data.iap.keeper === true));
  await p.evaluate(() => { localStorage['emberhold.save'] = 'garbage'; localStorage['emberhold.save.bak'] = 'garbage'; EH.Save.save = () => true; });
  await p.reload(); await p.waitForTimeout(1500);
  ok('both slots corrupt -> clean start, no crash', await p.evaluate(() => EH.Save.data.stats.runs === 0) && !!(await p.$('[data-k="go"]')));
  // soak: long run at 3x with auto-boon, measure frame time
  await p.click('[data-k="go"]');
  await p.evaluate(() => { const S = EH.Save.data; S.settings.autoBoon = true; S.settings.speed = 3; ['damage','speed','health','regen'].forEach(k => S.workshop[k] = 60); EH.Game.toMenu(); EH.Game.startRun();
    window.__ft = []; let l = performance.now(); (function f(t) { __ft.push(t - l); l = t; requestAnimationFrame(f); })(l);
    setInterval(() => { const r = EH.Game.run; if (r && !r.over) EH.UPGRADES.forEach(u => { if (r.unlocked(u.id)) r.buy(u.id); }); }, 300); });
  await p.waitForTimeout(25000);
  ok('soak run progressed', await p.evaluate(() => EH.Game.run.wave >= 3 && !EH.Game.run.over));
  // stress: flood the field to the enemy cap with tanky shades and measure frame time
  await p.evaluate(() => { const r = EH.Game.run; r.hp = r.s.maxHp = 1e30; ['shade','wisp','brute','spitter','splitter'].forEach(t => { for (let i = 0; i < 44; i++) { const e = r.spawn(t); if (e) e.hp = e.maxHp = 1e9; } }); __ft.length = 0; });
  await p.waitForTimeout(8000);
  const soak = await p.evaluate(() => { const f = __ft.slice(10).sort((a, b) => a - b); const r = EH.Game.run; return { enemies: r.enemies.length, sparks: r.sparks.length, med: +f[f.length >> 1].toFixed(1), p95: +f[Math.floor(f.length * .95)].toFixed(1) }; });
  console.log('stress', JSON.stringify(soak));
  ok('stress: 200+ enemies on screen', soak.enemies >= 200);
  ok('stress: frame time p95 < 34ms (software-rendered headless)', soak.p95 < 34);
  await p.screenshot({ path: (process.argv[2] || '/tmp') + '/soak.png' });
  ok('no page errors', errs.length === 0); if (errs.length) console.log(errs.join('\n'));
  await b.close(); process.exit(fail ? 1 : 0);
})();
