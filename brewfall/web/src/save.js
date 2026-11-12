// Persistent player profile: currencies, unlocks, missions, achievements, settings, and the in-progress run.
// Stored in localStorage with a checksum and a rolling backup; a second copy goes to native storage on Android.
import * as D from './data.js';
import { hashStr, RNG } from './rng.js';
import { native } from './platform.js';

const KEY = 'brewfall.save.v1', BAK = 'brewfall.save.bak', SALT = 'bf-7c1e';
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNum = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };

export function fresh() {
  return {
    v: 1, glints: 0, moons: 0, created: Date.now(),
    charms: D.STARTER_CHARMS.slice(), familiars: ['cat'], orbSkins: ['classic'], cauldrons: ['iron'], equip: { orb: 'classic', cauldron: 'iron', familiar: 'cat', stake: 0 },
    stakeUnlocked: 1,
    stats: { runs: 0, wins: 0, rounds: 0, bosses: 0, merges: 0, bestChain: 0, bestRound: 0, bestOrder: 1, moons: 0, elixirs: 0, bestStakeWon: 0, dailies: 0, bestStreak: 0, bestSparks: 0, charmsUnlocked: D.STARTER_CHARMS.length, glintsEarned: 0, adsWatched: 0 },
    ach: {}, daily: { last: '', streak: 0, day: 0 }, missions: { date: '', list: [], bonus: false },
    dailyBrew: { date: '', best: 0, done: false }, adGlints: { date: '', n: 0 },
    settings: { sfx: true, music: true, haptic: true }, tut: {},
    iap: { tokens: [], removeAds: false, starter: false }, lastInterstitial: 0, run: null,
  };
}
function merge(base, o) { // tolerate older / partial saves
  for (const k in o) { if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], o[k]); else base[k] = o[k]; }
  return base;
}
function decode(raw) {
  if (!raw) return null;
  try { const w = JSON.parse(raw); if (!w || typeof w.d !== 'string' || hashStr(w.d + SALT) !== w.h) return null; const o = JSON.parse(w.d); if (typeof o !== 'object' || !o.v) return null; return merge(fresh(), o); } catch (e) { return null; }
}
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };

export const profile = { p: fresh(), recovered: null };
export function load() {
  let p = decode(ls.get(KEY)), src = 'main';
  if (!p) { p = decode(ls.get(BAK)); src = 'backup'; }
  if (!p) { p = decode(native.loadBackup()); src = 'device'; }
  if (!p) { src = ls.get(KEY) ? 'reset' : 'new'; p = fresh(); }
  profile.p = p; profile.recovered = src; sanitize(); return src;
}
function sanitize() {
  const p = profile.p; const num = (o, k, d = 0) => { if (typeof o[k] !== 'number' || !isFinite(o[k]) || o[k] < 0) o[k] = d; };
  num(p, 'glints'); num(p, 'moons'); p.glints = Math.floor(p.glints); p.moons = Math.floor(p.moons);
  for (const k of ['charms', 'familiars', 'orbSkins', 'cauldrons']) if (!Array.isArray(p[k])) p[k] = fresh()[k];
  p.charms = p.charms.filter(id => D.CHARM[id]);
  if (!D.ORB_SKINS.some(s => s.id === p.equip.orb)) p.equip.orb = 'classic';
  if (!D.CAULDRONS.some(s => s.id === p.equip.cauldron)) p.equip.cauldron = 'iron';
  if (!D.FAMILIAR[p.equip.familiar]) p.equip.familiar = 'cat';
  p.equip.stake = Math.max(0, Math.min(p.stakeUnlocked - 1, p.equip.stake | 0));
  if (!Array.isArray(p.iap.tokens)) p.iap.tokens = [];
}
let saveTimer = 0, n = 0;
export function save(now) {
  if (!now) { if (!saveTimer) saveTimer = setTimeout(() => { saveTimer = 0; save(true); }, 400); return; }
  try {
    const d = JSON.stringify(profile.p), raw = JSON.stringify({ d, h: hashStr(d + SALT) });
    const prev = ls.get(KEY); if (prev && (n++ % 5 === 0)) ls.set(BAK, prev);
    if (!ls.set(KEY, raw)) console.warn('save failed (storage full?)');
    if (n % 3 === 1) native.saveBackup(raw);
  } catch (e) { console.warn('save error', e); }
}
export function wipe() { profile.p = fresh(); try { localStorage.removeItem(KEY); localStorage.removeItem(BAK); } catch (e) {} native.saveBackup(''); save(true); }

// ---- currencies ----
const P = () => profile.p;
export function earn(g = 0, m = 0) { const p = P(); p.glints += Math.max(0, Math.floor(g)); p.moons += Math.max(0, Math.floor(m)); p.stats.glintsEarned += Math.max(0, Math.floor(g)); save(); }
export function canPay(cost, cur) { return cur === 'm' ? P().moons >= cost : P().glints >= cost; }
export function pay(cost, cur) { if (cost < 0 || !canPay(cost, cur)) return false; if (cur === 'm') P().moons -= cost; else P().glints -= cost; save(); return true; }

// ---- unlocks ----
export function buyUnlock(kind, id) {
  const p = P();
  const table = { charm: [p.charms, id => ({ cost: D.CHARM_UNLOCK_COST[D.CHARM[id].rar], cur: 'g' })], familiar: [p.familiars, id => ({ cost: D.FAMILIAR[id].cost, cur: 'g' })],
    orb: [p.orbSkins, id => D.ORB_SKINS.find(s => s.id === id)], cauldron: [p.cauldrons, id => D.CAULDRONS.find(s => s.id === id)] }[kind];
  if (!table) return 'bad'; const [list, def] = table; if (list.includes(id)) return 'owned';
  const d = def(id); if (!d || d.cur === 'iap' || d.cost < 0) return 'bad';
  if (!pay(d.cost, d.cur)) return 'poor';
  list.push(id); if (kind === 'charm') p.stats.charmsUnlocked = p.charms.length; save(true); return 'ok';
}
export function exchange() { const p = P(); if (p.moons < D.EXCHANGE.moon) return false; p.moons -= D.EXCHANGE.moon; p.glints += D.EXCHANGE.glint; save(true); return true; }

// ---- daily login ----
export function dailyState() {
  const p = P(), t = today(); if (p.daily.last === t) return { available: false, day: p.daily.day, streak: p.daily.streak };
  const gap = p.daily.last ? dayNum(t) - dayNum(p.daily.last) : 1;
  const streak = gap === 1 ? p.daily.streak + 1 : 1;
  return { available: gap >= 1, day: (p.daily.last && gap === 1 ? p.daily.day + 1 : 0) % D.DAILY_REWARDS.length, streak };
}
export function claimDaily(double) {
  const s = dailyState(); if (!s.available) return null; const p = P(), r = D.DAILY_REWARDS[s.day], k = double ? 2 : 1;
  p.daily = { last: today(), streak: s.streak, day: s.day }; p.stats.bestStreak = Math.max(p.stats.bestStreak, s.streak);
  earn((r.g || 0) * k, (r.m || 0)); save(true); return { g: (r.g || 0) * k, m: r.m || 0 };
}

// ---- daily missions ----
export function missions() {
  const p = P(), t = today();
  if (p.missions.date !== t) { const rng = new RNG(hashStr('missions' + t)); p.missions = { date: t, bonus: false, list: rng.shuffle(D.MISSIONS).slice(0, 3).map(m => ({ id: m.id, prog: 0, claimed: false })) }; save(); }
  return p.missions;
}
export function progress(key, n = 1, absolute = false) {
  const ms = missions(); let changed = false;
  for (const m of ms.list) { const d = D.MISSIONS.find(x => x.id === m.id); if (!d || d.key !== key || m.prog >= d.n) continue; m.prog = Math.min(d.n, absolute ? Math.max(m.prog, n) : m.prog + n); changed = true; }
  if (changed) save();
}
export function claimMission(i) {
  const ms = missions(), m = ms.list[i]; if (!m || m.claimed) return 0; const d = D.MISSIONS.find(x => x.id === m.id); if (m.prog < d.n) return 0;
  m.claimed = true; earn(d.reward); let moon = 0;
  if (!ms.bonus && ms.list.every(x => x.claimed)) { ms.bonus = true; moon = D.MISSION_BONUS_MOON; earn(0, moon); }
  save(true); return { g: d.reward, m: moon };
}
export const missionsReady = () => missions().list.filter(m => !m.claimed && m.prog >= D.MISSIONS.find(x => x.id === m.id).n).length;

// ---- achievements ----
export const achReady = () => D.ACHIEVEMENTS.filter(a => !P().ach[a.id] && (P().stats[a.stat] || 0) >= a.n);
export function claimAch(id) { const a = D.ACHIEVEMENTS.find(x => x.id === id), p = P(); if (!a || p.ach[id] || (p.stats[a.stat] || 0) < a.n) return null; p.ach[id] = 1; earn(a.g, a.m); save(true); return a; }

// ---- run bookkeeping ----
export function noteRound(run, wasBoss) {
  const s = P().stats; s.rounds++; progress('rounds'); if (wasBoss) { s.bosses++; progress('bosses'); }
  if (run.score >= 1000) progress('bigScore');
  s.bestRound = Math.max(s.bestRound, run.stats.bestRound); s.bestOrder = Math.max(s.bestOrder, Math.min(run.order, D.ORDERS)); save();
}
// Fold a finished run into lifetime stats and pay its Glints. Returns the Glints paid.
export function finishRun(run) {
  const p = P(), s = p.stats, r = run.stats;
  s.runs++; s.bestChain = Math.max(s.bestChain, r.bestChain); s.bestRound = Math.max(s.bestRound, r.bestRound); s.moons += r.moons; s.elixirs += r.elixirs; s.bestSparks = Math.max(s.bestSparks, r.bestSparks);
  s.bestOrder = Math.max(s.bestOrder, Math.min(run.order, D.ORDERS));
  if (run.bossesBeaten >= D.ORDERS) { s.wins++; s.bestStakeWon = Math.max(s.bestStakeWon, run.stake + 1); if (run.mode === 'run') p.stakeUnlocked = Math.max(p.stakeUnlocked, Math.min(D.STAKES.length, run.stake + 2)); }
  progress('runs');
  if (run.mode === 'daily') { s.dailies++; p.dailyBrew = { date: today(), best: Math.max(p.dailyBrew.date === today() ? p.dailyBrew.best : 0, r.total), done: true }; }
  const g = run.glints(); earn(g); p.run = null; save(true); return g;
}
export function grantPurchase(sku, token) {
  const p = P(), d = D.IAP_BY_SKU[sku]; if (!d) return 'unknown';
  if (token && p.iap.tokens.includes(token)) return 'duplicate';
  if (d.once && ((sku === 'remove_ads' && p.iap.removeAds) || (sku === 'starter_pack' && p.iap.starter))) { if (token) p.iap.tokens.push(token); save(true); return 'owned'; }
  if (token) { p.iap.tokens.push(token); if (p.iap.tokens.length > 400) p.iap.tokens.shift(); }
  if (d.moon) p.moons += d.moon; if (d.glint) p.glints += d.glint;
  if (d.skin && !p.orbSkins.includes(d.skin)) p.orbSkins.push(d.skin);
  if (sku === 'remove_ads') p.iap.removeAds = true; if (sku === 'starter_pack') p.iap.starter = true;
  save(true); return 'granted';
}
