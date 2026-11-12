// Bundles the game into android/app/src/main/assets/www (and dist/ for browser testing).
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const out of [join(root, 'dist'), join(root, 'android/app/src/main/assets/www')]) {
  rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
  await build({ entryPoints: [join(root, 'web/src/main.js')], bundle: true, minify: true, format: 'iife', target: ['chrome80'], outfile: join(out, 'game.js'), logLevel: 'warning' });
  for (const f of ['index.html', 'style.css', 'privacy.html']) cpSync(join(root, 'web', f), join(out, f));
}
console.log('web bundle built');
