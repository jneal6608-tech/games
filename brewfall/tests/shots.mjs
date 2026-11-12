// Quick visual smoke run: plays a little and saves screenshots. usage: node tests/shots.mjs <outdir>
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const out = process.argv[2] || 'store/raw'; const URL = process.env.URL || 'http://localhost:8377/index.html?dev=1';
const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL); await page.waitForTimeout(900);
const shot = n => page.screenshot({ path: `${out}/${n}.png` });
const tap = async sel => { await page.locator(sel).first().click(); await page.waitForTimeout(350); };
if (await page.locator('.ov [data-k=c]').count()) await tap('.ov [data-k=c]');
await shot('01-home');
await tap('[data-act=setup]'); await shot('02-setup'); await tap('[data-act=start]'); await page.waitForTimeout(500); await shot('03-game-start');
const cv = page.locator('#cv');
const drop = async fx => { const bb = await cv.boundingBox(); await page.mouse.move(bb.x + bb.width * fx, bb.y + 60); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(650); };
for (let i = 0; i < 40; i++) { if (await page.locator('.ov').count()) break; await drop(0.15 + 0.7 * ((i * 0.37) % 1)); if (i === 6) await shot('04-game-mid'); }
await page.waitForTimeout(1500); await shot('05-after-round');
if (await page.locator('.ov [data-k=go]').count()) { await tap('.ov [data-k=go]'); await shot('06-shop'); }
console.log('errors:', errs.length ? errs : 'none'); await b.close();
