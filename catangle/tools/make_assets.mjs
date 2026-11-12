// Renders launcher icons and Play Store graphics from the game's own drawing code.
// Run from games/catangle:  python3 -m http.server 8766 &  then  NODE_PATH=$(npm root -g) node tools/make_assets.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch();
const p = await b.newPage({ deviceScaleFactor: 1 });
async function shot(query, file, w, h, transparent) {
  await p.setViewportSize({ width: w, height: h });
  await p.goto(`http://localhost:8766/tools/assets.html?${query}`);
  await p.waitForFunction(() => document.title === 'ready');
  fs.mkdirSync(file.replace(/\/[^/]+$/, ''), { recursive: true });
  await p.locator('canvas').screenshot({ path: file, omitBackground: !!transparent });
}
const res = 'android/app/src/main/res';
for (const [d, k] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
  await shot(`kind=fg&size=${108 * k}`, `${res}/mipmap-${d}/ic_launcher_foreground.png`, 108 * k, 108 * k, true);
  await shot(`kind=icon&size=${48 * k}`, `${res}/mipmap-${d}/ic_launcher.png`, 48 * k, 48 * k);
  await shot(`kind=icon&round=1&size=${48 * k}`, `${res}/mipmap-${d}/ic_launcher_round.png`, 48 * k, 48 * k, true);
}
await shot('kind=icon&size=512', 'docs/store/icon-512.png', 512, 512);
await shot('kind=feature', 'docs/store/feature-graphic-1024x500.png', 1024, 500);
await b.close();
console.log('assets written');
