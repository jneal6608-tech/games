// Fills docs/master-prompt.template.md with tables generated from the real game data, producing
// docs/MASTER_PROMPT.md. Run after any balance or content change so the prompt never drifts from the game.
//   npx tsx tools/gen-docs.ts
import { readFileSync, writeFileSync } from 'node:fs';
import * as D from '../src/engine/data';
import { ACHIEVEMENTS } from '../src/engine/meta';
import { DAILY_COINS, DAILY_MEDALS, DAILY_NIGHT, MIN_CRATE } from '../src/engine/run';

const table = (head: string[], rows: Array<Array<string | number>>) =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const pat = (p: ReadonlyArray<readonly [number, number]>) => (p.length ? p.map(([c, r]) => `(${c},${r})`).join(' ') : 'none');

const fills: Record<string, string> = {
  SHELL_TABLE: table(['id', 'Name', 'Sparkle', 'Burst pattern as (dCol,dRow) offsets; negative row = up', 'Unlock cost (tickets)', 'Pack weight', 'Player-facing description'],
    D.SHELL_TYPES.map((t) => { const s = D.SHELLS[t]; return [t, s.name, t === 'kamuro' ? '4 x chain place' : s.sparkle, pat(s.pattern), s.unlock || 'start', s.weight, s.desc]; })),
  CHARM_TABLE: table(['id', 'Name', 'Effect', 'Market cost (coins)', 'Unlock cost (tickets)', 'Icon glyph', 'Hue'],
    D.CHARMS.map((c) => [c.id, c.name, c.desc, c.cost, c.unlock || 'start', c.icon, c.hue])),
  WEATHER_TABLE: table(['id', 'Name', 'Effect'], D.WEATHER.map((w) => [w.id, w.name, w.desc])),
  CRATE_TABLE: table(['id', 'Name', 'Unlock (tickets)', 'Contents'], D.CRATES.map((c) => {
    const counts = new Map<string, number>();
    for (const [t, col] of c.build()) { const k = `${D.COLOR_NAMES[col]} ${D.SHELLS[t].name}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
    return [c.id, c.name, c.unlock || 'start', [...counts].map(([k, n]) => `${n}x ${k}`).join(', ')];
  })),
  STAKE_TABLE: table(['Level', 'Name', 'Target multiplier', 'Restocks', 'Charm cost', 'Start coins', 'Ticket multiplier'],
    D.STAKES.map((s) => [s.level, s.name, `x${s.targetMult}`, s.restocks || '0', s.charmCost ? `+${s.charmCost}` : '0', s.startCoins || '0', `x${s.ticketMult}`])),
  SKY_TABLE: table(['id', 'Name', 'Unlock', 'Top colour', 'Bottom colour', 'Horizon glow', 'Silhouette'],
    D.SKIES.map((s) => [s.id, s.name, s.premium ? 'Premium only' : s.unlock || 'start', s.top, s.bottom, s.glow,
      { harbor: 'low buildings with lit windows', lake: 'mountain peaks', city: 'tall skyline with lit windows', dunes: 'rolling dunes', aurora: 'mountain peaks under green aurora ribbons' }[s.id] ?? ''])),
  TARGET_TABLE: table(['Night', 'Venue', 'Opening', 'Feature', 'Finale'],
    Array.from({ length: D.NIGHTS }, (_, i) => [i + 1, D.NIGHT_NAMES[i], ...[0, 1, 2].map((s) => D.targetFor(i + 1, s, 1).toLocaleString('en-US'))])),
  ACHIEVEMENT_TABLE: table(['id', 'Name', 'Condition', 'Tickets'], ACHIEVEMENTS.map((a) => [a.id, a.name, a.desc, a.tickets])),
  COLOR_TABLE: table(['Index', 'Name', 'Hex', 'Token outline shape'], D.COLOR_NAMES.map((n, i) => [i, n, D.COLOR_HEX[i], D.COLOR_SHAPES[i]])),
  CONSTANTS: [
    `- Sky grid: ${D.COLS} columns x ${D.ROWS} rows (${D.CELLS} cells), row 0 at the top.`,
    `- Per show: hand size ${D.BASE_HAND}, ${D.BASE_MATCHES} Matches, ${D.BASE_RESTOCKS} Restocks. Maximum ${D.MAX_CHARMS} charms held.`,
    `- Run: ${D.NIGHTS} nights x ${D.SHOWS_PER_NIGHT} shows (${D.SHOW_NAMES.join(', ')}).`,
    `- Applause target = night base x show multiplier x stake multiplier, rounded to 2 significant figures. Night bases: ${D.NIGHT_BASE.join(', ')}. Show multipliers: ${D.SHOW_MULT.join(', ')}. Endless nights multiply the last base by ${D.ENDLESS_GROWTH} per night.`,
    `- Star cells: Bright Star +${D.STAR_BRIGHT} Sparkle, Awe Star +${D.STAR_AWE} Awe, Twin Star = the shell bursts one extra time. 3 stars per show, 4 from night 4. Placement weights bright 45 / awe 35 / twin 20.`,
    `- Blocked cloud cells: 0 on night 1, 1 from night 2, 2 from night 4, 3 from night 6.`,
    `- Refining a shell type: +${D.LEVEL_SPARKLE} Sparkle per level (Kamuro: +${D.KAMURO_LEVEL_PER_PLACE} per chain place per level).`,
    `- Coins: start with ${D.START_COINS}. Clearing a show pays ${D.SHOW_COINS.join(' / ')} (Opening / Feature / Finale) plus ${D.COINS_PER_UNUSED_MATCH} per unused Match.`,
    `- Market: ${D.SHOP_CHARMS} charm offers, ${D.SHOP_PACKS} shell packs at ${D.PACK_COST} coins (open ${D.PACK_SIZE}, keep 1), one Refine offer at ${D.UPGRADE_BASE_COST} + 2 per existing level, Trim at ${D.TRIM_COST} (+1 per use in that visit, crate minimum ${MIN_CRATE}), Reroll at ${D.REROLL_BASE_COST} (+1 per reroll in that visit). Charms sell for half their cost, rounded down.`,
    `- Tickets: ${D.TICKETS_PER_SHOW} per show cleared, ${D.TICKETS_PER_NIGHT} per night completed, ${D.TICKETS_WIN} for winning the festival, all times the stake's ticket multiplier.`,
    `- Daily Show: night-${DAILY_NIGHT} targets, starts with ${DAILY_COINS} coins and 2 preset charms, medals at ${DAILY_MEDALS.map((n) => n.toLocaleString('en-US')).join(' / ')} total applause. Pays 6 tickets for the first play of the day plus 4 per medal tier.`,
  ].join('\n'),
};

let out = readFileSync('docs/master-prompt.template.md', 'utf8');
for (const [k, v] of Object.entries(fills)) {
  if (!out.includes(`{{${k}}}`)) throw new Error(`template is missing {{${k}}}`);
  out = out.split(`{{${k}}}`).join(v);
}
const left = out.match(/\{\{[A-Z_]+\}\}/g);
if (left) throw new Error(`unfilled placeholders: ${left.join(', ')}`);
writeFileSync('docs/MASTER_PROMPT.md', out);
console.log(`docs/MASTER_PROMPT.md written (${out.split(/\s+/).length} words)`);
