// Phone test: runs the built game under real phone device profiles (Android Chrome user agent, viewport,
// pixel ratio) and drives it with GENUINE TOUCH EVENTS (finger down / move / up through the browser's
// touch pipeline), including multi-touch, swipe scrolling, long-press and pinch. Also measures frame rate
// with the CPU throttled to mimic a slower phone.
//   npm run build && npm run e2e:touch
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = resolve(process.cwd(), 'dist');
const SHOTS = resolve(process.cwd(), 'e2e/shots/touch');
mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try { const p = new URL(req.url, 'http://x').pathname; const f = join(ROOT, p === '/' ? 'index.html' : p); res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' }); res.end(await readFile(f)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const URL_BASE = `http://localhost:${server.address().port}/`;

// Largest to smallest. Moto G4 is a 2016 phone on Android 7, the oldest Android version the app supports.
const PROFILES = ['Galaxy A55', 'Pixel 7', 'Pixel 5', 'Galaxy S24', 'Moto G4', 'Galaxy S9+'];
const MIN_TARGET = 40; // px; smallest acceptable touch target
const MIN_CELL = 44; // px; smallest comfortable sky cell

let total = 0;
const failures = [];
const summary = [];

async function runProfile(name) {
  const dev = devices[name];
  console.log(`\n=== ${name}  ${dev.viewport.width}x${dev.viewport.height} @${dev.deviceScaleFactor}x ===`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...dev });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  const check = (label, cond, detail = '') => {
    total++;
    if (cond) console.log(`  ok  ${label}`);
    else { failures.push(`${name}: ${label} ${detail}`); console.log(`FAIL  ${label} ${detail}`); }
  };

  // ---- touch primitives (Chrome DevTools Protocol: goes through the real touch → pointer event pipeline)
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: Math.round(p.x), y: Math.round(p.y), id: p.id ?? i, radiusX: 8, radiusY: 8, force: 0.5 })) });
  const tap = async (x, y) => { await touch('touchStart', [{ x, y }]); await page.waitForTimeout(40); await touch('touchEnd', []); await page.waitForTimeout(90); };
  const tapEl = async (sel) => { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error(`cannot tap ${sel}: not visible`); await tap(b.x + b.width / 2, b.y + b.height / 2); };
  const swipe = async (x0, y0, x1, y1, steps = 10, hold = 0) => {
    await touch('touchStart', [{ x: x0, y: y0 }]);
    if (hold) await page.waitForTimeout(hold);
    for (let i = 1; i <= steps; i++) { await touch('touchMove', [{ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }]); await page.waitForTimeout(16); }
    await touch('touchEnd', []);
    await page.waitForTimeout(120);
  };
  const center = (i) => page.evaluate((i) => window.__fuseworks.stage.cellCenter(i), i);
  const tapCell = async (i) => { const p = await center(i); await tap(p.x, p.y); };
  const cardCenter = async (n) => { const b = await page.locator('.card').nth(n).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  /** Finger-drag hand card n onto cell i. The shell floats 46px above the finger, so aim 46px below the cell. */
  const dragCard = async (n, i) => { const a = await cardCenter(n), b = await center(i); await swipe(a.x, a.y, b.x, b.y + 46, 12); };
  const st = () => page.evaluate(() => {
    const a = window.__fuseworks, r = a.run;
    return { screen: a.screen, animating: a.animating, speed: a.speed, selHand: a.selHand, selCell: a.selCell,
      run: r && { phase: r.phase, mode: r.mode, night: r.night, coins: r.coins, charms: r.charms.length, score: r.show.score, matches: r.show.matchesLeft, hand: r.show.hand.length,
        placed: r.show.cells.map((c, i) => (c.shell ? i : -1)).filter((i) => i >= 0) } };
  });
  const fast = () => page.evaluate(() => { window.__fuseworks.testSpeed = 25; });
  const idle = () => page.waitForFunction(() => !window.__fuseworks.animating, null, { timeout: 30000 });
  const shot = (n) => page.screenshot({ path: join(SHOTS, `${name.replace(/[^a-z0-9]+/gi, '-')}-${n}.png`) });
  /** Every visible button: inside the viewport, and big enough for a thumb. */
  const auditTargets = (scope) => page.evaluate(([scope, min]) => {
    const bad = [];
    for (const el of document.querySelectorAll(`${scope} button`)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || el.disabled) continue;
      const scroller = el.closest('.panel-body, .sheet');
      const label = (el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 18) || el.className).replace(/\s+/g, ' ');
      if (Math.min(r.width, r.height) < min) bad.push(`${label} is ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (!scroller && (r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5)) bad.push(`${label} is off-screen`);
    }
    return bad;
  }, [scope, MIN_TARGET]);
  const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);

  try {
    await page.goto(URL_BASE);
    await page.waitForSelector('#btn-new');
    await page.evaluate(() => {
      window.__ptr = { touch: 0, mouse: 0, pen: 0, ctx: 0 };
      addEventListener('pointerdown', (e) => { window.__ptr[e.pointerType]++; }, true);
      addEventListener('contextmenu', () => { window.__ptr.ctx++; }, true);
    });
    await page.waitForTimeout(900);
    await shot('1-title');

    // ---------------------------------------------------------- title
    check('reports as a touch phone (touch points, coarse pointer)', await page.evaluate(() => navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches));
    let bad = await auditTargets('.title');
    check('title: every button on-screen and thumb-sized', bad.length === 0, bad.join('; '));
    check('title: no sideways scroll', await noSideScroll());
    check('title: logo fits the screen width', await page.evaluate(() => { const r = document.querySelector('.logo h1').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));

    // ---------------------------------------------------------- tutorial, finger drag
    await tapEl('#btn-new');
    await page.waitForSelector('#btn-light');
    check('a finger tap starts a festival', (await st()).screen === 'show');
    check('the game received touch pointers, not mouse', await page.evaluate(() => window.__ptr.touch > 0 && window.__ptr.mouse === 0));
    const geo = await page.evaluate(() => {
      const a = window.__fuseworks, b = a.stage.board, hud = document.querySelector('#hud').getBoundingClientRect(), tray = document.querySelector('#tray').getBoundingClientRect();
      const cards = [...document.querySelectorAll('.card')].map((c) => c.getBoundingClientRect());
      return { cell: b.cell, top: b.y, bottom: b.y + b.cell * 6, left: b.x, right: b.x + b.cell * 5, hudBottom: hud.bottom, trayTop: tray.top, w: innerWidth, h: innerHeight,
        card: { w: Math.round(cards[0].width), h: Math.round(cards[0].height) }, cardsInside: cards.every((r) => r.left >= 0 && r.right <= innerWidth), trayH: Math.round(tray.height), hudH: Math.round(hud.height) };
    });
    console.log(`      sky cell ${geo.cell}px, HUD ${geo.hudH}px, tray ${geo.trayH}px, hand card ${geo.card.w}x${geo.card.h}px`);
    check('sky grid sits fully between the HUD and the hand tray', geo.top >= geo.hudBottom - 1 && geo.bottom <= geo.trayTop + 1 && geo.left >= 0 && geo.right <= geo.w, JSON.stringify(geo));
    check(`sky cells are at least ${MIN_CELL}px`, geo.cell >= MIN_CELL, `cell=${geo.cell}`);
    check('hand cards fit the width and are thumb-sized', geo.cardsInside && geo.card.w >= MIN_TARGET && geo.card.h >= MIN_TARGET, JSON.stringify(geo.card));
    bad = await auditTargets('#ui');
    check('show screen: every button on-screen and thumb-sized', bad.length === 0, bad.join('; '));
    check('coach bubble does not cover the hand', await page.evaluate(() => { const c = document.querySelector('#coach')?.getBoundingClientRect(), h = document.querySelector('#hand').getBoundingClientRect(); return !c || c.bottom <= h.top + 1; }));
    await shot('2-tutorial');

    await dragCard(0, 12);
    let s = await st();
    check('finger-drag from hand to sky places the shell', s.run.placed.includes(12) && s.run.hand === 4, JSON.stringify(s.run));
    check('no drag ghost left behind', (await page.locator('#drag-ghost').count()) === 0);

    await tapEl('.card');
    check('tapping a card selects it', (await st()).selHand === 0);
    await tapCell(17);
    s = await st();
    check('tapping a cell places the selected card', s.run.placed.includes(17) && s.run.hand === 3);

    // move a placed shell with a finger, then drag it back to the tray
    let a = await center(17), b = await center(18);
    await swipe(a.x, a.y, b.x, b.y + 46, 10);
    s = await st();
    check('finger-drag moves a placed shell to another cell', s.run.placed.includes(18) && !s.run.placed.includes(17), JSON.stringify(s.run.placed));
    a = await center(18);
    const trayBox = await page.locator('#hand').boundingBox();
    await swipe(a.x, a.y, a.x, trayBox.y + trayBox.height / 2 + 46, 12);
    s = await st();
    check('dragging a shell back onto the tray returns it to the hand', !s.run.placed.includes(18) && s.run.hand === 4, JSON.stringify(s.run));

    // a short accidental wiggle (under 10px) is still a tap, not a drag
    const c0 = await cardCenter(0);
    await swipe(c0.x, c0.y, c0.x + 5, c0.y - 4, 3);
    check('a tiny finger wobble still counts as a tap', (await st()).selHand === 0 && (await page.locator('#drag-ghost').count()) === 0);
    await tapCell(13);

    // long-press: must not open a context menu or select text, and behaves as a tap
    const lp = await cardCenter(0);
    await touch('touchStart', [{ x: lp.x, y: lp.y }]);
    await page.waitForTimeout(750);
    await touch('touchEnd', []);
    await page.waitForTimeout(120);
    check('long-press selects the card and opens no context menu or text selection', (await st()).selHand === 0 && (await page.evaluate(() => window.__ptr.ctx === 0 && String(getSelection()) === '')));
    await tapCell(11);

    // ---------------------------------------------------------- multi-touch robustness
    const before = await st();
    const d0 = await cardCenter(0), mid = await center(7), other = await center(29);
    await touch('touchStart', [{ x: d0.x, y: d0.y, id: 1 }]);
    for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: d0.x + ((mid.x - d0.x) * i) / 6, y: d0.y + ((mid.y + 46 - d0.y) * i) / 6, id: 1 }]); await page.waitForTimeout(16); }
    // a second finger lands on the sky and on another card while the first is still dragging
    await touch('touchStart', [{ x: mid.x, y: mid.y + 46, id: 1 }, { x: other.x, y: other.y, id: 2 }]);
    await page.waitForTimeout(40);
    const d1 = await cardCenter(1);
    await touch('touchMove', [{ x: mid.x, y: mid.y + 46, id: 1 }, { x: d1.x, y: d1.y, id: 2 }]);
    await touch('touchEnd', [{ x: mid.x, y: mid.y + 46, id: 1 }]); // second finger lifts first
    await page.waitForTimeout(40);
    await touch('touchEnd', []);
    await page.waitForTimeout(150);
    s = await st();
    check('a second finger during a drag does not break it: the shell lands where the first finger dropped it', s.run.placed.includes(7) && s.run.placed.length === before.run.placed.length + 1, JSON.stringify(s.run.placed));
    check('multi-touch leaves no stuck ghost or selection', (await page.locator('#drag-ghost').count()) === 0 && (await page.locator('.card.ghosted').count()) === 0);

    // two fingers down at once on two different cards
    if ((await page.locator('.card').count()) >= 2) {
      const p0 = await cardCenter(0), p1 = await cardCenter(1);
      await touch('touchStart', [{ x: p0.x, y: p0.y, id: 1 }, { x: p1.x, y: p1.y, id: 2 }]);
      await page.waitForTimeout(40);
      await touch('touchEnd', []);
      await page.waitForTimeout(120);
      check('two fingers tapping two cards at once leaves a sane state', (await page.locator('.card.sel').count()) <= 1 && (await page.locator('#drag-ghost').count()) === 0);
      if ((await st()).selHand >= 0) await tapEl('.card.sel');
    }

    // pinch must not zoom the game
    const mx = geo.w / 2, my = (geo.top + geo.bottom) / 2;
    await touch('touchStart', [{ x: mx - 20, y: my, id: 1 }, { x: mx + 20, y: my, id: 2 }]);
    for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: mx - 20 - i * 12, y: my, id: 1 }, { x: mx + 20 + i * 12, y: my, id: 2 }]); await page.waitForTimeout(16); }
    await touch('touchEnd', []);
    await page.waitForTimeout(150);
    check('pinch does not zoom or scroll the page', await page.evaluate(() => (visualViewport?.scale ?? 1) === 1 && scrollX === 0 && scrollY === 0));
    // a vertical swipe over the sky must not scroll or pull-to-refresh
    await swipe(mx, geo.top + 10, mx, geo.bottom - 10, 10);
    check('swiping over the sky does not scroll the page', await page.evaluate(() => scrollY === 0 && document.documentElement.scrollTop === 0));
    if ((await st()).selCell >= 0 || (await st()).selHand >= 0) await tap(geo.w / 2, geo.hudBottom + 2).catch(() => {});

    // ---------------------------------------------------------- aim, light, fast-forward by touch
    await page.evaluate(() => { const a = window.__fuseworks; a.selHand = -1; a.selCell = -1; a.renderShow(); });
    await tapCell(12);
    s = await st();
    check('tapping a shell on the sky aims the fuse and shows the chain', s.selCell === 12 && /sets off \d+ burst/.test(await page.locator('#info').innerText()));
    await shot('3-aimed');
    await tapEl('#btn-light');
    await page.waitForTimeout(450);
    check('Light fuse works by touch', (await st()).animating === true);
    await shot('4-chain');
    await tap(geo.w / 2, (geo.top + geo.bottom) / 2);
    check('tapping the sky during the show fast-forwards it', (await st()).speed === 4);
    await idle();
    s = await st();
    check('the Match scored', s.run.score > 0 && s.run.matches === 2);
    if (await page.locator('#btn-coach-ok').count()) await tapEl('#btn-coach-ok');

    // locked shells cannot be dragged by a finger
    const lk = await center(12), away = await center(22);
    await swipe(lk.x, lk.y, away.x, away.y + 46, 8);
    check('lit shells stay locked under a finger drag', (await st()).run.placed.includes(12));
    await page.evaluate(() => { const a = window.__fuseworks; a.selHand = -1; a.selCell = -1; a.renderShow(); });

    // ---------------------------------------------------------- sheets by touch
    await shot('4b-before-crate');
    await tapEl('#btn-crate');
    check('crate sheet opens by touch and fits the screen', await page.evaluate(() => { const r = document.querySelector('.sheet')?.getBoundingClientRect(); return !!r && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }));
    await tapEl('.sheet .btn.primary');
    await tapEl('#btn-menu');
    bad = await auditTargets('#modal');
    check('pause menu: every button on-screen and thumb-sized', bad.length === 0, bad.join('; '));
    await tapEl('#modal .btn.wide:nth-of-type(3)'); // Settings
    await page.waitForSelector('[data-setting="music"]');
    const sheet = await page.evaluate(() => { const el = document.querySelector('.sheet'); const r = el.getBoundingClientRect(); return { fits: r.top >= 0 && r.bottom <= innerHeight, overflow: el.scrollHeight - el.clientHeight, x: r.left + r.width / 2, top: r.top, bottom: r.bottom }; });
    check('settings sheet stays inside the screen', sheet.fits, JSON.stringify(sheet));
    if (sheet.overflow > 8) {
      await swipe(sheet.x, sheet.bottom - 60, sheet.x, sheet.top + 40, 10);
      const top = await page.evaluate(() => document.querySelector('.sheet').scrollTop);
      check('a long settings sheet scrolls with a finger swipe', top > Math.min(20, sheet.overflow - 2), `scrollTop=${top} overflow=${sheet.overflow}`);
      await page.evaluate(() => { document.querySelector('.sheet').scrollTop = 0; });
    }
    await tapEl('[data-setting="haptics"]');
    check('a settings switch toggles by touch', await page.evaluate(() => window.__fuseworks.meta.settings.haptics === false));
    await tapEl('[data-setting="haptics"]');
    await page.evaluate(() => { document.querySelector('#btn-settings-done').scrollIntoView(); });
    await shot('5-settings');
    await tapEl('#btn-settings-done');
    await tapEl('#modal .btn.primary'); // Resume

    // ---------------------------------------------------------- clear the show, market by touch
    await fast();
    await page.evaluate(() => { const a = window.__fuseworks; a.run.show.target = 1; a.renderShow(); });
    await tapCell(12);
    await tapEl('#btn-light');
    await page.waitForTimeout(60);
    await idle();
    await page.waitForSelector('#btn-next');
    bad = await auditTargets('#modal');
    check('results sheet: buttons on-screen and thumb-sized', bad.length === 0, bad.join('; '));
    await tapEl('#btn-next');
    await page.waitForSelector('#market');
    await page.evaluate(() => { const a = window.__fuseworks; a.run.coins = 40; a.goMarket(); document.querySelector('#toast').replaceChildren(); });
    await page.waitForTimeout(200);
    await shot('6-market');
    bad = await auditTargets('#market');
    check('market: every button thumb-sized', bad.length === 0, bad.join('; '));
    check('market: no sideways scroll', await noSideScroll());
    check('market: offer text is not clipped sideways', await page.evaluate(() => [...document.querySelectorAll('#market .offer')].every((o) => o.scrollWidth <= o.clientWidth + 1)));
    const body = await page.evaluate(() => { const el = document.querySelector('#market .panel-body'); const r = el.getBoundingClientRect(); return { overflow: el.scrollHeight - el.clientHeight, x: r.left + r.width / 2, top: r.top, bottom: r.bottom }; });
    check('"Next show" stays pinned and reachable', await page.evaluate(() => { const r = document.querySelector('#btn-next-show').getBoundingClientRect(); return r.bottom <= innerHeight && r.top > 0; }));
    if (body.overflow > 8) {
      const coins0 = (await st()).run.coins;
      await swipe(body.x, body.bottom - 30, body.x, body.top + 30, 12);
      const scrolled = await page.evaluate(() => document.querySelector('#market .panel-body').scrollTop);
      check('market list scrolls with a finger swipe', scrolled > 30, `scrollTop=${scrolled} overflow=${body.overflow}`);
      check('swiping the list does not buy anything by accident', (await st()).run.coins === coins0 && (await page.locator('.sheet').count()) === 0);
      const reach = await page.evaluate(() => { const el = document.querySelector('#market .panel-body'); el.scrollTop = el.scrollHeight; const r = document.querySelector('#btn-reroll').getBoundingClientRect(), b = el.getBoundingClientRect(); return r.bottom <= b.bottom + 1; });
      check('the last market item can be scrolled fully into view', reach);
      await page.evaluate(() => { document.querySelector('#market .panel-body').scrollTop = 0; });
      await page.waitForTimeout(80);
    } else console.log('      (market fits without scrolling on this screen)');
    await tapEl('[data-offer="charm0"]');
    s = await st();
    check('tapping an offer buys the charm', s.run.charms === 1 && s.run.coins < 40);
    await tapEl('[data-offer="pack0"]');
    await page.waitForSelector('[data-pick="1"]');
    check('pack picker fits the screen', await page.evaluate(() => { const r = document.querySelector('.sheet').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && [...document.querySelectorAll('.pick3 button')].every((b) => b.getBoundingClientRect().right <= innerWidth); }));
    await tapEl('[data-pick="1"]');
    await tapEl('.chips .charm');
    await page.waitForSelector('#btn-sell');
    await tapEl('.sheet .btn.primary');
    await tapEl('#btn-next-show');
    await page.waitForSelector('#btn-light');
    s = await st();
    check('next show starts; charm shows in the HUD', s.screen === 'show' && (await page.locator('#hud .charm:not(.empty)').count()) === 1);

    // ---------------------------------------------------------- other screens fit
    await tapEl('#btn-menu');
    await tapEl('#btn-home');
    await page.waitForSelector('#btn-continue');
    await page.waitForTimeout(700);
    bad = await auditTargets('.title');
    check('title with Continue: every button on-screen and thumb-sized', bad.length === 0, bad.join('; '));
    await shot('7-title-continue');
    for (const [btn, label] of [['#btn-workshop', 'workshop'], ['#btn-collection', 'records']]) {
      await tapEl(btn);
      await page.waitForSelector('#btn-back');
      bad = await auditTargets('.panel');
      check(`${label}: buttons thumb-sized, no sideways scroll`, bad.length === 0 && (await noSideScroll()), bad.join('; '));
      const sc = await page.evaluate(() => { const el = document.querySelector('.panel-body'); const r = el.getBoundingClientRect(); return { overflow: el.scrollHeight - el.clientHeight, x: r.left + r.width / 2, top: r.top, bottom: r.bottom }; });
      if (sc.overflow > 8) { await swipe(sc.x, sc.bottom - 30, sc.x, sc.top + 30, 12); check(`${label}: list scrolls with a finger swipe`, await page.evaluate(() => document.querySelector('.panel-body').scrollTop > 30)); }
      await tapEl('#btn-back');
      await page.waitForSelector('#btn-new');
    }
    await tapEl('#btn-daily');
    await page.waitForSelector('#btn-daily-play');
    check('daily sheet fits the screen', await page.evaluate(() => { const r = document.querySelector('.sheet').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
    await tapEl('.sheet .btn.ghost');

    // ---------------------------------------------------------- frame rate on a slowed-down CPU
    await tapEl('#btn-continue');
    await page.waitForSelector('#btn-light');
    await page.evaluate(() => {
      const a = window.__fuseworks, show = a.run.show;
      a.testSpeed = 1; show.target = 1e12; show.matchesLeft = 3;
      let id = 9000;
      show.cells.forEach((c, i) => { c.blocked = false; c.star = null; if (i < 20) { c.shell = { id: id++, type: ['ring', 'chrys', 'brocade', 'willow', 'peony'][i % 5], color: i % 4 }; c.locked = true; } });
      a.selHand = -1; a.selCell = -1; a.renderShow();
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await tapCell(7);
    const perf = page.evaluate(() => new Promise((res) => {
      const a = window.__fuseworks; let frames = 0, slow = 0, worst = 0, last = performance.now(), peak = 0; const t0 = last;
      const tick = (t) => { const d = t - last; frames++; if (d > 34) slow++; worst = Math.max(worst, d); last = t; peak = Math.max(peak, a.stage.parts.length);
        if (a.animating || t - t0 < 600) requestAnimationFrame(tick); else res({ fps: Math.round((frames * 1000) / (t - t0)), slowFrames: slow, frames, worst: Math.round(worst), peak, quality: a.stage.quality }); };
      requestAnimationFrame(tick);
    }));
    await tapEl('#btn-light');
    await page.waitForTimeout(1600);
    await shot('8-big-chain-throttled');
    const p = await perf;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`      20-burst chain, CPU slowed 4x: ${p.fps} fps average, worst frame ${p.worst} ms, ${p.slowFrames}/${p.frames} frames under 30 fps, peak ${p.peak} particles, quality ${p.quality}`);
    check('20-burst chain holds 30 fps or better on a 4x-slowed CPU', p.fps >= 30, JSON.stringify(p));

    check('no page errors or console errors', errors.length === 0, errors.join(' | '));
    check('all input in this session was touch', await page.evaluate(() => window.__ptr.mouse === 0 && window.__ptr.touch > 20));
    summary.push({ name, size: `${dev.viewport.width}x${dev.viewport.height}`, cell: geo.cell, fps: p.fps, worst: p.worst });
  } catch (e) {
    failures.push(`${name}: exception ${e.message.split('\n')[0]}`);
    console.log(`FAIL  exception: ${e.stack.split('\n').slice(0, 4).join('\n')}`);
    await shot('zz-exception').catch(() => {});
    if (errors.length) console.log(errors.join('\n'));
  }
  await browser.close();
}

const only = process.argv[2];
for (const name of PROFILES) if (!only || name === only) await runProfile(name);
server.close();
console.log('\nDevice        Screen     Sky cell   Chain fps (CPU 4x slower)');
for (const r of summary) console.log(`${r.name.padEnd(13)} ${r.size.padEnd(10)} ${String(r.cell + 'px').padEnd(10)} ${r.fps} fps, worst frame ${r.worst} ms`);
console.log(`\n${total - failures.length} of ${total} touch checks passed`);
if (failures.length) { console.log(failures.map((f) => ` - ${f}`).join('\n')); process.exit(1); }
