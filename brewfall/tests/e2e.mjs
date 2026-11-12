// End-to-end tests in real Chromium with a phone profile. Drives the built game exactly as a player would,
// with reward videos and purchases simulated by dev mode. Run: node tests/e2e.mjs  (needs dist/ served on :8377)
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const URL = 'http://localhost:8377/index.html?dev=1';
const results = []; let page, ctx, browser; const errs = [];
const ok = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`); };
const wait = ms => page.waitForTimeout(ms);
const tap = async (sel, ms = 300) => { await page.locator(sel).first().click(); await wait(ms); };
const has = sel => page.locator(sel).count().then(n => n > 0);
const P = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__bfBoot.S.profile.p)));
const text = sel => page.locator(sel).first().innerText();
async function open(fresh) { if (fresh) { await page.goto(URL); await page.evaluate(() => localStorage.clear()); } await page.goto(URL); await wait(700); }
// Pour essences with real pointer input until a dialog appears.
async function playUntilDialog(max = 60) {
  for (let i = 0; i < max; i++) {
    if (await has('.ov')) return true; if (await has('.hint')) await page.evaluate(() => document.querySelector('.hint')?.remove());
    const bb = await page.locator('#cv').boundingBox();
    const fx = await page.evaluate(() => { const { board, run } = window.__bf; const t = run.queue[0]; let best = null; for (const b of board.world.bodies) if (b.tier === t && (!best || b.y < best.y)) best = b; return ((best ? best.x : 30 + Math.random() * 300) + 8) / 376; });
    await page.mouse.move(bb.x + bb.width * fx, bb.y + 40); await page.mouse.down(); await page.mouse.up(); await wait(520);
  }
  await wait(2500); return has('.ov');
}

browser = await chromium.launch(); ctx = await browser.newContext({ ...devices['Pixel 7'] }); page = await ctx.newPage();
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

// 1. first launch: daily gift, wallet, save created
await open(true);
ok('first launch shows the daily gift', await has('.ov .days'));
await tap('.ov [data-k=d]', 1400); // double via (simulated) reward video
let p = await P(); ok('daily gift doubled by reward video (50 x2)', p.glints === 100, 'glints=' + p.glints);
ok('gift cannot be claimed twice', !(await has('.ov')) && (await page.evaluate(() => window.__bfBoot.S.claimDaily(false))) === null);

// 2. tutorial + first brew with real touch input
await tap('[data-act=setup]'); await tap('[data-act=start]', 600);
ok('tutorial tip appears on the first run', await has('.hint'));
ok('first brew dialog reached by playing', await playUntilDialog());
ok('brew was won and paid Sparks', (await text('.ov h3')).includes('Brew complete'));
const tut = (await P()).tut; ok('tutorial steps recorded', tut.start && tut.dropped && tut.merged);
await tap('.ov [data-k=go]');
ok('shop opens after a brew', await has('[data-act=buyCharm]'));

// 3. shop: buy, cannot overspend, sell
let sp0 = await page.evaluate(() => window.__bfBoot.getRun().sparks);
await tap('[data-act=buyCharm]');
let r = await page.evaluate(() => { const r = window.__bfBoot.getRun(); return { sparks: r.sparks, charms: r.charms.length }; });
ok('buying a charm spends Sparks and fills a slot', r.charms === 1 && r.sparks < sp0, `${sp0}->${r.sparks}`);
await page.evaluate(() => { window.__bfBoot.getRun().sparks = 0; }); await tap('[data-act=reroll]');
ok('cannot reroll without Sparks', (await page.evaluate(() => window.__bfBoot.getRun().sparks)) === 0);
await tap('[data-act=adReroll]', 1400); ok('reward video gives one free reroll per shop', !(await has('[data-act=adReroll]')));
await tap('.tray [data-act=charmInfo]'); ok('charm details open', await has('.ov [data-k=sell]')); await tap('.ov [data-k=x]');

// 4. save + resume mid-run across a full reload
await tap('[data-act=nextRound]', 500);
await page.evaluate(() => { window.__bf.run.score = -1e6; }); // make sure this brew cannot be won by accident
for (let i = 0; i < 3; i++) { const bb = await page.locator('#cv').boundingBox(); await page.evaluate(() => document.querySelector('.hint')?.remove()); await page.mouse.move(bb.x + 60 + i * 90, bb.y + 40); await page.mouse.down(); await page.mouse.up(); await wait(600); }
await wait(2500);
const before = await page.evaluate(() => { const { run, board } = window.__bf; return { d: run.dropsLeft, round: run.round, n: board.world.bodies.length, charms: run.charms.length, score: run.score }; });
await open(false);
ok('home offers Continue after a restart', await has('[data-act=continue]'));
await tap('[data-act=continue]', 600);
const after = await page.evaluate(() => { const { run, board } = window.__bf; return { d: run.dropsLeft, round: run.round, n: board.world.bodies.length, charms: run.charms.length, score: run.score }; });
ok('run resumes exactly (drops, round, charms, score, cauldron)', JSON.stringify(before) === JSON.stringify(after), JSON.stringify(after));

// 5. pause / back button
await tap('[data-act=pause]'); ok('pause menu opens and freezes the brew', (await has('.ov')) && await page.evaluate(() => window.__bf.board.paused));
await tap('.ov [data-k=r]'); ok('resume works', !(await page.evaluate(() => window.__bf.board.paused)));

// 6. fail -> revive by video -> fail again -> summary -> double Glints
await page.evaluate(() => { const { run } = window.__bf; run.dropsLeft = 0; }); await page.waitForSelector('.ov', { timeout: 8000 }).catch(() => {});
ok('running out of drops ends the brew', (await has('.ov')) && (await text('.ov h3')).includes('Brew failed'), await page.evaluate(() => { const { run, board } = window.__bf; return `score ${run.score}/${run.target} settled ${board.world.settled()} h3 ${document.querySelector('.ov h3')?.textContent}`; }));
await tap('.ov [data-k=ad]', 1500);
r = await page.evaluate(() => { const { run, board } = window.__bf; return { rev: run.revived, drops: run.dropsLeft, n: board.world.bodies.length, ended: board.ended }; });
ok('reward video revives once with an empty cauldron', r.rev && r.drops >= 8 && r.n === 0 && !r.ended, JSON.stringify(r));
// boil over this time
await page.evaluate(() => { const { board } = window.__bf; const cols = [[60, 5, 6], [180, 7, 8], [300, 5, 6]]; for (const [x, t1, t2] of cols) for (let i = 0; i < 6; i++) { const b = board.world.add(i % 2 ? t2 : t1, x, 440 - i * 110); b.age = 2; } });
await wait(5500);
ok('boil-over ends the run with no second revive', (await text('.ov h3')).includes('Run over') && !(await has('.ov [data-k=ad]')));
p = await P(); const g1 = p.glints; ok('run Glints were paid and the run cleared', g1 > 100 && p.run === null && p.stats.runs === 1, 'glints=' + g1);
await tap('.ov [data-k=dbl]', 1500); p = await P(); ok('reward video doubles the run payout once', p.glints > g1 && !(await has('.ov [data-k=dbl]')), `${g1}->${p.glints}`);
await tap('.ov [data-k=home]');

// 7. meta shop: cosmetics with Glints, cannot overspend
await page.evaluate(() => { const S = window.__bfBoot.S; S.profile.p.glints = 450; S.save(true); });
await tap('[data-act=store][data-tab=looks]');
await tap('[data-act=unlock][data-id=candy]'); p = await P(); ok('cannot buy a 500 Glint style with 450', !p.orbSkins.includes('candy') && p.glints === 450);
await tap('[data-act=unlock][data-id=forest]'); p = await P(); ok('cauldron bought and equipped, balance updated', p.cauldrons.includes('forest') && p.equip.cauldron === 'forest' && p.glints === 50);

// 8. purchases (simulated Play flow): success, duplicate token, failure, one-time item
await tap('[data-act=store][data-tab=moon]');
await page.evaluate(() => { window.__forceToken = 'tok-A'; }); await tap('[data-act=iap][data-sku=moon_80]', 700);
p = await P(); ok('Moonstone purchase delivered', p.moons === 80);
await tap('[data-act=iap][data-sku=moon_80]', 700); p = await P(); ok('same purchase token is never delivered twice', p.moons === 80);
await page.evaluate(() => { window.__forceToken = null; window.__failNextPurchase = true; }); await tap('[data-act=iap][data-sku=moon_450]', 700);
p = await P(); ok('failed or cancelled purchase grants nothing', p.moons === 80);
await tap('[data-act=iap][data-sku=starter_pack]', 700); p = await P();
ok("Founder's Pack delivers currency + exclusive style", p.moons === 280 && p.glints === 1050 && p.orbSkins.includes('founder') && p.iap.starter);
ok("Founder's Pack cannot be bought twice", !(await has('[data-act=iap][data-sku=starter_pack]')));
await tap('[data-act=iap][data-sku=remove_ads]', 700); p = await P(); ok('Remove Ads recorded', p.iap.removeAds);
await tap('[data-act=store][data-tab=looks]'); await tap('[data-act=unlock][data-id=neon]'); p = await P(); ok('Moonstones buy a premium style', p.orbSkins.includes('neon') && p.moons === 220);
await tap('[data-act=store][data-tab=free]'); await tap('[data-act=exchange]'); p = await P(); ok('Moonstones exchange into Glints', p.moons === 210 && p.glints === 1300);
await tap('[data-act=adGlints]', 1400); p = await P(); ok('reward video pays 40 Glints', p.glints === 1340);

// 9. codex unlock, missions, achievements
await tap('[data-act=home]'); await tap('[data-act=codex]'); await tap('[data-act=unlock][data-id=brimful]'); p = await P(); ok('charm unlocked in the Codex', p.charms.includes('brimful') && p.glints === 1190);
await tap('[data-act=home]'); await tap('[data-act=missions]'); ok('three daily missions listed', (await page.locator('[data-act=claimMission]').count()) === 3);
await tap('[data-act=missions][data-tab=ach]'); const gA = (await P()).glints; await tap('.btn.pri[data-act=claimAch]'); p = await P(); ok('earned achievement can be claimed once', p.glints > gA && Object.keys(p.ach).length === 1);

// 10. interstitial rules
await tap('[data-act=home]');
const inter = async runs => { await page.evaluate(n => { const S = window.__bfBoot.S; S.profile.p.stats.runs = n; S.profile.p.lastInterstitial = 0; window.__interstitials = 0; }, runs); await tap('[data-act=setup]'); await tap('[data-act=start]', 500); await tap('[data-act=pause]'); await tap('.ov [data-k=a]'); await tap('.ov [data-k=y]'); await tap('.ov [data-k=home]', 500); return page.evaluate(() => window.__interstitials || 0); };
ok('no interstitial for a Remove Ads owner', (await inter(10)) === 0);
await page.evaluate(() => { window.__bfBoot.S.profile.p.iap.removeAds = false; });
ok('no interstitial during the first 3 runs', (await inter(0)) === 0);
ok('interstitial shows between runs after that', (await inter(10)) === 1);
await tap('[data-act=setup]'); await tap('[data-act=start]', 500); await tap('[data-act=pause]'); await tap('.ov [data-k=a]'); await tap('.ov [data-k=y]'); await tap('.ov [data-k=home]', 500);
ok('at most one interstitial per 4 minutes', (await page.evaluate(() => window.__interstitials)) === 1);

// 11. daily brew, settings, corrupted save
await tap('[data-act=daily]', 600); ok('Daily Brew starts with the shared seed', await page.evaluate(() => window.__bf.run.mode === 'daily'));
await tap('[data-act=pause]'); await tap('.ov [data-k=h]');
await tap('[data-act=settings]'); await tap('[data-act=toggle][data-k=music]'); p = await P(); ok('settings persist', p.settings.music === false);
await page.evaluate(() => window.__bfBoot.S.save(true)); await wait(200);
// Corrupt the stored save before the game boots (an init script runs ahead of the page's own code).
const corrupt = async js => { const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); await pg.addInitScript(js); await pg.goto(URL); await pg.waitForTimeout(700); await page.close(); page = pg; };
await corrupt(`if(!sessionStorage.c1){sessionStorage.c1=1;localStorage.setItem('brewfall.save.bak',localStorage.getItem('brewfall.save.v1'));localStorage.setItem('brewfall.save.v1','{"d":"{garbage","h":1}');}`);
p = await P(); ok('corrupted save recovers from the backup copy', p.moons === 210 && p.iap.starter === true && (await page.evaluate(() => window.__bfBoot.S.profile.recovered)) === 'backup');
await corrupt(`if(!sessionStorage.c2){sessionStorage.c2=1;localStorage.setItem('brewfall.save.v1','xx');localStorage.removeItem('brewfall.save.bak');}`);
ok('unreadable save starts fresh without crashing', (await P()).glints === 0 && (await page.evaluate(() => window.__bfBoot.S.profile.recovered)) === 'reset' && await has('[data-act=setup]'));

// 12. small screen layout + performance under 4x CPU throttle with a full cauldron
await ctx.close(); ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
await open(true); if (await has('.ov [data-k=c]')) await tap('.ov [data-k=c]');
await tap('[data-act=setup]'); await tap('[data-act=start]', 600);
const fit = await page.evaluate(() => { const c = document.querySelector('#cv').getBoundingClientRect(), t = document.querySelector('#tray').getBoundingClientRect(); return { cw: c.width, ch: c.height, trayBottom: t.bottom, vh: innerHeight, sw: document.documentElement.scrollWidth, vw: innerWidth }; });
ok('fits a 320x568 phone without overflow', fit.trayBottom <= fit.vh + 1 && fit.sw <= fit.vw && fit.ch > 250, JSON.stringify(fit));
const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const perf = await page.evaluate(() => new Promise(res => { const { board, run } = window.__bf; run.dropsLeft = 999; for (let i = 0; i < 70; i++) { const b = board.world.add(1 + (i % 9 === 0 ? 4 : i % 4), 20 + (i * 53) % 320, 470 - i * 5); } let n = 0, t0 = performance.now(), worst = 0, last = t0; const f = t => { worst = Math.max(worst, t - last); last = t; if (++n < 180) requestAnimationFrame(f); else res({ fps: Math.round(n / ((performance.now() - t0) / 1000)), worst: Math.round(worst), bodies: board.world.bodies.length }); }; requestAnimationFrame(f); }));
ok('holds a playable frame rate with a crowded cauldron at 4x CPU slowdown', perf.fps >= 30, JSON.stringify(perf));

ok('no JavaScript errors during the whole session', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter(r => !r[1]); console.log(`\n${results.length - failed.length}/${results.length} passed`); process.exit(failed.length ? 1 : 0);
