/* Browser smoke test: plays through onboarding, a run, death, workshop and every screen. usage: node tools/smoke.js [outDir] */
const { chromium, devices } = require('playwright');
const out = process.argv[2] || '/tmp/eh-shots';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('http://localhost:8765/index.html');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: out + '/01-welcome.png' });
  await p.click('[data-k="go"]');
  await p.waitForTimeout(6000);
  await p.screenshot({ path: out + '/02-run-coach.png' });
  // play: buy upgrades as an eager player for a while at 2x
  await p.click('[data-act="speed"]');
  for (let i = 0; i < 40; i++) {
    await p.evaluate(() => { const r = EH.Game.run; if (!r || EH.UI.modalOpen()) return; ['damage','speed','health','regen','range','crit','cinderKill'].forEach(id => { if (r.unlocked(id)) EH.Game.buy(id); }); });
    const boon = await p.$('[data-boon]'); if (boon) { await p.screenshot({ path: out + '/04-boon.png' }); await boon.click(); }
    if (i === 6) { await p.click('[data-tab="defense"]'); }
    if (i === 12) await p.screenshot({ path: out + '/03-run.png' });
    if (await p.$('[data-k="ad"]')) break;
    await p.waitForTimeout(1500);
  }
  // fast-forward to death if still alive
  await p.evaluate(() => { const r = EH.Game.run; if (r && !r.over) r.damageEmber(1e12, null); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/05-revive.png' });
  await p.click('[data-k="no"]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/06-summary.png' });
  await p.click('[data-k="dbl"]'); await p.waitForTimeout(2800);
  await p.click('[data-k="menu"]'); await p.waitForTimeout(600);
  await p.screenshot({ path: out + '/07-home.png' });
  await p.evaluate(() => { EH.Save.data.embers += 500; EH.Save.data.gems += 300; });
  for (const s of ['workshop', 'flames', 'quests', 'shop']) { await p.click('#nav [data-to="' + s + '"]'); await p.waitForTimeout(300); await p.screenshot({ path: out + '/08-' + s + '.png' }); }
  await p.click('#nav [data-to="workshop"]'); await p.click('[data-act="ws"][data-id="damage"]'); await p.click('[data-tab="abilities"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/09-abilities.png' });
  await p.click('[data-act="settings"]'); await p.waitForTimeout(300); await p.screenshot({ path: out + '/10-settings.png' });
  await p.click('[data-tg="contrast"]'); await p.click('[data-ts="1.3"]'); await p.click('[data-k="x"]');
  await p.click('#nav [data-to="home"]'); await p.click('[data-act="play"]'); await p.waitForTimeout(9000);
  await p.screenshot({ path: out + '/11-run-contrast-bigtext.png' });
  // persistence
  await p.reload(); await p.waitForTimeout(1500);
  const st = await p.evaluate(() => ({ embers: EH.Save.data.embers, runs: EH.Save.data.stats.runs, ws: EH.Save.data.workshop.damage, contrast: EH.Save.data.settings.contrast }));
  console.log('after reload', JSON.stringify(st));
  await p.screenshot({ path: out + '/12-after-reload.png' });
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
  await b.close();
})();
