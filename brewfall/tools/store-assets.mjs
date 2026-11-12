// Renders the Play Store icon, feature graphic and phone screenshots from the real game. Needs dist/ on :8377.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const URL = 'http://localhost:8377/index.html?dev=1', out = 'store';
const b = await chromium.launch();
// --- screenshots (1080x1920) ---
const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }); const page = await ctx.newPage();
await page.goto(URL); await page.evaluate(() => localStorage.clear()); await page.goto(URL); await page.waitForTimeout(700);
const tap = async (s, ms = 350) => { await page.locator(s).first().click(); await page.waitForTimeout(ms); };
const shot = n => page.screenshot({ path: `${out}/screenshots/${n}.png` });
const noHint = () => page.evaluate(() => { document.querySelectorAll('.hint,.toast').forEach(e => e.remove()); });
await tap('.ov [data-k=c]'); await page.evaluate(() => { const S = window.__bfBoot.S, p = S.profile.p; p.glints = 1840; p.moons = 35; p.tut = { start: 1, dropped: 1, merged: 1, shop: 1, hex: 1 }; p.orbSkins.push('candy'); p.cauldrons.push('forest', 'tide'); S.save(true); });
await page.goto(URL); await page.waitForTimeout(600); await noHint(); await shot('1-home');
await tap('[data-act=setup]'); await tap('[data-act=start]', 600);
await page.evaluate(() => { const { run, board } = window.__bf; run.order = 4; run.round = 2; run.hexOrder = Array(8).fill('fog'); run.sparks = 17; for (const id of ['ladle', 'whisk', 'sprout', 'grandeur']) run._addCharm(id); run.tonics = ['golden', 'stir']; run.startRound(); run.score = 1480; run.dropsLeft = 9;
  board.world.load([[8, 95, 410], [7, 250, 425], [6, 300, 300], [5, 170, 300], [5, 60, 280], [4, 240, 230], [3, 120, 215], [3, 320, 205], [2, 180, 200], [1, 280, 170], [2, 40, 190], [6, 150, 150]]); });
await tap('[data-act=pause]'); await tap('.ov [data-k=h]'); await tap('[data-act=continue]', 900);
await page.evaluate(() => { const { board } = window.__bf; board.aimX = 210; board.say(250, 300, '+2,400', '#ffe36b', 30); board.say(250, 268, 'Chain x4', '#ffb86b', 16); board.burst(250, 330, '#8f8cf5', 30); });
await page.waitForTimeout(120); await noHint(); await shot('2-brew');
await page.evaluate(() => { const { run } = window.__bf; run.score = run.target; }); await page.waitForTimeout(1500); await shot('3-win'); await tap('.ov [data-k=go]'); await noHint(); await shot('4-shop');
await tap('.tray [data-act=charmInfo]'); await shot('5-charm'); await tap('.ov [data-k=x]');
await page.evaluate(() => window.__bfBoot.act.home()); await page.waitForTimeout(300); await tap('[data-act=codex]'); await shot('6-codex');
await tap('[data-act=home]'); await tap('[data-act=store][data-tab=looks]'); await shot('7-looks');
await tap('[data-act=home]'); await tap('[data-act=missions]'); await shot('8-missions');
// --- icon (512) and feature graphic (1024x500), drawn with the game's own essence sprites ---
const art = await b.newPage({ viewport: { width: 1024, height: 512 } }); await art.goto(URL); await art.waitForTimeout(500);
const draw = (w, h, fn) => art.evaluate(async ({ w, h, fn }) => {
  document.body.innerHTML = `<canvas id="a" width="${w}" height="${h}" style="position:fixed;left:0;top:0;z-index:999"></canvas>`; const c = document.getElementById('a'), g = c.getContext('2d');
  const D = window.__bfBoot.D, skin = D.ORB_SKINS[0]; const R = [0, 14, 20, 27, 35, 45, 57, 71, 87, 105, 124];
  const orb = (t, x, y, r) => { const col = skin.colors[t - 1]; const gr = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r); gr.addColorStop(0, '#fff8'); gr.addColorStop(0, col); const sh = (k) => { const n = parseInt(col.slice(1), 16); let rr = n >> 16, gg = (n >> 8) & 255, bb = n & 255; const f = k < 0 ? 0 : 255, a = Math.abs(k); return `rgb(${Math.round(rr + (f - rr) * a)},${Math.round(gg + (f - gg) * a)},${Math.round(bb + (f - bb) * a)})`; };
    const g2 = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r); g2.addColorStop(0, sh(.55)); g2.addColorStop(.55, col); g2.addColorStop(1, sh(-.35)); g.fillStyle = g2; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.lineWidth = r * .06; g.strokeStyle = sh(-.55); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(x - r * .38, y - r * .48, r * .22, r * .12, -.6, 0, 7); g.fill();
    g.fillStyle = g.strokeStyle = sh(-.75); g.lineWidth = r * .07; g.lineCap = 'round'; g.beginPath(); g.arc(x - r * .3, y - r * .05, r * .09, 0, 7); g.arc(x + r * .3, y - r * .05, r * .09, 0, 7); g.fill(); g.beginPath(); g.arc(x, y + r * .14, r * .22, .15 * Math.PI, .85 * Math.PI); g.stroke();
    g.fillStyle = 'rgba(255,150,170,.45)'; g.beginPath(); g.arc(x - r * .5, y + r * .2, r * .1, 0, 7); g.arc(x + r * .5, y + r * .2, r * .1, 0, 7); g.fill(); };
  const bg = g.createRadialGradient(w / 2, h * .2, 10, w / 2, h / 2, Math.max(w, h) * .8); bg.addColorStop(0, '#5a3fb8'); bg.addColorStop(.6, '#2b1f5c'); bg.addColorStop(1, '#150f2b'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  new Function('g', 'orb', 'w', 'h', fn)(g, orb, w, h);
}, { w, h, fn });
await draw(512, 512, `orb(8,150,330,105);orb(6,372,348,92);orb(9,256,236,150);orb(1,400,120,34);orb(2,110,130,44);`);
await art.locator('#a').screenshot({ path: `${out}/icon-512.png` });
await draw(1024, 500, `orb(9,820,270,150);orb(7,660,360,92);orb(6,930,400,78);orb(4,700,170,52);orb(2,930,120,36);orb(1,600,250,26);orb(3,560,410,44);
 g.textAlign='left';g.font='900 128px system-ui,sans-serif';const t=g.createLinearGradient(0,130,0,290);t.addColorStop(0,'#fff3b0');t.addColorStop(.5,'#ffcf40');t.addColorStop(1,'#f2811d');g.fillStyle='rgba(0,0,0,.45)';g.fillText('Brewfall',56,266);g.fillStyle=t;g.fillText('Brewfall',50,258);
 g.font='800 34px system-ui,sans-serif';g.fillStyle='#d9d0ff';g.fillText('Merge. Brew. Break the recipe.',56,330);`);
await art.locator('#a').screenshot({ path: `${out}/feature-graphic-1024x500.png` });
await b.close(); console.log('store assets rendered');
