// Store screenshots (1080x1920) from the real game. Run: python3 -m http.server 8765 --directory web &  then
//   NODE_PATH=$(npm root -g) node tools/store_shots.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = new URL('../docs/store/screenshots/', import.meta.url).pathname;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const G = (fn, a) => p.evaluate(fn, a);
await p.goto('http://localhost:8765/index.html?fastads=1'); await p.waitForTimeout(600);
await G(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1500);
await G(() => window.__catangle.setSave({ level: 34, fish: 1840, seen: { sleepy: 1, grumpy: 1 }, coats: ['ginger', 'cloud', 'smoke', 'midnight', 'tabby', 'tuxedo', 'mint', 'berry'] }));
await p.waitForTimeout(2500); await p.screenshot({ path: OUT + '1-home.png' });
await p.click('#btn-play', { force: true }); await p.waitForTimeout(1200); await p.screenshot({ path: OUT + '2-board.png' });
await G(() => window.__catangle.setSave({ level: 1 })); await p.click('#btn-home', { force: true }); await p.click('#btn-play', { force: true }); await p.waitForTimeout(900);
await p.screenshot({ path: OUT + '3-tutorial.png' });
await G(() => window.__catangle.setSave({ level: 60, theme: 'night', themes: ['cozy', 'night'] })); await p.click('#btn-home', { force: true }); await p.click('#btn-play', { force: true }); await p.waitForTimeout(1200);
await p.screenshot({ path: OUT + '4-night-room.png' });
await G(() => window.__catangle.setSave({ theme: 'cozy' })); await p.click('#btn-home', { force: true }); await p.waitForTimeout(300);
await p.click('#btn-cats', { force: true }); await p.waitForTimeout(800); await p.screenshot({ path: OUT + '5-collection.png' });
await b.close(); console.log('screenshots in', OUT);
