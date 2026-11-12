// Captures real in-game screenshots for the Play Store listing at 1080x1920.
//   npm run build && node tools/screenshots.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = resolve('dist'), OUT = resolve('store/screenshots');
mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try { const p = new URL(req.url, 'http://x').pathname; const f = join(ROOT, p === '/' ? 'index.html' : p); res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' }); res.end(await readFile(f)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForSelector('#btn-new');
const shot = async (name) => { await page.screenshot({ path: join(OUT, `${name}.png`) }); console.log(`store/screenshots/${name}.png`); };
const center = (i) => page.evaluate((i) => window.__fuseworks.stage.cellCenter(i), i);

// a mid-festival run with a rich display, set up through the game's own state
await page.evaluate(() => {
  const a = window.__fuseworks;
  a.meta.tutorialDone = true; a.meta.tickets = 64;
  a.meta.shells.push('palm', 'chrys', 'salute', 'glitter', 'strobe');
  a.meta.charms.push('choir', 'echo', 'longfuse', 'stargazer');
  a.newFestival();
});
await page.waitForSelector('#btn-light');
await page.evaluate(() => {
  const a = window.__fuseworks, run = a.run, show = run.show;
  run.night = 3; run.showIdx = 1; run.coins = 14;
  run.charms = ['finale', 'choir', 'metronome', 'flag0'].map((id) => ({ id, counter: 0 }));
  show.target = 4500; show.score = 1840; show.matchesLeft = 2; show.ignitions = 1;
  show.cells.forEach((c) => { c.shell = null; c.star = null; c.blocked = false; c.locked = false; });
  let id = 5000;
  const put = (c, r, type, color, locked = true) => { const cell = show.cells[r * 5 + c]; cell.shell = { id: id++, type, color }; cell.locked = locked; };
  put(2, 2, 'ring', 0); put(1, 1, 'peony', 0); put(3, 1, 'crossette', 1); put(1, 3, 'peony', 3); put(3, 3, 'peony', 0);
  put(2, 1, 'comet', 0); put(2, 3, 'willow', 2); put(1, 2, 'wave', 3); put(3, 2, 'brocade', 1);
  put(0, 1, 'peony', 0, false); put(4, 1, 'chrys', 2, false); put(2, 4, 'peony', 2, false); put(1, 4, 'brocade', 3, false); put(3, 4, 'crossette', 0, false);
  put(0, 3, 'palm', 3, false); put(4, 3, 'peony', 1, false); put(2, 0, 'salute', 0, false);
  show.cells[2 * 5 + 2].star = 'twin'; show.cells[0 * 5 + 2].star = 'bright'; show.cells[4 * 5 + 4].star = 'awe'; show.cells[5 * 5 + 0].blocked = true;
  a.shownScore = show.score;
  a.renderShow();
});
const c = await center(12);
await page.mouse.click(c.x, c.y);
await page.waitForTimeout(300);
await shot('2-plan-the-chain');
await page.click('#btn-light');
await page.waitForTimeout(2300);
await shot('1-light-one-fuse');
await page.waitForTimeout(1500);
await shot('3-chain-reaction');
await page.evaluate(() => { window.__fuseworks.testSpeed = 30; });
await page.waitForFunction(() => !window.__fuseworks.animating, null, { timeout: 60000 });
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('#toast').replaceChildren());
if (await page.locator('#btn-next').count()) { await shot('4-show-cleared'); await page.click('#btn-next'); }
await page.waitForSelector('#market');
await page.evaluate(() => { const a = window.__fuseworks; a.run.coins = 17; a.goMarket(); });
await page.waitForTimeout(600);
await page.evaluate(() => document.querySelector('#toast').replaceChildren()); // achievement toasts would cover the offers
await shot('5-market-charms');
await page.evaluate(() => { const a = window.__fuseworks; a.save(); a.goTitle(); });
await page.waitForTimeout(1600);
await shot('6-title');
await page.click('#btn-workshop');
await page.waitForTimeout(500);
await shot('7-workshop-unlocks');
await browser.close();
server.close();
