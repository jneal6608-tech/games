// Catangle — persistent save (localStorage with a rolling backup copy).
import { ECON } from './data.js';

const KEY = 'catangle.save.v1';
const BAK = 'catangle.save.v1.bak';

function defaults() {
  return {
    v: 1,
    level: 1,
    fish: 0,
    starsTotal: 0,
    hints: ECON.startHints,
    lures: ECON.startLures,
    coats: ['ginger', 'cloud', 'smoke', 'midnight'],
    themes: ['cozy'],
    theme: 'cozy',
    noAds: false,
    daily: { lastDay: 0, streak: 0, bestStreak: 0 },
    freeFish: { day: 0, used: 0 },
    settings: { sound: true, haptics: true },
    stats: { cats: 0, wins: 0, perfect: 0 },
    seen: {},
    ads: { winsSince: 0, lastAt: 0 },
    orders: [],
    created: Date.now(),
  };
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && typeof o === 'object' && o.v === 1 ? o : null;
  } catch (e) { return null; }
}

function merge(base, over) {
  for (const k of Object.keys(over)) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') merge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}

export function loadSave() {
  const s = merge(defaults(), read(KEY) || read(BAK) || {});
  s.level = Math.max(1, Math.floor(Number(s.level) || 1));
  s.fish = Math.max(0, Math.floor(Number(s.fish) || 0));
  return s;
}

let timer = null;
export function persist(s, immediate) {
  const write = () => {
    timer = null;
    try {
      const prev = localStorage.getItem(KEY);
      if (prev) localStorage.setItem(BAK, prev);
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) { /* storage full or blocked: keep playing in memory */ }
  };
  if (immediate) { if (timer) clearTimeout(timer); write(); return; }
  if (!timer) timer = setTimeout(write, 250);
}

export function wipeSave() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(BAK); } catch (e) { /* ignore */ }
}

export function today() {
  const d = new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}
