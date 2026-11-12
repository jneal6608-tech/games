// Balance report: plays many seeded runs with bots of different skill and prints how far each gets.
//   npm run sim            (default 60 runs per bot)
//   npm run sim -- 200     (more runs)
import { CHARMS, NIGHT_BASE, SHELLS, SHOW_MULT, targetFor } from '../src/engine/data';
import { Rng } from '../src/engine/rng';
import { newRun, dailyThresholds } from '../src/engine/run';
import { ALL_SHELLS, playRun } from './bot';

const N = Number(process.argv[2] ?? 60);
const starterShells = ALL_SHELLS.filter((t) => SHELLS[t].unlock === 0);
const starterCharms = CHARMS.filter((c) => c.unlock === 0).map((c) => c.id);
const allCharms = CHARMS.map((c) => c.id);

const bots = [
  { name: 'novice (4 tries, no shop)', samples: 4, shop: false, shells: starterShells, charms: starterCharms },
  { name: 'casual (12 tries, shops)', samples: 12, shop: true, shells: starterShells, charms: starterCharms },
  { name: 'skilled (60 tries, shops)', samples: 60, shop: true, shells: starterShells, charms: starterCharms },
  { name: 'expert (250 tries, all unlocks)', samples: 250, shop: true, shells: ALL_SHELLS, charms: allCharms },
];

console.log('Targets:', [1, 2, 3, 4, 5, 6].map((n) => [0, 1, 2].map((s) => targetFor(n, s, 1)).join('/')).join('  '));
console.log('NIGHT_BASE', NIGHT_BASE.join(','), 'SHOW_MULT', SHOW_MULT.join(','));
for (const b of bots) {
  const reached: number[] = [];
  const ratioByShow: number[][] = Array.from({ length: 18 }, () => []);
  let wins = 0;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const run = newRun({ seed: `SIM${i}`, poolShells: b.shells, poolCharms: b.charms });
    const log = playRun(run, { samples: b.samples, shop: b.shop, rng: new Rng(`bot${i}`) });
    reached.push(log.reached);
    if (log.won) wins++;
    log.ratios.forEach((r, k) => k < 18 && ratioByShow[k].push(r));
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const survive = Array.from({ length: 6 }, (_, n) => Math.round((100 * reached.filter((r) => r >= (n + 1) * 3).length) / N));
  console.log(`\n${b.name}: win ${Math.round((100 * wins) / N)}%  avg shows cleared ${avg(reached).toFixed(1)}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log('  % clearing night 1..6:', survive.join(' '));
  console.log('  avg score/target by show:', ratioByShow.map((r) => (r.length ? avg(r).toFixed(1) : '-')).join(' '));
}

// Daily Show medal calibration
const th = dailyThresholds();
for (const samples of [4, 12, 60]) {
  const totals: number[] = [];
  for (let i = 0; i < N; i++) {
    const run = newRun({ seed: `DAILY${i}`, mode: 'daily', poolShells: starterShells, poolCharms: starterCharms });
    const log = playRun(run, { samples, shop: true, rng: new Rng(`dbot${i}`) });
    totals.push(log.run.stats.totalApplause);
  }
  totals.sort((a, b) => a - b);
  const medal = (t: number) => Math.round((100 * totals.filter((x) => x >= t).length) / N);
  console.log(`\nDaily (${samples} tries): p10 ${totals[Math.floor(N*0.1)]} median ${totals[N >> 1]} p90 ${totals[Math.floor(N*0.9)]}  bronze ${medal(th[0])}% silver ${medal(th[1])}% gold ${medal(th[2])}%  thresholds ${th.join('/')}`);
}
