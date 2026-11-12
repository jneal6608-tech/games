// Records 9:16 marketing clips from the game's clip mode (silent; add music/voice in your editor).
// Run from games/catangle:  python3 -m http.server 8765 --directory web &  then  NODE_PATH=$(npm root -g) node tools/make_clips.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const CLIPS = [
  { name: 'clip-01-only-geniuses', q: 'clip=38&fails=1&caption=' + encodeURIComponent('Which cat moves first? 99% bonk it') },
  { name: 'clip-02-satisfying', q: 'clip=90&caption=' + encodeURIComponent('POV: you finally untangle the cats') },
  { name: 'clip-03-grumpy', q: 'clip=70&caption=' + encodeURIComponent('Free the grumpy one before it hits 0') },
];
const out = 'marketing/clips'; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
for (const c of CLIPS) {
  const dir = `${out}/.tmp-${c.name}`;
  const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, recordVideo: { dir, size: { width: 540, height: 960 } } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { localStorage.setItem('catangle.save.v1', JSON.stringify({ v: 1, level: 1, coats: ['ginger', 'cloud', 'smoke', 'midnight', 'mint', 'berry', 'tabby', 'sky'], settings: { sound: false, haptics: false }, seen: { sleepy: 1, grumpy: 1 } })); });
  await p.goto(`http://localhost:8765/index.html?${c.q}`);
  await p.waitForSelector('.endcard', { timeout: 90000 });
  await p.waitForTimeout(1800);
  await ctx.close();
  const webm = `${dir}/${fs.readdirSync(dir)[0]}`;
  try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-vf', 'fps=30,scale=1080:1920:flags=lanczos', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/${c.name}.mp4`]); }
  catch (e) { fs.copyFileSync(webm, `${out}/${c.name}.webm`); }
  fs.rmSync(dir, { recursive: true });
  console.log('recorded', c.name);
}
await b.close();
