// Generates every piece of original artwork the Android app and store listing need, procedurally:
//   Android launcher icons (legacy + adaptive), splash icon, Play Store icon (512), feature graphic (1024x500).
//   node tools/gen-assets.mjs
// Nothing is downloaded and no third-party art is used.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const RES = resolve('android/app/src/main/res');
const STORE = resolve('store');
mkdirSync(STORE, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

/** Runs in the browser: draws on a canvas and returns a PNG data URL. */
const render = (w, h, kind, text) => page.evaluate(([w, h, kind, text]) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const COL = ['#ff4d6d', '#ffc94d', '#4de3a1', '#4db8ff'];
  const TAU = Math.PI * 2;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  const sky = () => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#050816'); g.addColorStop(1, '#1b2a66');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const glow = x.createRadialGradient(w / 2, h, 0, w / 2, h, Math.max(w, h) * 0.8);
    glow.addColorStop(0, 'rgba(59,91,219,0.55)'); glow.addColorStop(1, 'rgba(59,91,219,0)');
    x.fillStyle = glow; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff';
    for (let i = 0; i < (w * h) / 9000; i++) { x.globalAlpha = 0.2 + rnd() * 0.6; x.fillRect(rnd() * w, rnd() * h, Math.max(1, w / 500), Math.max(1, w / 500)); }
    x.globalAlpha = 1;
  };
  const dot = (px, py, r, col, a = 1) => {
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, '#fff'); g.addColorStop(0.22, col); g.addColorStop(1, col + '00');
    x.globalAlpha = a; x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); x.globalAlpha = 1;
  };
  /** A stylised burst: rays of glowing beads in alternating colours around a white-hot core. */
  const burst = (cx, cy, R, rays = 16, cols = COL, rot = 0) => {
    x.globalCompositeOperation = 'lighter';
    dot(cx, cy, R * 0.75, cols[0], 0.35);
    for (let i = 0; i < rays; i++) {
      const a = rot + (i / rays) * TAU, col = cols[i % cols.length], long = i % 2 === 0;
      const steps = long ? 6 : 4;
      for (let k = 1; k <= steps; k++) {
        const d = R * (0.2 + (k / steps) * (long ? 0.8 : 0.58));
        dot(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.05 + (k / steps) * 0.075), col, 0.95);
      }
      x.strokeStyle = col; x.globalAlpha = 0.5; x.lineWidth = R * 0.022; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx + Math.cos(a) * R * 0.16, cy + Math.sin(a) * R * 0.16); x.lineTo(cx + Math.cos(a) * R * (long ? 0.95 : 0.7), cy + Math.sin(a) * R * (long ? 0.95 : 0.7)); x.stroke();
      x.globalAlpha = 1;
    }
    dot(cx, cy, R * 0.3, '#ffd98a', 1);
    dot(cx, cy, R * 0.16, '#ffffff', 1);
    x.globalCompositeOperation = 'source-over';
  };

  if (kind === 'icon') { sky(); burst(w / 2, h / 2, w * 0.4); }
  if (kind === 'round') {
    x.save(); x.beginPath(); x.arc(w / 2, h / 2, w / 2, 0, TAU); x.clip(); sky(); burst(w / 2, h / 2, w * 0.38); x.restore();
  }
  if (kind === 'foreground') burst(w / 2, h / 2, w * 0.27); // inside the adaptive-icon safe zone, transparent background
  if (kind === 'splash') burst(w / 2, h / 2, w * 0.3);
  if (kind === 'feature') {
    sky();
    burst(w * 0.09, h * 0.24, h * 0.25, 14, [COL[3], '#ffffff'], 0.2);
    burst(w * 0.91, h * 0.22, h * 0.27, 16, [COL[0], COL[1]], 0.1);
    burst(w * 0.9, h * 0.8, h * 0.17, 12, [COL[2], '#ffffff'], 0.4);
    burst(w * 0.1, h * 0.8, h * 0.15, 12, [COL[1], COL[0]], 0);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `900 ${Math.round(h * 0.27)}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;
    x.shadowColor = 'rgba(255,120,80,0.8)'; x.shadowBlur = h * 0.09;
    const g = x.createLinearGradient(0, h * 0.3, 0, h * 0.62);
    g.addColorStop(0, '#fff3cf'); g.addColorStop(0.5, '#ffb84d'); g.addColorStop(1, '#ff4d6d');
    x.fillStyle = g; x.fillText(text, w / 2, h * 0.45);
    x.shadowBlur = 0;
    x.font = `600 ${Math.round(h * 0.075)}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;
    x.fillStyle = '#dfe5ff'; x.fillText('Build the sky. Light one fuse.', w / 2, h * 0.68);
  }
  return c.toDataURL('image/png');
}, [w, h, kind, text]);

const save = async (path, w, h, kind, text = '') => {
  const url = await render(w, h, kind, text);
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${kind.padEnd(10)} ${w}x${h}  ${path.replace(process.cwd() + '/', '')}`);
};

const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENS)) {
  await save(`${RES}/mipmap-${d}/ic_launcher.png`, 48 * k, 48 * k, 'icon');
  await save(`${RES}/mipmap-${d}/ic_launcher_round.png`, 48 * k, 48 * k, 'round');
  await save(`${RES}/mipmap-${d}/ic_launcher_foreground.png`, 108 * k, 108 * k, 'foreground');
}
await save(`${RES}/drawable/splash_icon.png`, 432, 432, 'splash');
await save(`${STORE}/icon-512.png`, 512, 512, 'icon');
await save(`${STORE}/feature-graphic-1024x500.png`, 1024, 500, 'feature', 'Fuseworks');
await browser.close();
