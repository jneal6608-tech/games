/* Headless balance check: simulates a player's first N runs with a simple "buy cheapest" policy.
   usage: node tools/balance.js [runs] */
require('../web/js/data.js'); require('../web/js/sim.js');
const EH = globalThis.EH;
let seed = 12345; const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const N = +process.argv[2] || 30;
const ws = {}; const rate = {}; let maxTier = 0; let embers = 0, tier = 0, best = [0,0,0,0,0,0], total = 0;
function runOnce() {
  const r = new EH.Run({ tier, workshop: ws, flame: 'hearth', abilities: { flare: 1 }, rand });
  let t = 0;
  while (!r.over && r.time < 3 * 3600) {
    r.update(1 / 30); r.fx.length = 0; t += 1 / 30;
    if (r.pendingBoon) r.pickBoon(r.pendingBoon[Math.floor(rand() * r.pendingBoon.length)]);
    if (Math.floor(t * 2) !== Math.floor((t - 1 / 30) * 2)) {
      for (let g = 0; g < 20; g++) {
        let bestId = null, bc = Infinity;
        for (const u of EH.UPGRADES) if (r.unlocked(u.id) && !r.maxed(u.id)) { const c = r.cost(u.id); if (c < bc) { bc = c; bestId = u.id; } }
        if (!bestId || !r.buy(bestId)) break;
      }
      if (r.abilityReady('flare') && r.hp < r.s.maxHp * 0.5) r.cast('flare');
    }
  }
  return r;
}
for (let i = 1; i <= N; i++) {
  if (rate[tier] !== undefined && tier > 0 && rate[tier] < rate[tier-1]) { tier--; }
  else if (tier < maxTier && (rate[tier+1] === undefined || (i % 6 === 0))) tier++;
  const r = runOnce(); rate[tier] = r.finalEmbers() / r.time; const e = r.finalEmbers(); embers += e; total += r.time;
  best[tier] = Math.max(best[tier], r.wave);
  // spend embers: cheapest workshop item (unlock or level)
  let spent = 0;
  for (;;) {
    let pick = null, pc = Infinity;
    for (const u of EH.UPGRADES) {
      if (u.unlock && !ws['_u_' + u.id]) { if (u.unlock < pc) { pc = u.unlock; pick = '_u_' + u.id; } continue; }
      if ((ws[u.id] || 0) >= u.max) continue;
      const c = u.wcost(ws[u.id] || 0); if (c < pc) { pc = c; pick = u.id; }
    }
    if (!pick || pc > embers) break; embers -= pc; ws[pick] = (ws[pick] || 0) + 1; spent++;
  }
  console.log(`run ${String(i).padStart(2)} tier ${tier + 1} wave ${String(r.wave).padStart(3)} ${(r.time / 60).toFixed(1).padStart(5)}min embers ${String(e).padStart(6)} gems ${r.gems} bought ${spent} dmgW ${ws.damage || 0} total ${(total / 3600).toFixed(1)}h`);
  if (maxTier < 5 && best[maxTier] >= EH.TIERS[maxTier + 1].unlockWave) { maxTier++; console.log('  -> unlocked tier', maxTier + 1); }
}
