// Turns the single-file web build into a page fragment for publishing as a browser-playable preview.
//   npm run build:single && node tools/make-preview.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-single/index.html', 'utf8');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();
if (!styles || !scripts.length) throw new Error('single-file build did not inline its assets');
const out = `<title>Fuseworks</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${styles}</style>
${body}
${scripts.map((s) => `<script type="module">${s.replace(/<\/script/g, '<\\/script')}</script>`).join('\n')}
`;
writeFileSync('dist-single/fuseworks-preview.html', out);
console.log(`dist-single/fuseworks-preview.html ${(out.length / 1024).toFixed(0)} kB`);
