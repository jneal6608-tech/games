// Save-integrity and store-gating checks against the built game. Run: npm run build && node e2e/integrity.mjs
import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = new URL('../dist', import.meta.url).pathname; const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = createServer(async (q, s) => { try { const p = new URL(q.url, 'http://x').pathname; const f = join(ROOT, p === '/' ? 'index.html' : p); s.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); s.end(await readFile(f)); } catch { s.writeHead(404); s.end(); } });
await new Promise(r => srv.listen(0, '0.0.0.0', r)); const port = srv.address().port;
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
// 1. backup recovery: seed storage before the app boots
const ctx1 = await b.newContext({ viewport: { width: 412, height: 915 } }); const p1 = await ctx1.newPage();
await p1.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('fuseworks.meta.v1.bak', JSON.stringify({ v: 1, tickets: 321, tutorialDone: true })); localStorage.setItem('fuseworks.meta.v1', '{"v":1,"tick'); } });
await p1.goto(`http://localhost:${port}/`); await p1.waitForTimeout(1000);
const t = await p1.evaluate(() => document.body.innerText.includes('321'));
if (!t) process.exitCode = 1; console.log(t ? 'PASS' : 'FAIL', 'progress recovered from backup after a corrupt main save');
// 2. non-local host: store unavailable
const p2 = await b.newPage(); await p2.goto(`http://127.0.0.2:${port}/`); await p2.waitForTimeout(800);
const r = await p2.evaluate(async () => { const btn = [...document.querySelectorAll('button')].find(x => /Premium/.test(x.textContent)); btn?.click(); await new Promise(r => setTimeout(r, 400)); const buy = [...document.querySelectorAll('button')].find(x => /\$|Buy|Unlock/.test(x.textContent) && x !== btn); buy?.click(); await new Promise(r => setTimeout(r, 600)); return { sim: document.body.innerText.includes('Simulate successful purchase'), txt: document.body.innerText.includes('available in the Android app') }; });
if (r.sim || !r.txt) process.exitCode = 1; console.log(!r.sim && r.txt ? 'PASS' : 'FAIL', 'public web host cannot simulate purchases', JSON.stringify(r));
await b.close(); srv.close();
