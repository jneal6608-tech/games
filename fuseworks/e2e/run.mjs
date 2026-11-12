// End-to-end test: drives the real built game in headless Chromium at phone size, using real pointer input.
//   npm run build && npm run e2e
// Serves ./dist itself, so nothing else needs to be running. Exits non-zero on any failed check or page error.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = resolve(process.cwd(), process.env.E2E_DIR ?? 'dist');
const SHOTS = resolve(process.cwd(), 'e2e/shots');
mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, r));
const URL_BASE = `http://localhost:${server.address().port}/`;

let passed = 0;
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`); } else { failures.push(name); console.log(`FAIL  ${name} ${detail}`); }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

const state = () => page.evaluate(() => {
  const a = window.__fuseworks, r = a.run;
  return {
    screen: a.screen, tickets: a.meta.tickets, premium: a.meta.premium, tutorialDone: a.meta.tutorialDone, settings: a.meta.settings,
    run: r && { phase: r.phase, night: r.night, showIdx: r.showIdx, coins: r.coins, charms: r.charms.length, crate: r.crate.length, mode: r.mode, encoreUsed: r.encoreUsed,
      score: r.show.score, target: r.show.target, matches: r.show.matchesLeft, restocks: r.show.restocksLeft, hand: r.show.hand.map((s) => s.id), placed: r.show.cells.filter((c) => c.shell).length },
  };
});
const fast = () => page.evaluate(() => { window.__fuseworks.testSpeed = 25; });
const center = (i) => page.evaluate((i) => window.__fuseworks.stage.cellCenter(i), i);
const tapCell = async (i) => { const p = await center(i); await page.mouse.click(p.x, p.y); await page.waitForTimeout(60); };
const shot = (name) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
const waitIdle = () => page.waitForFunction(() => !window.__fuseworks.animating, null, { timeout: 30000 });
const freeCells = () => page.evaluate(() => window.__fuseworks.run.show.cells.map((c, i) => (!c.blocked && !c.shell ? i : -1)).filter((i) => i >= 0));
const shellCells = () => page.evaluate(() => window.__fuseworks.run.show.cells.map((c, i) => (c.shell ? i : -1)).filter((i) => i >= 0));

/** Drag hand card `n` onto cell `i` with a real press-move-release gesture. */
async function dragCard(n, i) {
  const box = await page.locator('.card').nth(n).boundingBox();
  const to = await center(i);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 30, { steps: 4 });
  await page.mouse.move(to.x, to.y + 46, { steps: 8 }); // the shell floats 46px above the finger
  await page.mouse.up();
  await page.waitForTimeout(80);
}
/** Place the whole hand next to what is already on the sky (tap-to-select, tap-to-place), then light the best start. */
async function playMatch() {
  for (let guard = 0; guard < 8; guard++) {
    const s = await state();
    if (!s.run.hand.length) break;
    const cell = await page.evaluate(() => {
      const a = window.__fuseworks, cells = a.run.show.cells;
      const free = cells.map((c, i) => (!c.blocked && !c.shell ? i : -1)).filter((i) => i >= 0);
      const near = free.filter((i) => cells.some((c, j) => c.shell && Math.abs((j % 5) - (i % 5)) + Math.abs(Math.floor(j / 5) - Math.floor(i / 5)) === 1));
      return (near.length ? near : free)[0] ?? -1;
    });
    if (cell < 0) break;
    await page.locator('.card').first().click();
    await tapCell(cell);
  }
  // choose the start with the longest previewed chain by tapping each shell and reading the info line
  let bestCell = -1, bestChain = -1;
  for (const i of await shellCells()) {
    await tapCell(i);
    const txt = await page.locator('#info').innerText();
    const m = txt.match(/sets off (\d+) burst/);
    const n = m ? Number(m[1]) : 0;
    if (n > bestChain) { bestChain = n; bestCell = i; }
    await tapCell(i); // deselect
  }
  await tapCell(bestCell);
  await page.click('#btn-light');
  await page.waitForTimeout(50);
  await waitIdle();
  await page.waitForTimeout(120);
  return bestChain;
}

try {
  // ------------------------------------------------------------ 1. first launch
  console.log('\n1. First launch and title');
  await page.goto(URL_BASE);
  await page.waitForSelector('#btn-new');
  await page.waitForTimeout(900);
  await shot('01-title');
  let s = await state();
  check('title screen shown', s.screen === 'title');
  check('no saved run on first launch', s.run === null && (await page.locator('#btn-continue').count()) === 0);
  check('fresh save has 0 tickets and tutorial pending', s.tickets === 0 && !s.tutorialDone);

  // ------------------------------------------------------------ 2. tutorial with real drag input
  console.log('\n2. Tutorial show (real drag gestures)');
  await page.click('#btn-new');
  await page.waitForSelector('#btn-light');
  s = await state();
  check('first run starts the tutorial show', s.screen === 'show' && s.run.night === 1 && s.run.showIdx === 0 && s.run.hand.length === 5);
  check('coach bubble visible', (await page.locator('#coach').count()) === 1 && /Drag a shell/.test(await page.locator('#coach').innerText()));
  await shot('02-tutorial');
  await dragCard(0, 12); // star cell (2,2)
  s = await state();
  check('drag-and-drop places a shell', s.run.placed === 1 && s.run.hand.length === 4);
  check('coach advanced to step 2', /second shell/.test(await page.locator('#coach').innerText()));
  await dragCard(0, 17);
  await dragCard(0, 18);
  // drag a placed (not yet lit) shell to another cell, then back
  const from = await center(18), to = await center(13);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(from.x, from.y - 20, { steps: 3 }); await page.mouse.move(to.x, to.y + 46, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(80);
  check('a placed shell can be dragged to another cell', (await shellCells()).includes(13) && !(await shellCells()).includes(18));
  await page.locator('.card').first().click(); await tapCell(11);
  await page.locator('.card').first().click(); await tapCell(7);
  s = await state();
  check('tap-to-select then tap-to-place works', s.run.placed === 5 && s.run.hand.length === 0);
  await page.click('#btn-light');
  check('lighting without choosing a start is refused with a hint', (await state()).run.matches === 3 && (await page.locator('#toast div').count()) > 0);
  await tapCell(12);
  check('selecting a shell previews the chain', /sets off \d+ burst/.test(await page.locator('#info').innerText()));
  await shot('03-preview');
  await page.click('#btn-light');
  await page.waitForTimeout(700);
  await shot('04-chain');
  await fast();
  await waitIdle();
  s = await state();
  check('first Match scored and spent', s.run.score > 0 && s.run.matches === 2, JSON.stringify(s.run));
  check('tutorial show needs a second Match', s.run.phase === 'show');
  check('hand refilled after lighting', s.run.hand.length === 5);
  check('final coach message explains scoring', /Sparkle × Awe/.test(await page.locator('#coach').innerText()));
  await page.click('#btn-coach-ok');
  check('tutorial marked done', (await state()).tutorialDone === true);
  const locked = await center(12);
  await page.mouse.move(locked.x, locked.y); await page.mouse.down(); await page.mouse.move(locked.x + 80, locked.y + 120, { steps: 5 }); await page.mouse.up();
  check('lit shells are locked into the display', (await shellCells()).includes(12));

  // ------------------------------------------------------------ 3. restock, crate view, finish the show
  console.log('\n3. Restock, crate, clearing a show');
  const handBefore = (await state()).run.hand.join(',');
  await page.click('#btn-restock');
  s = await state();
  check('restock swaps the hand and uses a restock', s.run.hand.join(',') !== handBefore && s.run.restocks === 1);
  await page.click('#btn-crate');
  check('crate sheet lists shells', (await page.locator('.shellgrid > *').count()) >= 5);
  await page.locator('.sheet .btn.primary').click();
  let guard = 0;
  while ((await state()).run.phase === 'show' && guard++ < 4) await playMatch();
  s = await state();
  check('show cleared', s.run.phase === 'cleared', JSON.stringify(s.run));
  await page.waitForSelector('#btn-next');
  await shot('05-cleared');
  check('results sheet shows coins earned', /Show fee/.test(await page.locator('.sheet').innerText()));
  await page.click('#btn-next');

  // ------------------------------------------------------------ 4. market
  console.log('\n4. Market');
  await page.waitForSelector('#market');
  s = await state();
  check('market opens after a cleared show', s.screen === 'market' && s.run.phase === 'shop');
  await shot('06-market');
  await page.evaluate(() => { const a = window.__fuseworks; a.run.coins = 60; a.goMarket(); });
  await page.click('[data-offer="charm0"]');
  check('buying a charm adds it and costs coins', (await state()).run.charms === 1 && (await state()).run.coins < 60);
  const crate0 = (await state()).run.crate;
  await page.click('[data-offer="pack0"]');
  await page.waitForSelector('[data-pick="0"]');
  await shot('07-pack');
  await page.click('[data-pick="0"]');
  check('shell pack adds one shell to the crate', (await state()).run.crate === crate0 + 1);
  await page.click('[data-offer="upgrade"]');
  check('refinement purchased', await page.evaluate(() => Object.values(window.__fuseworks.run.levels).some((v) => v === 1)));
  await page.click('[data-offer="trim"]');
  await page.locator('.shellgrid button').first().click();
  check('trimming removes a shell', (await state()).run.crate === crate0);
  if (await page.locator('.sheet .btn.primary').count()) await page.locator('.sheet .btn.primary').click();
  const offers0 = await page.locator('#market .offer .txt b').allInnerTexts();
  await page.click('#btn-reroll');
  check('reroll changes the offers', (await page.locator('#market .offer .txt b').allInnerTexts()).join() !== offers0.join());
  await page.click('#btn-free-reroll');
  await page.waitForSelector('.sheet h2:has-text("Test ad")');
  await page.waitForFunction(() => { const b = document.querySelector('.sheet .btn.primary'); return b && !b.disabled; });
  await page.locator('.sheet .btn.primary').click();
  await page.waitForTimeout(100);
  check('rewarded "free reroll" grants once per visit', (await page.locator('#btn-free-reroll').count()) === 0);
  await page.locator('.chips .charm').first().click();
  await page.click('#btn-sell');
  check('a charm can be sold', (await state()).run.charms === 0);
  await page.click('[data-offer="charm0"]');
  await page.click('#btn-next-show');
  await page.waitForSelector('#btn-light');
  s = await state();
  check('next show starts (Night 1 Feature)', s.screen === 'show' && s.run.showIdx === 1 && s.run.matches === 3);

  // ------------------------------------------------------------ 5. save & resume
  console.log('\n5. Save and resume across a reload');
  await fast();
  await page.locator('.card').first().click(); await tapCell((await freeCells())[0]);
  const before = await state();
  await page.reload();
  await page.waitForSelector('#btn-continue');
  check('title offers Continue after reload', true);
  await page.click('#btn-continue');
  await page.waitForSelector('#btn-light');
  const after = await state();
  check('run restored exactly', JSON.stringify(after.run) === JSON.stringify(before.run), `${JSON.stringify(before.run)} vs ${JSON.stringify(after.run)}`);
  check('charm survived the reload', after.run.charms === 1);

  // ------------------------------------------------------------ 6. failing, Encore (rewarded), end of run
  console.log('\n6. Failing a show, Encore, end of run');
  await fast();
  await page.evaluate(() => { const a = window.__fuseworks; a.run.show.target = 99999999; a.renderShow(); });
  guard = 0;
  while ((await state()).run.phase === 'show' && guard++ < 5) await playMatch();
  check('running out of Matches fails the show', (await state()).run.phase === 'failed');
  await page.waitForSelector('#btn-encore');
  await shot('08-failed');
  check('Encore is offered as an opt-in ad', /Watch ad/.test(await page.locator('#btn-encore').innerText()));
  await page.click('#btn-encore');
  await page.waitForSelector('.sheet h2:has-text("Test ad")');
  await page.locator('.sheet .btn.ghost').click(); // close without reward
  await page.waitForSelector('#btn-encore');
  check('closing the ad early gives no reward', (await state()).run.phase === 'failed');
  await page.click('#btn-encore');
  await page.waitForFunction(() => { const b = document.querySelector('.sheet .btn.primary'); return b && !b.disabled; });
  await page.locator('.sheet .btn.primary').click();
  await page.waitForSelector('#btn-light');
  s = await state();
  check('watching the ad grants one extra Match', s.run.phase === 'show' && s.run.matches === 1 && s.run.encoreUsed);
  await fast();
  await playMatch();
  await page.waitForSelector('#btn-endrun');
  check('Encore cannot be used twice', (await page.locator('#btn-encore').count()) === 0);
  await page.click('#btn-endrun');
  await page.waitForSelector('#btn-again');
  await shot('09-runover');
  s = await state();
  check('run over screen, run cleared from save', s.screen === 'end' && s.run === null);
  check('tickets banked', s.tickets > 0, `tickets=${s.tickets}`);
  const t0 = s.tickets;
  await page.click('#btn-double');
  await page.waitForFunction(() => { const b = document.querySelector('.sheet .btn.primary'); return b && !b.disabled; });
  await page.locator('.sheet .btn.primary').click();
  await page.waitForTimeout(150);
  check('double-tickets ad doubles the run reward once', (await state()).tickets > t0 && (await page.locator('#btn-double').count()) === 0);
  await page.click('#btn-end-home');
  await page.waitForSelector('#btn-new');
  check('back on the title with no Continue button', (await page.locator('#btn-continue').count()) === 0);

  // ------------------------------------------------------------ 7. workshop, records, settings
  console.log('\n7. Workshop, records, settings');
  await page.evaluate(() => { const a = window.__fuseworks; a.meta.tickets = 100; a.save(); a.goTitle(); });
  await page.click('#btn-workshop');
  await shot('10-workshop');
  await page.click('[data-unlock="palm"]');
  check('unlocking a shell spends tickets', await page.evaluate(() => window.__fuseworks.meta.shells.includes('palm') && window.__fuseworks.meta.tickets === 88));
  await page.click('[data-tab="charm"]');
  await page.click('[data-unlock="echo"]');
  check('unlocking a charm works', await page.evaluate(() => window.__fuseworks.meta.charms.includes('echo')));
  await page.click('[data-tab="crate"]');
  await page.click('[data-unlock="duotone"]');
  await page.click('[data-tab="sky"]');
  await page.click('[data-unlock="lake"]');
  await page.click('[data-unlock="lake"]');
  check('unlocking then selecting a sky applies it', await page.evaluate(() => window.__fuseworks.meta.sky === 'lake'));
  await page.waitForTimeout(300);
  await shot('11-sky-lake');
  await page.click('[data-unlock="aurora"]');
  check('premium sky opens the Premium sheet instead of unlocking', (await page.locator('#btn-buy').count()) === 1 && !(await state()).premium);
  await page.locator('.sheet .btn.ghost').click();
  // ticket shop: opened from the Workshop counter, and offered when an unlock is unaffordable
  await page.evaluate(() => { const a = window.__fuseworks; a.meta.tickets = 0; a.goWorkshop(); });
  await page.click('[data-tab="shell"]');
  await page.click('[data-unlock="dragon"]');
  await page.waitForSelector('[data-pack="tickets_200"]');
  check('tapping an unaffordable unlock offers ticket packs with the shortfall', /You need 45 more tickets/.test(await page.locator('.sheet').innerText()) && (await page.locator('[data-pack]').count()) === 3);
  await page.click('[data-pack="tickets_200"]');
  await page.locator('.sheet .btn.ghost').click(); // cancel the purchase
  await page.waitForSelector('[data-pack="tickets_200"]');
  check('cancelling a ticket purchase grants nothing and returns to the packs', (await state()).tickets === 0);
  await page.click('[data-pack="tickets_200"]');
  await page.locator('.sheet .btn.gold').click();
  await page.waitForSelector('[data-unlock="dragon"]');
  check('buying a 200-ticket pack adds exactly 200 tickets', (await state()).tickets === 200);
  await page.click('#btn-tickets');
  await page.click('[data-pack="tickets_60"]');
  await page.locator('.sheet .btn.gold').click();
  await page.waitForTimeout(150);
  check('the ticket counter opens the shop and packs can be bought again', (await state()).tickets === 260);
  await page.click('[data-unlock="dragon"]');
  check('bought tickets unlock content', await page.evaluate(() => window.__fuseworks.meta.shells.includes('dragon') && window.__fuseworks.meta.tickets === 215));
  await page.reload();
  await page.waitForSelector('#btn-tickets');
  check('bought tickets survive a reload', (await state()).tickets === 215 && /215/.test(await page.locator('#btn-tickets').innerText()));
  await page.click('#btn-collection');
  check('records screen lists achievements', (await page.locator('.ach').count()) >= 10 && (await page.locator('.ach.done').count()) >= 1);
  await shot('12-records');
  await page.click('#btn-back');
  await page.locator('.title .icon-btn').click();
  await page.click('[data-setting="music"]');
  await page.click('[data-setting="reducedFx"]');
  await page.click('#btn-settings-done');
  await page.reload();
  await page.waitForSelector('#btn-new');
  s = await state();
  check('settings and unlocks persist across a reload', s.settings.music === false && s.settings.reducedFx === true && s.tickets > 0);
  await page.locator('.title .icon-btn').click();
  await page.click('[data-setting="music"]'); await page.click('[data-setting="reducedFx"]');
  await page.click('#btn-settings-done');

  // ------------------------------------------------------------ 8. new festival setup uses unlocks; premium
  console.log('\n8. Run setup with unlocked crate, Premium purchase');
  await page.click('#btn-new');
  await page.waitForSelector('#btn-start');
  check('setup sheet offers the unlocked crate', /Duotone/.test(await page.locator('.sheet').innerText()));
  await page.locator('.sheet .offer', { hasText: 'Duotone' }).click();
  await page.click('#btn-start');
  await page.waitForSelector('#btn-light');
  check('duotone run has only two colours and no tutorial', await page.evaluate(() => { const r = window.__fuseworks.run; return new Set(r.crate.map((s) => s.color)).size === 2 && !r.tutorial && r.poolShells.includes('palm'); }));
  await page.click('#btn-menu');
  await page.click('#btn-home');
  await page.waitForSelector('#btn-premium');
  await page.click('#btn-premium');
  await shot('13-premium');
  await page.click('#btn-buy');
  await page.locator('.sheet .btn.gold').click();
  await page.waitForTimeout(200);
  s = await state();
  check('Premium purchase activates and hides the upsell', s.premium && (await page.locator('#btn-premium').count()) === 0);

  // ------------------------------------------------------------ 9. daily show, played to the end as Premium (no ads)
  console.log('\n9. Daily Show');
  await page.click('#btn-daily');
  await page.click('#btn-daily-play');
  await page.click('#btn-yes'); // abandon the duotone run
  await page.waitForSelector('#btn-light');
  await fast();
  s = await state();
  check('daily run starts with 2 preset charms', s.run.mode === 'daily' && s.run.charms === 2);
  for (let showN = 0; showN < 3; showN++) {
    guard = 0;
    while ((await state()).run.phase === 'show' && guard++ < 6) await playMatch();
    check(`daily show ${showN + 1} uses every Match`, (await state()).run.matches === 0);
    await page.waitForSelector('#btn-next');
    if (showN === 0) await shot('14-daily-show');
    await page.click('#btn-next');
    if (showN < 2) {
      await page.waitForSelector('#market');
      if (showN === 0) check('Premium shows no ad wording', !/Watch ad/.test(await page.locator('#market').innerText()));
      await page.click('#btn-next-show');
      await page.waitForSelector('#btn-light');
      await fast();
    }
  }
  await page.waitForSelector('#btn-again');
  await shot('15-daily-end');
  s = await state();
  check('daily finished and banked', s.screen === 'end' && s.run === null);
  check('Premium doubled the tickets automatically', /Premium: doubled/.test(await page.locator('.panel').innerText()) && (await page.locator('#btn-double').count()) === 0);
  await page.click('#btn-again');
  await page.waitForSelector('#btn-daily');
  check('title shows today\'s daily score', /✓/.test(await page.locator('#btn-daily').innerText()));
  check('daily streak is 1', await page.evaluate(() => window.__fuseworks.meta.daily.streak === 1));

  // ------------------------------------------------------------ 9b. endless mode from the title button
  console.log('\n9b. Endless mode');
  check('title has an Endless button', (await page.locator('#btn-endless-mode').count()) === 1 && /No final night/.test(await page.locator('#btn-endless-mode').innerText()));
  await page.click('#btn-endless-mode');
  await page.waitForSelector('#btn-start');
  check('endless setup offers crates but no stakes', /Endless play/.test(await page.locator('.sheet').innerText()) && !/Stake/.test(await page.locator('.sheet').innerText()));
  await page.click('#btn-start');
  await page.waitForSelector('#btn-light');
  await fast();
  s = await state();
  check('endless run started', s.run.mode === 'endless' && s.run.night === 1 && /Endless · Night 1/.test(await page.locator('.hud-title').innerText()));
  await page.evaluate(() => { const a = window.__fuseworks; a.run.night = 6; a.run.showIdx = 2; a.run.show.target = 1; a.renderShow(); });
  await playMatch();
  await page.waitForSelector('#btn-next');
  check('clearing the night-6 finale does not end an endless run', /To the Market/.test(await page.locator('#btn-next').innerText()) && (await page.locator('#btn-endless').count()) === 0);
  await page.click('#btn-next');
  await page.waitForSelector('#market');
  check('market footer points at night 7', /Night 7/.test(await page.locator('.panel-foot').innerText()));
  await page.click('#btn-next-show');
  await page.waitForSelector('#btn-light');
  await fast();
  s = await state();
  check('endless continues into night 7 with a higher target', s.run.night === 7 && s.run.target > 32000, JSON.stringify(s.run));
  await page.click('#btn-menu');
  await page.click('#btn-home');
  await page.waitForSelector('#btn-continue');
  check('Continue shows the endless run', /Endless · Night 7/.test(await page.locator('#btn-continue').innerText()));
  await page.click('#btn-continue');
  await page.waitForSelector('#btn-light');
  await fast();
  await page.evaluate(() => { const a = window.__fuseworks; a.run.show.target = 99999999999; a.renderShow(); });
  guard = 0;
  while ((await state()).run.phase === 'show' && guard++ < 5) await playMatch();
  await page.waitForSelector('#btn-endrun');
  await page.click('#btn-endrun');
  await page.waitForSelector('#btn-again');
  await shot('17-endless-over');
  const endText = await page.locator('.panel').innerText();
  check('endless end screen shows the record and no festival win', /Endless run over/.test(endText) && /New Endless record/.test(endText) && !/Festival complete/.test(endText));
  check('endless record saved, no stake unlocked', await page.evaluate(() => { const m = window.__fuseworks.meta; return m.stats.bestEndless === 1 && m.stakeMax === 1 && m.stats.wins === 0; }));
  check('end screen offers another endless run', /Play Endless again/.test(await page.locator('#btn-again').innerText()));
  await page.click('#btn-end-home');
  await page.waitForSelector('#btn-endless-mode');
  check('title shows the endless best', /Best: 1 night/.test(await page.locator('#btn-endless-mode').innerText()));
  await page.waitForTimeout(900); // let the title's entrance animation finish
  await shot('18-title-endless');

  // ------------------------------------------------------------ 10. a long chain at full effects: frame rate
  console.log('\n10. Performance under a 20-burst chain');
  await page.evaluate(() => {
    const a = window.__fuseworks;
    a.newFestival();
  });
  if (await page.locator('#btn-start').count()) await page.click('#btn-start');
  await page.waitForSelector('#btn-light');
  await page.evaluate(() => {
    const a = window.__fuseworks, show = a.run.show;
    show.target = 1e12;
    let id = 9000;
    show.cells.forEach((c, i) => { c.blocked = false; if (i < 20) { c.shell = { id: id++, type: ['ring', 'chrys', 'brocade', 'willow', 'peony'][i % 5], color: i % 4 }; c.locked = true; } });
    a.renderShow();
  });
  await tapCell(7);
  const perf = page.evaluate(() => new Promise((res) => {
    const a = window.__fuseworks; let frames = 0, worst = 0, last = performance.now(), peak = 0; const t0 = last;
    const tick = (t) => { frames++; worst = Math.max(worst, t - last); last = t; peak = Math.max(peak, a.stage.parts.length); if (a.animating || t - t0 < 500) requestAnimationFrame(tick); else res({ fps: Math.round((frames * 1000) / (t - t0)), worst: Math.round(worst), peak, quality: a.stage.quality }); };
    requestAnimationFrame(tick);
  }));
  await page.click('#btn-light');
  await page.waitForTimeout(1500);
  await shot('16-big-chain');
  const p = await perf;
  console.log(`      ${JSON.stringify(p)} (headless software rendering)`);
  check('big chain completes and stays above 30 fps here', p.fps >= 30 && p.peak > 200, JSON.stringify(p));
  check('particle count stays inside the budget', p.peak <= 1700);

  check('no page errors or console errors during the whole session', errors.length === 0, errors.join(' | '));
} catch (e) {
  failures.push(`exception: ${e.message}`);
  console.log(`FAIL  exception: ${e.stack}`);
  await shot('zz-exception').catch(() => {});
  if (errors.length) console.log(errors.join('\n'));
}

await browser.close();
server.close();
console.log(`\n${passed} checks passed, ${failures.length} failed`);
if (failures.length) { console.log(failures.map((f) => ` - ${f}`).join('\n')); process.exit(1); }
