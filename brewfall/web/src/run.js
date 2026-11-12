// A single roguelike run: rounds, scoring, charms, shop. Pure logic (no DOM), so it is unit-testable in Node.
import { RNG } from './rng.js';
import * as D from './data.js';

export class Run {
  constructor(opts) {
    if (opts.restore) { Object.assign(this, opts.restore); this.rng = new RNG(1); this.rng.s = this.rngS; return; }
    this.seed = opts.seed >>> 0; this.rng = new RNG(this.seed);
    this.mode = opts.mode || 'run'; // 'run' | 'daily'
    this.familiar = opts.familiar || 'cat'; this.stake = opts.stake || 0;
    this.pool = (opts.pool || D.STARTER_CHARMS).slice();
    this.order = 1; this.round = 0; this.score = 0; this.sparks = this.familiar === 'toad' ? 8 : 4;
    this.charms = []; this.tonics = []; this.recipes = {}; // tier -> level
    this.charmSlots = this.familiar === 'owl' ? 6 : this.familiar === 'moth' ? 4 : D.CHARM_SLOTS;
    this.bossesBeaten = 0; this.roundsWon = 0; this.endless = false; this.over = false; this.won = false; this.revived = false;
    this.chain = 0; this.dropsLeft = 0; this.dropsUsed = 0; this.golden = false; this.forceNext = 0;
    this.stats = { merges: 0, bestChain: 0, bestRound: 0, grand: 0, moons: 0, elixirs: 0, charmsBought: 0, tonicsUsed: 0, chain4: 0, bestSparks: 0, total: 0 };
    this.hex = null; this.shop = null; this.phase = 'round'; this.bodies = [];
    this.hexOrder = this.rng.shuffle(D.HEXES.map(h => h.id));
    if (this.familiar === 'raven') { const rares = D.CHARMS.filter(c => c.rar === 'r' && c.id !== 'mirror'); this._addCharm(this.rng.pick(rares).id); }
    this.queue = [0, 0];
    this.startRound();
  }
  toJSON() { const o = { ...this }; o.rngS = this.rng.s; delete o.rng; return o; }

  get stakeDef() { return D.STAKES[this.stake]; }
  has(id) { return this.charms.some(c => c.id === id && !c.asleep); }
  activeCharms() { return this.charms.filter(c => !c.asleep); }
  get target() {
    let m = this.stakeDef.mult; if (this.familiar === 'raven') m *= 1.15; if (this.hex === 'steep') m *= 1.3;
    return D.targetFor(this.order, this.round, m);
  }
  maxDrops() {
    let n = D.BASE_DROPS;
    if (this.familiar === 'moth') n += 4; if (this.familiar === 'owl') n -= 2;
    if (this.stake >= 3) n -= this.stake - 2;
    for (const c of this.activeCharms()) n += D.CHARM[c.id].drops || 0;
    if (this.hex === 'thin') n -= 4;
    return Math.max(6, n);
  }
  startRound() {
    this.phase = 'round'; this.score = 0; this.chain = 0; this.dropsUsed = 0; this.golden = false; this.shop = null;
    this.hex = this.round === 2 ? this.hexOrder[(this.order - 1) % this.hexOrder.length] : null;
    for (const c of this.charms) c.asleep = false;
    if (this.hex === 'silence' && this.charms[0]) this.charms[0].asleep = true;
    this.dropsLeft = this.maxDrops();
    if (this.round === 0) this.bodies = (this.bodies || []).filter(b => b[0] > 2); // a beaten rival skims the Dew and Ember off the top
    this.queue = [this._draw(), this._draw()];
  }
  _draw() {
    if (this.forceNext) { const t = this.forceNext; this.forceNext = 0; return t; }
    if (this.hex === 'heavy') return this.rng.chance(0.6) ? 1 : 2;
    const t = this.rng.weighted([1, 2, 3, 4], t => [38, 32, 20, 10][t - 1]);
    return t === 1 && this.has('richstock') ? 2 : t;
  }
  // Called when the player releases an essence. Returns the tier dropped.
  drop() {
    if (this.phase !== 'round' || this.dropsLeft <= 0) return 0;
    const t = this.queue[0]; this.queue = [this.queue[1], this._draw()];
    this.dropsLeft--; this.dropsUsed++; this.chain = 0;
    if (this.hex === 'tax' && this.dropsUsed % 4 === 0 && this.sparks > 0) this.sparks--;
    return t;
  }
  // Score one merge that produced tier t. Returns what happened so the board can show it.
  merge(t, orbs) {
    if (this.phase !== 'round') return null;
    this.chain++;
    const st = this.stats; st.merges++; st.bestChain = Math.max(st.bestChain, this.chain);
    if (this.chain === 4) st.chain4++;
    if (t === 7) st.grand++; if (t === 10) st.moons++; if (t === 11) st.elixirs++;
    const chainEff = 1 + (this.chain - 1) * (this.has('cascade') ? 2 : 1);
    const lvl = this.recipes[t] || 0;
    let total = 0, sparks = 0, refund = 0, lucky = false, last = null;
    const act = this.activeCharms();
    let reps = 1; for (const c of act) { const d = D.CHARM[c.id]; if (d.repeat) reps += d.repeat({ t }); }
    for (let r = 0; r < reps; r++) {
      const c = { t, chain: chainEff, orbs, dropsLeft: this.dropsLeft, dropsUsed: this.dropsUsed, repeat: r > 0, sparks: 0, refund: 0,
        chips: D.TIERS[t].chips * (1 + 0.5 * lvl), mult: chainEff + lvl };
      for (let i = 0; i < this.charms.length; i++) {
        let ch = this.charms[i]; if (ch.asleep) continue;
        if (ch.id === 'mirror') { ch = this.charms[i - 1]; if (!ch || ch.asleep || ch.id === 'mirror') continue; }
        const d = D.CHARM[ch.id]; if (d.merge) d.merge(c, ch.st, this);
      }
      if (this.golden) { c.mult *= 5; this.golden = false; }
      let gain = Math.floor(c.chips * c.mult);
      if (this.hex === 'sour' && D.isSmall(t)) gain = 0;
      total += gain; sparks += c.sparks; refund += c.refund; lucky = lucky || !!c.lucky; last = c;
    }
    this.score += total; st.total += total; this.sparks += sparks; this.dropsLeft += refund;
    st.bestSparks = Math.max(st.bestSparks, this.sparks);
    return { gain: total, chips: Math.floor(last.chips), mult: Math.round(last.mult * 10) / 10, chain: this.chain, sparks, refund, lucky, reps };
  }
  get reached() { return this.score >= this.target; }
  // After the cauldron settles: 'won' | 'lost' | null (keep playing)
  status(settled) {
    if (this.phase !== 'round') return null;
    if (this.reached) return 'won';
    if (this.dropsLeft <= 0 && settled) return 'lost';
    return null;
  }
  // Round cleared: pay out, advance, build the shop. Returns a payout breakdown.
  winRound() {
    const st = this.stats; st.bestRound = Math.max(st.bestRound, this.score);
    const lines = []; let pay = D.ROUND_REWARD[this.round]; lines.push([D.ROUND_NAMES[this.round] + ' finished', pay]);
    const spare = Math.min(4, Math.floor(this.dropsLeft / 2)); if (spare) { lines.push([`${this.dropsLeft} drops to spare`, spare]); pay += spare; }
    const cap = this.familiar === 'toad' ? 10 : D.INTEREST_CAP;
    const interest = Math.min(cap, Math.floor(this.sparks / 5)); if (interest) { lines.push(['Interest (1 per 5 Sparks)', interest]); pay += interest; }
    const destroyed = [];
    for (const ch of this.charms.slice()) {
      const d = D.CHARM[ch.id]; if (!d.roundEnd || ch.asleep) continue;
      const res = d.roundEnd(ch.st, this);
      if (res && res.sparks) { lines.push([d.name, res.sparks]); pay += res.sparks; }
      if (res && res.destroy) { destroyed.push(d.name); this.charms.splice(this.charms.indexOf(ch), 1); }
    }
    this.sparks += pay; st.bestSparks = Math.max(st.bestSparks, this.sparks);
    const wasBoss = this.round === 2; this.roundsWon++;
    if (wasBoss) { this.bossesBeaten++; this.order++; this.round = 0; } else this.round++;
    this.hex = null; for (const c of this.charms) c.asleep = false;
    if (wasBoss && this.order > D.ORDERS && !this.endless) { this.won = true; }
    this.phase = 'shop'; this.rerollCost = 2; this.freeRerolls = this.charms.reduce((n, c) => n + (D.CHARM[c.id].freeRerolls || 0), 0);
    this._rollShop(true);
    return { lines, pay, wasBoss, destroyed, won: this.won };
  }
  loseRound() { this.phase = 'over'; this.over = true; this.stats.bestRound = Math.max(this.stats.bestRound, this.score); }
  // One revive per run (rewarded ad or Moonstones): empties the cauldron and refills drops.
  revive() { if (this.revived) return false; this.revived = true; this.over = false; this.phase = 'round'; this.bodies = []; this.dropsLeft = Math.max(8, Math.ceil(this.maxDrops() / 2)); this.chain = 0; return true; }
  continueEndless() { this.endless = true; this.won = false; }

  price(base) { return base + (this.stake >= 2 ? 1 : 0); }
  _rollShop(full) {
    const owned = new Set(this.charms.map(c => c.id));
    const avail = this.pool.map(id => D.CHARM[id]).filter(c => c && !owned.has(c.id));
    const charms = []; const pool = avail.slice();
    for (let i = 0; i < 3 && pool.length; i++) { const c = this.rng.weighted(pool, c => D.RARITY[c.rar].w); pool.splice(pool.indexOf(c), 1); charms.push({ id: c.id, cost: this.price(c.cost) }); }
    const prev = this.shop || {};
    const tonics = full ? this.rng.shuffle(D.TONICS).slice(0, 2).map(t => ({ id: t.id, cost: this.price(t.cost) })) : prev.tonics;
    let recipe = prev.recipe;
    if (full) { const maxT = Math.min(10, 4 + this.order); const t = 2 + this.rng.int(maxT - 1); recipe = { tier: t, cost: this.price(3 + (this.recipes[t] || 0)) }; }
    this.shop = { charms, tonics, recipe };
  }
  reroll() {
    if (this.phase !== 'shop') return false;
    if (this.freeRerolls > 0) this.freeRerolls--; else { if (this.sparks < this.rerollCost) return false; this.sparks -= this.rerollCost; this.rerollCost++; }
    this._rollShop(false); return true;
  }
  freeRerollByAd() { this._rollShop(false); }
  _addCharm(id) { const d = D.CHARM[id]; this.charms.push({ id, st: d.init ? d.init() : {} }); }
  buyCharm(i) {
    const it = this.shop && this.shop.charms[i]; if (!it || it.sold) return 'gone';
    if (this.charms.length >= this.charmSlots) return 'full';
    if (this.sparks < it.cost) return 'poor';
    this.sparks -= it.cost; it.sold = true; this._addCharm(it.id); this.stats.charmsBought++; return 'ok';
  }
  sellValue(i) { const c = this.charms[i]; return c ? Math.max(1, Math.floor(D.CHARM[c.id].cost / 2)) : 0; }
  sellCharm(i) { if (!this.charms[i]) return false; this.sparks += this.sellValue(i); this.charms.splice(i, 1); return true; }
  moveCharm(i, dir) { const j = i + dir; if (j < 0 || j >= this.charms.length) return; [this.charms[i], this.charms[j]] = [this.charms[j], this.charms[i]]; }
  buyTonic(i) {
    const it = this.shop && this.shop.tonics[i]; if (!it || it.sold) return 'gone';
    if (this.tonics.length >= D.TONIC_SLOTS) return 'full';
    if (this.sparks < it.cost) return 'poor';
    this.sparks -= it.cost; it.sold = true; this.tonics.push(it.id); return 'ok';
  }
  buyRecipe() {
    const it = this.shop && this.shop.recipe; if (!it || it.sold) return 'gone';
    if (this.sparks < it.cost) return 'poor';
    this.sparks -= it.cost; it.sold = true; this.recipes[it.tier] = (this.recipes[it.tier] || 0) + 1; return 'ok';
  }
  leaveShop() { if (this.phase !== 'shop') return; this.startRound(); }
  // Use a tonic during a brew. `world` is the physics world (see physics.js).
  useTonic(i, world) {
    if (this.phase !== 'round') return false;
    const id = this.tonics[i]; if (!id) return false;
    const bs = world.bodies;
    if (id === 'stir') world.shake(this.rng);
    else if (id === 'purge') { for (const b of bs.slice()) if (b.tier === 1) world.remove(b); }
    else if (id === 'ripen') { const s = bs.slice().sort((a, b) => a.tier - b.tier).slice(0, 3); for (const b of s) { world.remove(b); const n = world.add(Math.min(10, b.tier + 1), b.x, b.y - 4); n.age = 2; } }
    else if (id === 'dissolve') { const s = bs.slice().sort((a, b) => b.tier - a.tier).slice(0, 3); for (const b of s) world.remove(b); }
    else if (id === 'spare') this.dropsLeft += 4;
    else if (id === 'golden') this.golden = true;
    else if (id === 'pick') this.queue[0] = 5;
    this.tonics.splice(i, 1); this.stats.tonicsUsed++; this.chain = 0; return true;
  }
  // Glints earned by this run (paid to the profile when it ends).
  glints() {
    let g = this.roundsWon * D.GLINT_PER_ROUND + this.bossesBeaten * D.GLINT_PER_BOSS + (this.bossesBeaten >= D.ORDERS ? D.GLINT_WIN : 0);
    return Math.round(g * this.stakeDef.glint);
  }
}
