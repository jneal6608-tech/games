// Catangle — app shell: screens, input, animation, progression, shop.
import { generateLevel, generateDaily, makeRng, DX, DY } from './levelgen.js';
import { LevelState } from './game.js';
import { COATS, THEMES, ECON, PRODUCTS, PRIVACY_URL, VERSION } from './data.js';
import { loadSave, persist, wipeSave, today } from './save.js';
import { Sfx, setSound, unlockAudio, suspendAudio } from './audio.js';
import { Platform } from './platform.js';
import { drawCat, drawBadge, drawBackground, drawBoard, layoutBoard, subPath } from './render.js';

const $ = (s, el = document) => el.querySelector(s);
const ic = (n) => `<svg><use href="#i-${n}"/></svg>`;
const params = new URLSearchParams(location.search);
const canvas = $('#cv');
const ctx = canvas.getContext('2d');
const root = $('#modal-root');

let save = loadSave();
let W = 0, H = 0, dpr = 1, time = 0;
let screen = 'home';
let view = null;
let prices = {};
const modals = [];
const coatById = Object.fromEntries(COATS.map((c) => [c.id, c]));
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const theme = () => THEMES.find((t) => t.id === save.theme) || THEMES[0];
setSound(save.settings.sound);

// ------------------------------------------------------------------ helpers
function haptic(kind) { if (save.settings.haptics) Platform.haptic(kind); }
let toastTimer = 0;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('in');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('in'), 2000);
}
function refreshFish(bump) {
  document.querySelectorAll('[data-fish]').forEach((el) => {
    el.textContent = save.fish.toLocaleString();
    if (bump) { el.parentElement.classList.remove('bump'); void el.offsetWidth; el.parentElement.classList.add('bump'); }
  });
}
function addFish(n) { save.fish = Math.max(0, save.fish + n); persist(save); refreshFish(n > 0); if (n > 0) Sfx.coin(); }
function spend(n) { if (save.fish < n) return false; addFish(-n); return true; }

function modal(html, { dismiss = true, onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal">${dismiss ? `<button class="x" data-close aria-label="Close">${ic('close')}</button>` : ''}${html}</div>`;
  root.appendChild(wrap);
  const m = { wrap, dismiss, onClose, el: wrap.firstElementChild };
  requestAnimationFrame(() => wrap.classList.add('in'));
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('button')) { unlockAudio(); Sfx.click(); }
    if ((e.target === wrap && dismiss) || e.target.closest('[data-close]')) closeModal(m);
  });
  modals.push(m);
  return m;
}
function closeModal(m, silent) {
  const i = modals.indexOf(m);
  if (i < 0) return;
  modals.splice(i, 1); m.wrap.remove();
  if (!silent && m.onClose) m.onClose();
}
function on(m, act, fn) { const b = $(`[data-act="${act}"]`, m.el); if (b) b.addEventListener('click', fn); }

// ------------------------------------------------------------------ canvas
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  if (view) view.L = layoutBoard($('#stage').getBoundingClientRect(), view.state.w, view.state.h);
}
window.addEventListener('resize', resize);

function applyTheme() {
  const t = theme();
  document.body.classList.toggle('dark', !!t.dark);
  document.documentElement.style.background = t.bg[0];
  const meta = $('meta[name=theme-color]'); if (meta) meta.content = t.bg[0];
}

// ------------------------------------------------------------------ screens
function show(name) {
  screen = name;
  $('#home').classList.toggle('hidden', name !== 'home');
  $('#game').classList.toggle('hidden', name !== 'game');
  if (name === 'home') { view = null; refreshHome(); }
}

function refreshHome() {
  refreshFish();
  $('#play-label').textContent = `Level ${save.level}`;
  const inCh = (save.level - 1) % 10;
  $('#chapter-name').textContent = `Chapter ${Math.floor((save.level - 1) / 10) + 1}`;
  $('#chapter-count').textContent = `${inCh}/10`;
  $('#chapter-bar').style.width = `${inCh * 10}%`;
  const done = save.daily.lastDay === today();
  const live = done || save.daily.lastDay === today() - 1;
  $('#btn-daily').classList.toggle('done', done);
  $('#daily-sub').textContent = done ? 'Solved! Come back tomorrow' : `New puzzle · +${dailyReward(live ? save.daily.streak + 1 : 1)} fish`;
  $('#daily-streak').textContent = live && save.daily.streak ? `${save.daily.streak} day streak` : '';
  $('#cats-count').textContent = `${save.coats.length}/${COATS.length}`;
  $('#btn-play').classList.toggle('pulse', save.level <= 3);
}
function dailyReward(streak) { return ECON.dailyReward + Math.min(ECON.streakBonusCap, ECON.streakBonus * Math.max(0, streak - 1)); }

// ------------------------------------------------------------------ level setup
function startGame(mode, opts = {}) {
  const n = opts.level || save.level;
  const day = today();
  const def = mode === 'daily' ? generateDaily(day) : generateLevel(n);
  const state = new LevelState(def);
  view = {
    mode, n, def, state, L: null, day,
    spines: new Map(), coats: new Map(), anims: new Map(), shakes: new Map(),
    ghosts: [], particles: [], hintId: null, lureMode: false, ended: false,
    usedContinue: false, combo: 0, comboAt: 0, shakeUntil: 0, auto: false, startedAt: Date.now(),
  };
  for (const c of def.cats) view.spines.set(c.id, c.cells.slice().reverse());
  assignCoats(view);
  show('game');
  $('#g-title').textContent = mode === 'daily' ? 'Daily Tangle' : def.params.boss ? `Big Level ${n}` : `Level ${n}`;
  view.L = layoutBoard($('#stage').getBoundingClientRect(), state.w, state.h);
  refreshHud(); coach();
  if (mode === 'level' && !opts.clip) introFeature(def);
}

// Spread coats so touching cats rarely share one (keeps the board readable).
function assignCoats(v) {
  const rand = makeRng(v.def.params.seed ^ 0x5bd1e995);
  const owned = save.coats.map((id) => coatById[id]).filter(Boolean);
  const { w, h } = v.def;
  const occ = new Int16Array(w * h).fill(-1);
  for (const c of v.def.cats) for (const [x, y] of c.cells) occ[y * w + x] = c.id;
  for (const c of v.def.cats) {
    const near = new Set();
    for (const [x, y] of c.cells) for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const o = occ[ny * w + nx];
      if (o >= 0 && o !== c.id && v.coats.has(o)) near.add(v.coats.get(o).id);
    }
    const pool = owned.filter((k) => !near.has(k.id));
    const from = pool.length ? pool : owned;
    v.coats.set(c.id, from[Math.floor(rand() * from.length)]);
  }
}

function refreshHud() {
  if (!view) return;
  const st = view.state;
  const hearts = $('#g-hearts');
  if (hearts.children.length !== 3) hearts.innerHTML = ic('heart').repeat(3);
  [...hearts.children].forEach((el, i) => el.classList.toggle('lost', i >= st.hearts));
  const left = st.cats.size;
  $('#g-left').textContent = left ? `${left} ${left === 1 ? 'cat' : 'cats'} left` : '';
  const hn = $('#hint-n'), ln = $('#lure-n');
  hn.textContent = save.hints || '+'; hn.classList.toggle('zero', !save.hints);
  ln.textContent = save.lures || '+'; ln.classList.toggle('zero', !save.lures);
  $('#btn-lure').classList.toggle('armed', view.lureMode);
  refreshFish();
}

function coach() {
  const el = $('#coach');
  let msg = '';
  if (view.lureMode) msg = 'Tap <b>any cat</b> to tempt it away with a treat';
  else if (view.mode === 'level' && !view.auto) {
    if (view.n === 1) msg = 'Tap a cat with a <b>clear path</b> ahead and it runs home!';
    else if (view.n === 2) msg = 'Blocked cats <b>bump</b> and cost a heart. Check where each cat is <b>facing</b>.';
    else if (view.n === 3) msg = 'Stuck? The <b>Hint</b> button shows a cat that can go.';
  }
  el.innerHTML = msg; el.classList.toggle('hidden', !msg);
  requestAnimationFrame(() => { if (view) view.L = layoutBoard($('#stage').getBoundingClientRect(), view.state.w, view.state.h); });
}

function introFeature(def) {
  const feats = [
    ['sleepy', def.cats.some((c) => c.sleep), 'Sleepy cats', 'A snoozing cat will not budge. The number shows how many <b>other cats</b> must leave before it wakes up.'],
    ['grumpy', def.cats.some((c) => c.fuse), 'Grumpy cats', 'A grumpy cat has a countdown. It drops by one every time another cat leaves, so <b>free the grump before it hits zero!</b>'],
  ];
  for (const [key, has, title, body] of feats) {
    if (has && !save.seen[key]) {
      save.seen[key] = 1; persist(save);
      modal(`<h2>${title}</h2><p>${body}</p><button class="btn primary" data-close>Got it</button>`);
      return;
    }
  }
}

// ------------------------------------------------------------------ input
function catAt(px, py) {
  const { L, state: st } = view;
  const fx = (px - L.ox) / L.u, fy = (py - L.oy) / L.u;
  const cx = Math.floor(fx), cy = Math.floor(fy);
  if (cx >= 0 && cy >= 0 && cx < st.w && cy < st.h && st.occ[cy * st.w + cx] >= 0) return st.occ[cy * st.w + cx];
  let best = null, bd = 0.8;
  for (const c of st.cats.values()) for (const [x, y] of c.cells) {
    const d = Math.hypot(fx - x - 0.5, fy - y - 0.5);
    if (d < bd) { bd = d; best = c.id; }
  }
  return best;
}

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (screen !== 'game' || modals.length || !view || view.auto) return;
  const id = catAt(e.clientX, e.clientY);
  if (id !== null) tapCat(id);
});

const px = (p) => [view.L.ox + (p[0] + 0.5) * view.L.u, view.L.oy + (p[1] + 0.5) * view.L.u];

function tapCat(id) {
  const st = view.state;
  if (st.status !== 'play' || view.anims.has(id)) return;
  const cat = st.cats.get(id);
  if (!cat) return;
  view.hintId = null;
  const headPx = px(cat.cells[0]);

  if (view.lureMode) {
    view.lureMode = false; save.lures--; persist(save);
    st.lure(id);
    view.ghosts.push({ id, spine: view.spines.get(id), dir: cat.dir, coat: view.coats.get(id), t0: time, lure: true });
    burst(headPx[0], headPx[1], 14, 'star'); Sfx.hint(); haptic('medium');
    afterRemoval(); coach();
    return;
  }
  const r = st.tap(id);
  if (!r) return;
  if (r.type === 'asleep') {
    Sfx.snore(); view.shakes.set(id, time); haptic('light');
    floatText(headPx[0], headPx[1] - view.L.u * 0.5, `Zzz… ${st.sleepLeft(cat)} more`, '#6C63C7');
    return;
  }
  if (r.type === 'exit') {
    view.ghosts.push({ id, spine: view.spines.get(id), dir: cat.dir, coat: view.coats.get(id), t0: time, dist: r.steps + cat.cells.length + 16 });
    Sfx.mew(); haptic('light');
    burst(headPx[0], headPx[1], 5, 'heart');
    view.combo = time - view.comboAt < 1.4 ? view.combo + 1 : 1; view.comboAt = time;
    if (view.combo >= 3) floatText(W / 2, view.L.oy - 6, view.combo >= 6 ? `Purr-fect x${view.combo}!` : `Combo x${view.combo}`, '#FF7A59', 1.25);
    afterRemoval();
    return;
  }
  // bump
  view.anims.set(id, { t0: time, steps: r.steps, blocker: r.blocker, fired: false });
}

function afterRemoval() {
  const st = view.state;
  save.stats.cats++;
  refreshHud();
  if (st.status === 'lost' && st.lostReason === 'fuse') {
    view.shakes.set(st.lostCat, time); view.shakeUntil = time + 0.4; Sfx.hiss(); haptic('heavy');
    endLater(900);
  } else if (st.status === 'won') endLater(750);
}

function endLater(ms) {
  if (view.ended) return;
  view.ended = true;
  const v = view;
  if (v.state.status === 'won') { Sfx.win(); confetti(); haptic('medium'); }
  setTimeout(() => { if (view === v) (v.state.status === 'won' ? onWin : onLose)(); }, ms);
}

// ------------------------------------------------------------------ particles
function burst(x, y, n, kind) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 120;
    view.particles.push({ kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0, max: 0.5 + Math.random() * 0.4, size: 5 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, color: ['#F2506E', '#FFC23D', '#FF7A59', '#fff'][i % 4] });
  }
}
function confetti() {
  for (let i = 0; i < (reduceMotion ? 24 : 90); i++) {
    view.particles.push({ kind: 'confetti', x: Math.random() * W, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 80, vy: 180 + Math.random() * 260, life: 0, max: 2.6, size: 6 + Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, color: ['#F2506E', '#FFC23D', '#4CC38A', '#5AA9F0', '#B9A2F2', '#FF7A59'][i % 6] });
  }
}
function floatText(x, y, text, color, scale = 1) {
  view.particles.push({ kind: 'text', x, y, vx: 0, vy: -38, life: 0, max: 1.1, text, color, size: 20 * scale });
}

function drawParticles(dt) {
  const ps = view.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life += dt; if (p.life > p.max) { ps.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind !== 'text' && p.kind !== 'confetti') p.vy += 260 * dt;
    const k = 1 - p.life / p.max;
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 2.2); ctx.translate(p.x, p.y);
    if (p.kind === 'text') {
      const pop = Math.min(1, p.life * 9);
      ctx.font = `700 ${p.size * (0.6 + 0.4 * pop)}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round'; ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
    } else if (p.kind === 'heart') {
      const s = p.size * (0.6 + k * 0.6); ctx.fillStyle = '#F2506E'; ctx.beginPath();
      ctx.moveTo(0, s * 0.9); ctx.bezierCurveTo(-s * 1.4, -s * 0.2, -s * 0.6, -s * 1.2, 0, -s * 0.4);
      ctx.bezierCurveTo(s * 0.6, -s * 1.2, s * 1.4, -s * 0.2, 0, s * 0.9); ctx.fill();
    } else if (p.kind === 'confetti') {
      p.rot += p.vr * dt; ctx.rotate(p.rot); ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * Math.abs(Math.cos(p.rot * 1.3)) + 2);
    } else {
      p.rot += p.vr * dt; ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.beginPath();
      for (let j = 0; j < 10; j++) { const r = j % 2 ? p.size * 0.45 : p.size; const a = (j * Math.PI) / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.fill();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ drawing
function windowPts(spine, dir, s) {
  const head = spine[spine.length - 1];
  const P = spine.concat([[head[0] + DX[dir] * 80, head[1] + DY[dir] * 80]]);
  return subPath(P, s, s + spine.length - 1).map(px);
}

function drawGame(dt) {
  const { state: st, L } = view;
  const u = L.u, th = theme();
  ctx.save();
  if (view.shakeUntil > time && !reduceMotion) ctx.translate((Math.random() - 0.5) * u * 0.12, (Math.random() - 0.5) * u * 0.12);
  drawBoard(ctx, L, st, th);
  const badges = [];
  for (const cat of st.cats.values()) {
    const spine = view.spines.get(cat.id);
    const anim = view.anims.get(cat.id);
    let pts, mood = 'idle';
    if (anim) {
      const e = time - anim.t0, tf = 0.09 + 0.028 * anim.steps, tb = 0.2 + 0.03 * anim.steps, peak = anim.steps + 0.17;
      let s;
      if (e < tf) s = peak * (e / tf) ** 2;
      else {
        if (!anim.fired) { anim.fired = true; onImpact(cat, anim); }
        const k = Math.min(1, (e - tf) / tb); s = peak * (1 - (1 - (1 - k) ** 3)); mood = 'ouch';
        if (k >= 1) { view.anims.delete(cat.id); s = 0; mood = 'idle'; }
      }
      pts = windowPts(spine, cat.dir, s);
    } else pts = spine.map(px);
    const sh = view.shakes.get(cat.id);
    if (sh !== undefined) {
      const e = time - sh;
      if (e > 0.35) view.shakes.delete(cat.id);
      else { const o = Math.sin(e * 70) * u * 0.06 * (1 - e / 0.35); pts = pts.map((p) => [p[0] + o, p[1]]); }
    }
    const asleep = !st.isAwake(cat);
    if (asleep) mood = 'sleep'; else if (cat.fuse && mood === 'idle') mood = 'grumpy';
    const glow = view.hintId === cat.id ? '#FFD93B' : cat.fuse && st.fuseLeft(cat) <= 2 ? 'rgba(240,60,70,0.85)' : null;
    drawCat(ctx, pts, u, view.coats.get(cat.id), { angle: cat.dir * Math.PI / 2, t: time, seed: cat.id * 3.1, mood, glow, alpha: asleep ? 0.78 : 1 });
    const hp = pts[pts.length - 1];
    if (asleep) badges.push([hp[0] + u * 0.3, hp[1] - u * 0.3, `${st.sleepLeft(cat)}`, '#6C63C7', 1, 'z']);
    else if (cat.fuse) badges.push([hp[0] + u * 0.3, hp[1] - u * 0.3, `${st.fuseLeft(cat)}`, '#E5383B', st.fuseLeft(cat) <= 2 ? 1 + 0.14 * Math.sin(time * 9) : 1]);
  }
  for (let i = view.ghosts.length - 1; i >= 0; i--) {
    const g = view.ghosts[i], e = time - g.t0;
    if (g.lure) {
      if (e > 0.45) { view.ghosts.splice(i, 1); continue; }
      const pts = g.spine.map(px).map((p) => [p[0], p[1] - e * u * 1.2]);
      drawCat(ctx, pts, u, g.coat, { angle: g.dir * Math.PI / 2, t: time, mood: 'happy', alpha: 1 - e / 0.45 });
      continue;
    }
    const s = 5 * e + 42 * e * e;
    if (s > g.dist) { view.ghosts.splice(i, 1); continue; }
    drawCat(ctx, windowPts(g.spine, g.dir, s), u, g.coat, { angle: g.dir * Math.PI / 2, t: time * 3, seed: g.id, mood: 'happy' });
  }
  for (const [x, y, text, fill, pulse, z] of badges) {
    drawBadge(ctx, x, y, u * 0.2, text, fill, pulse);
    if (z) { ctx.fillStyle = fill; ctx.font = `700 ${u * 0.26}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('z', x + u * 0.22, y - u * 0.2 - Math.sin(time * 2) * u * 0.04); }
  }
  // tutorial pointer on level 1
  if (view.mode === 'level' && view.n === 1 && st.status === 'play' && !view.auto && !modals.length) {
    const id = st.bestMove();
    if (id !== null && !view.anims.size) {
      const sp = view.spines.get(id); const m = px(sp[Math.floor(sp.length / 2)]);
      drawHand(m[0] + u * 0.25, m[1] + u * 0.45 + Math.sin(time * 5) * u * 0.08, u);
    }
  }
  ctx.restore();
  drawParticles(dt);
}

function rr(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawHand(x, y, u) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35);
  const ring = (time * 1.4) % 1;
  ctx.strokeStyle = `rgba(255,255,255,${1 - ring})`; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, -u * 0.3, u * (0.12 + ring * 0.3), 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#5A3526'; ctx.lineWidth = Math.max(2, u * 0.05); ctx.lineJoin = 'round';
  rr(-u * 0.1, -u * 0.3, u * 0.2, u * 0.5, u * 0.1); ctx.fill(); ctx.stroke();
  rr(-u * 0.24, u * 0.02, u * 0.5, u * 0.42, u * 0.14); ctx.fill(); ctx.stroke();
  ctx.fillRect(-u * 0.075, -u * 0.05, u * 0.15, u * 0.2);
  ctx.restore();
}

function onImpact(cat, anim) {
  const st = view.state;
  Sfx.bump(); haptic('heavy');
  view.shakes.set(anim.blocker, time); view.shakeUntil = time + 0.16;
  const hp = px([cat.cells[0][0] + DX[cat.dir] * (anim.steps + 0.5), cat.cells[0][1] + DY[cat.dir] * (anim.steps + 0.5)]);
  burst(hp[0], hp[1], 8, 'star');
  floatText(hp[0], hp[1] - view.L.u * 0.4, 'Bonk!', '#E5383B');
  refreshHud();
  const lostHeart = $('#g-hearts').children[st.hearts];
  if (lostHeart) { lostHeart.classList.remove('pop'); void lostHeart.offsetWidth; lostHeart.classList.add('pop'); }
  if (st.status === 'lost') { Sfx.fail(); endLater(850); }
}

// Home screen: cats strolling past behind the menu.
const walkers = [];
function drawParade(dt) {
  const u = Math.min(64, W / 7);
  if (walkers.length < 5) {
    const dir = Math.random() < 0.5 ? 1 : -1, len = 2.5 + Math.random() * 3.5;
    const lane = Math.floor(Math.random() * 5);
    if (!walkers.some((k) => k.lane === lane)) {
      walkers.push({ dir, len, lane, x: dir > 0 ? -len * u - u - Math.random() * 300 : W + len * u + u + Math.random() * 300, speed: 30 + Math.random() * 45, coat: coatById[save.coats[Math.floor(Math.random() * save.coats.length)]], seed: Math.random() * 100 });
    }
  }
  for (let i = walkers.length - 1; i >= 0; i--) {
    const k = walkers[i];
    k.x += k.dir * k.speed * dt;
    if ((k.dir > 0 && k.x - k.len * u > W + u) || (k.dir < 0 && k.x + k.len * u < -u)) { walkers.splice(i, 1); continue; }
    const y0 = H * 0.3 + k.lane * (H * 0.085);
    const pts = [];
    for (let s = 0; s <= k.len; s += 0.25) {
      const x = k.x - k.dir * (k.len - s) * u;
      pts.push([x, y0 + Math.sin(x / 34 + k.seed) * u * 0.1]);
    }
    drawCat(ctx, pts, u, k.coat, { t: time, seed: k.seed, mood: 'happy', alpha: 0.9 });
  }
}

let lastTs = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0); lastTs = ts; time = ts / 1000;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(ctx, W, H, theme(), time);
  if (screen === 'home') drawParade(dt);
  else if (view && view.L) drawGame(dt);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ win / lose
function coatPreview(cv, coat, mood = 'happy') {
  const r = Math.min(window.devicePixelRatio || 1, 3);
  const w = cv.clientWidth || 96, h = cv.clientHeight || 56;
  cv.width = w * r; cv.height = h * r;
  const c = cv.getContext('2d'); c.scale(r, r);
  const u = h * 0.78;
  drawCat(c, [[w / 2 - u * 0.75, h / 2 + 2], [w / 2 + u * 0.55, h / 2 + 2]], u, coat, { t: 1.3, seed: 2, mood });
}

function onWin() {
  const v = view, st = v.state;
  // Clip mode is an auto-player for recording videos: it must never award fish, stars or level progress.
  if (v.auto) { clipEnd(); return; }
  const stars = Math.max(1, Math.min(3, st.hearts));
  const notes = [];
  let fish = 0, title = ['Phew!', 'Nice one!', 'Purr-fect!'][stars - 1];
  save.stats.wins++; if (stars === 3) save.stats.perfect++;
  save.ads.winsSince++;
  if (v.mode === 'daily') {
    const t = v.day; // the puzzle's own day, so a solve that crosses midnight is credited correctly
    if (save.daily.lastDay < t) {
      save.daily.streak = save.daily.lastDay === t - 1 ? save.daily.streak + 1 : 1;
      save.daily.bestStreak = Math.max(save.daily.bestStreak, save.daily.streak);
      save.daily.lastDay = t;
      fish = dailyReward(save.daily.streak);
      notes.push(`<div class="note">${ic('cal')}<span><b>${save.daily.streak} day streak!</b><br>Come back tomorrow to keep it going.</span></div>`);
    } else notes.push('<div class="note"><span>Already solved today. This one was just for fun.</span></div>');
    title = 'Daily solved!';
  } else if (v.n === save.level) {
    fish = (ECON.winBase + ECON.winPerHeart * st.hearts) * (v.def.params.boss ? ECON.bossMult : 1);
    save.starsTotal += stars;
    if (v.n % 10 === 0) {
      fish += ECON.chapterChest; save.hints++;
      notes.push(`<div class="note">${ic('chest')}<span><b>Chapter ${v.n / 10} complete!</b><br>Chest: +${ECON.chapterChest} fish and a free hint.</span></div>`);
    }
    else {
      const left = 10 - (v.n % 10);
      notes.push(`<p class="next-chest">${ic('chest')}<span>${left === 1 ? 'Next level opens' : `${left} more levels to`} the chapter chest</span></p>`);
    }
    const unlock = COATS.find((c) => c.level === v.n && !save.coats.includes(c.id));
    if (unlock) {
      save.coats.push(unlock.id);
      notes.push(`<div class="note"><canvas data-coat="${unlock.id}"></canvas><span><b>New cat: ${unlock.name}!</b><br>It will show up in your levels.</span></div>`);
    }
    save.level++;
  }
  save.fish += fish;
  persist(save, true);
  const m = modal(`
    <h2>${title}</h2>
    <div class="stars">${[0, 1, 2].map((i) => `<svg class="${i < stars ? 'on' : ''}" style="animation-delay:${0.15 + i * 0.22}s"><use href="#i-star"/></svg>`).join('')}</div>
    ${fish ? `<div class="reward">${ic('fish')}<span data-reward>+${fish}</span></div>` : ''}
    ${notes.join('')}
    <div class="btn-col">
      ${fish ? `<button class="btn gold" data-act="double">${ic('video')}<span>Double it<br><span class="sub">watch a short video</span></span></button>` : ''}
      <button class="btn primary" data-act="next">${v.mode === 'daily' ? 'Home' : `Next level`}</button>
    </div>`, { dismiss: false });
  for (let i = 0; i < stars; i++) setTimeout(() => Sfx.star(i), 200 + i * 220);
  m.el.querySelectorAll('canvas[data-coat]').forEach((cv) => coatPreview(cv, coatById[cv.dataset.coat]));
  refreshFish(true);
  on(m, 'double', async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    const r = await Platform.rewarded('double');
    if (r === 'granted') { addFish(fish); $('[data-reward]', m.el).textContent = `+${fish * 2}`; btn.remove(); Sfx.buy(); }
    else { btn.disabled = false; toast(r === 'unavailable' ? 'No video available right now' : 'Watch the full video to double it'); }
  });
  on(m, 'next', async () => {
    closeModal(m);
    if (v.mode === 'daily') { show('home'); return; }
    await maybeInterstitial();
    startGame('level');
  });
}

async function maybeInterstitial() {
  if (save.noAds || save.level < ECON.interstitialFromLevel) return;
  if (save.ads.winsSince < ECON.interstitialEveryWins) return;
  if (Date.now() - save.ads.lastAt < ECON.interstitialMinGapSec * 1000) return;
  save.ads.winsSince = 0; save.ads.lastAt = Date.now(); persist(save);
  suspendAudio();
  await Platform.interstitial();
  unlockAudio();
}

function onLose() {
  const v = view, st = v.state;
  if (v.auto) { startClip({ level: v.n, daily: v.mode === 'daily' }); return; }
  const fuse = st.lostReason === 'fuse';
  const m = modal(`
    <h2>${fuse ? 'Too slow!' : 'Out of hearts!'}</h2>
    <p>${fuse ? 'The grumpy cat ran out of patience.' : 'Three bumps and the cats got cranky.'}</p>
    <div class="btn-col">
      ${!v.usedContinue ? `<button class="btn green" data-act="cont">${ic('video')}<span>Keep going<br><span class="sub">${fuse ? '+3 patience' : '+1 heart'} · watch a short video</span></span></button>` : ''}
      <button class="btn primary" data-act="retry">Try again</button>
      <button class="btn ghost" data-act="home">Home</button>
    </div>`, { dismiss: false });
  on(m, 'cont', async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    const r = await Platform.rewarded('continue');
    if (r === 'granted') {
      v.usedContinue = true; st.revive(); v.ended = false; closeModal(m); refreshHud(); Sfx.hint();
    } else { btn.disabled = false; toast(r === 'unavailable' ? 'No video available right now' : 'Watch the full video to keep going'); }
  });
  on(m, 'retry', () => { closeModal(m); restart(); });
  on(m, 'home', () => { closeModal(m); show('home'); });
}

function restart() { if (view) startGame(view.mode, { level: view.n, clip: view.auto }); }

// ------------------------------------------------------------------ boosters
function useHint() {
  if (!view || view.state.status !== 'play') return;
  if (view.hintId !== null) return;
  if (view.state.bestMove() === null) { toast('No cat can move yet. Try a treat!'); return; }
  const go = () => { view.hintId = view.state.bestMove(); Sfx.hint(); refreshHud(); };
  if (save.hints > 0) { save.hints--; persist(save); go(); return; }
  const m = modal(`
    <h2>Need a hint?</h2><p>A hint lights up a cat that can leave right now.</p>
    <div class="btn-col">
      <button class="btn green" data-act="ad">${ic('video')}<span>Free hint<br><span class="sub">watch a short video</span></span></button>
      <button class="btn gold" data-act="buy" ${save.fish < ECON.hintPack.cost ? 'disabled' : ''}>${ic('fish')}<span>${ECON.hintPack.n} hints for ${ECON.hintPack.cost}</span></button>
    </div>`);
  on(m, 'ad', async (e) => {
    e.currentTarget.disabled = true;
    const r = await Platform.rewarded('hint');
    if (r === 'granted') { closeModal(m); go(); } else { e.target.closest('button').disabled = false; toast('No video available right now'); }
  });
  on(m, 'buy', () => { if (spend(ECON.hintPack.cost)) { save.hints += ECON.hintPack.n - 1; persist(save); closeModal(m); go(); } });
}

function useLure() {
  if (!view || view.state.status !== 'play') return;
  if (view.lureMode) { view.lureMode = false; refreshHud(); coach(); return; }
  if (save.lures > 0) { view.lureMode = true; view.hintId = null; refreshHud(); coach(); return; }
  const m = modal(`
    <h2>Out of treats</h2><p>A treat tempts <b>any</b> cat off the board, even a blocked one.</p>
    <div class="btn-col"><button class="btn gold" data-act="buy" ${save.fish < ECON.lureCost ? 'disabled' : ''}>${ic('fish')}<span>1 treat for ${ECON.lureCost}</span></button>
    <button class="btn ghost" data-act="shop">Get more fish</button></div>`);
  on(m, 'buy', () => { if (spend(ECON.lureCost)) { save.lures++; persist(save); closeModal(m); useLure(); } });
  on(m, 'shop', () => { closeModal(m); openShop(); });
}

// ------------------------------------------------------------------ collection
function openCats(tab = 'cats') {
  const render = () => {
    const body = tab === 'cats'
      ? `<div class="grid">${COATS.map((c) => {
          const own = save.coats.includes(c.id);
          const foot = own ? `<small class="owned">${ic('check')} In your levels</small>`
            : c.level ? `<small>${ic('lock')} Reach level ${c.level + 1}</small>`
            : `<button class="btn green mini" data-buy="${c.id}" ${save.fish < c.cost ? 'disabled' : ''}>${ic('fish')}${c.cost}</button>`;
          return `<div class="card ${own ? '' : 'locked'}"><canvas data-coat="${c.id}"></canvas>${c.name}${foot}</div>`;
        }).join('')}</div>`
      : `<div class="grid">${THEMES.map((t) => {
          const own = save.themes.includes(t.id);
          const foot = own ? `<button class="btn green mini ${save.theme === t.id ? 'sel' : ''}" data-theme="${t.id}">${save.theme === t.id ? 'Selected' : 'Use'}</button>`
            : `<button class="btn green mini" data-buyt="${t.id}" ${save.fish < t.cost ? 'disabled' : ''}>${ic('fish')}${t.cost}</button>`;
          return `<div class="card"><div class="swatch" style="background:linear-gradient(${t.bg[0]},${t.bg[1]});border:6px solid ${t.panel}"></div>${t.name}${foot}</div>`;
        }).join('')}</div>`;
    m.el.innerHTML = `<button class="x" data-close>${ic('close')}</button><h2>Collection</h2>
      <p>${save.stats.cats.toLocaleString()} cats sent home · ${save.coats.length}/${COATS.length} coats</p>
      <div class="tabs"><button data-tab="cats" class="${tab === 'cats' ? 'on' : ''}">Cats</button><button data-tab="rooms" class="${tab === 'rooms' ? 'on' : ''}">Rooms</button></div>${body}`;
    m.el.querySelectorAll('canvas[data-coat]').forEach((cv) => coatPreview(cv, coatById[cv.dataset.coat], save.coats.includes(cv.dataset.coat) ? 'happy' : 'sleep'));
  };
  const m = modal('', { onClose: refreshHome });
  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tab) { tab = b.dataset.tab; render(); }
    else if (b.dataset.buy) { const c = coatById[b.dataset.buy]; if (spend(c.cost)) { save.coats.push(c.id); persist(save, true); Sfx.buy(); toast(`${c.name} joined your cats!`); render(); } }
    else if (b.dataset.buyt) { const t = THEMES.find((k) => k.id === b.dataset.buyt); if (spend(t.cost)) { save.themes.push(t.id); save.theme = t.id; persist(save, true); applyTheme(); Sfx.buy(); render(); } }
    else if (b.dataset.theme) { save.theme = b.dataset.theme; persist(save); applyTheme(); render(); }
  });
  render();
}

// ------------------------------------------------------------------ shop
function grant(sku, token) {
  const p = PRODUCTS.find((k) => k.sku === sku);
  if (!p) return;
  if (token) { if (save.orders.includes(token)) return; save.orders.push(token); save.orders = save.orders.slice(-60); }
  if (p.kind === 'entitlement') save.noAds = true;
  if (p.fish) save.fish += p.fish;
  if (p.hints) save.hints += p.hints;
  if (p.lures) save.lures += p.lures;
  persist(save, true); refreshFish(true); refreshHud(); Sfx.buy();
  toast(p.kind === 'entitlement' ? 'Ads removed. Thank you!' : `${p.title} added. Thank you!`);
}
Platform.on('purchase', (d) => grant(d.sku, d.token));
Platform.on('owned', (d) => { if (Array.isArray(d.owned) && d.owned.includes('remove_ads') && !save.noAds) { save.noAds = true; persist(save, true); } });

function openShop() {
  const t = today();
  if (save.freeFish.day !== t) save.freeFish = { day: t, used: 0 };
  const render = () => {
    const leftFree = ECON.freeFishPerDay - save.freeFish.used;
    m.el.innerHTML = `<button class="x" data-close>${ic('close')}</button><h2>Shop</h2>
      <div class="list">
        <div class="h3">Free</div>
        <div class="item">${ic('fish')}<div>+${ECON.freeFish} fish<small>${leftFree} left today</small></div><button class="btn blue" data-free ${leftFree <= 0 ? 'disabled' : ''}>${ic('video')}Watch</button></div>
        <div class="h3">Boosters</div>
        <div class="item"><svg style="color:#F5A70B"><use href="#i-bulb"/></svg><div>${ECON.hintPack.n} hints<small>You have ${save.hints}</small></div><button class="btn gold" data-hints ${save.fish < ECON.hintPack.cost ? 'disabled' : ''}>${ic('fish')}${ECON.hintPack.cost}</button></div>
        <div class="item"><svg style="color:#E06C9F"><use href="#i-treat"/></svg><div>1 treat<small>You have ${save.lures}</small></div><button class="btn gold" data-lure ${save.fish < ECON.lureCost ? 'disabled' : ''}>${ic('fish')}${ECON.lureCost}</button></div>
        <div class="h3">Support the game</div>
        ${PRODUCTS.map((p) => {
          const owned = p.kind === 'entitlement' && save.noAds;
          return `<div class="item">${p.kind === 'entitlement' ? '<svg style="color:#F2506E"><use href="#i-heart"/></svg>' : ic('fish')}<div>${p.title}<small>${p.desc}</small></div>
            <button class="btn green" data-sku="${p.sku}" ${owned ? 'disabled' : ''}>${owned ? 'Owned' : prices[p.sku] || p.price}</button></div>`;
        }).join('')}
      </div>
      <p class="fine">Purchases are optional. Every level can be finished without them.</p>`;
  };
  const m = modal('', { onClose: () => { refreshHome(); refreshHud(); } });
  m.el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.free !== undefined) {
      b.disabled = true;
      const r = await Platform.rewarded('freefish');
      if (r === 'granted') { save.freeFish.used++; addFish(ECON.freeFish); persist(save, true); } else toast('No video available right now');
      render();
    } else if (b.dataset.hints !== undefined) { if (spend(ECON.hintPack.cost)) { save.hints += ECON.hintPack.n; persist(save, true); Sfx.buy(); render(); } }
    else if (b.dataset.lure !== undefined) { if (spend(ECON.lureCost)) { save.lures++; persist(save, true); Sfx.buy(); render(); } }
    else if (b.dataset.sku) {
      b.disabled = true;
      const r = await Platform.purchase(b.dataset.sku);
      if (r.ok) grant(b.dataset.sku, r.token);
      else if (r.reason === 'unavailable') toast('The store is not available on this device');
      else if (r.reason && r.reason !== 'cancelled' && r.reason !== 'delivered') toast('Purchase did not go through');
      render();
    }
  });
  render();
}

// ------------------------------------------------------------------ settings
function openSettings() {
  const m = modal(`<h2>Settings</h2>
    <div class="list">
      <div class="item"><div>Sound</div><button class="toggle ${save.settings.sound ? 'on' : ''}" data-act="sound" aria-label="Sound"></button></div>
      <div class="item"><div>Vibration</div><button class="toggle ${save.settings.haptics ? 'on' : ''}" data-act="haptics" aria-label="Vibration"></button></div>
      <div class="item"><div>Restore purchases</div><button class="btn blue" data-act="restore">Restore</button></div>
      <div class="item"><div>Clip mode<small>Auto-plays your level with a clean screen, for recording videos</small></div><button class="btn blue" data-act="clip">Play</button></div>
      <div class="item"><div>Privacy</div><button class="btn blue" data-act="privacy">Open</button></div>
      ${Platform.isNative ? '<div class="item"><div>Ad choices</div><button class="btn blue" data-act="consent">Manage</button></div>' : ''}
    </div>
    <button class="btn ghost" data-act="reset">Reset all progress</button>
    <p class="fine">Catangle v${VERSION}</p>`);
  on(m, 'sound', (e) => { save.settings.sound = !save.settings.sound; setSound(save.settings.sound); e.currentTarget.classList.toggle('on'); persist(save); });
  on(m, 'haptics', (e) => { save.settings.haptics = !save.settings.haptics; e.currentTarget.classList.toggle('on'); persist(save); haptic('medium'); });
  on(m, 'restore', async () => {
    const info = await Platform.storeInfo();
    if (info.owned && info.owned.includes('remove_ads')) { save.noAds = true; persist(save, true); toast('Purchases restored'); } else toast('Nothing to restore');
  });
  on(m, 'clip', () => { closeModal(m); startClip({ level: save.level }); });
  on(m, 'privacy', () => Platform.openUrl(PRIVACY_URL));
  on(m, 'consent', () => Platform.privacyOptions());
  on(m, 'reset', () => {
    const c = modal(`<h2>Reset everything?</h2><p>Your levels, fish and cats will be erased. Purchases can be restored afterwards.</p>
      <div class="btn-col"><button class="btn primary" data-act="yes">Erase my progress</button><button class="btn ghost" data-close>Keep playing</button></div>`);
    on(c, 'yes', () => { const noAds = save.noAds; wipeSave(); save = loadSave(); save.noAds = noAds; persist(save, true); setSound(true); applyTheme(); closeModal(c); closeModal(m); show('home'); });
  });
}

// ------------------------------------------------------------------ clip mode (short-form video capture)
// Auto-plays a level with a clean screen. URL form: ?clip=45&caption=Only+1%25+spot+it&fails=1
function startClip({ level, caption = '', fails = 0, daily = false }) {
  document.body.classList.add('clip');
  startGame(daily ? 'daily' : 'level', { level, clip: true });
  view.auto = true; coach();
  document.querySelectorAll('.clip-caption, .endcard').forEach((e) => e.remove());
  if (caption) { const c = document.createElement('div'); c.className = 'clip-caption'; c.textContent = caption; document.body.appendChild(c); }
  const v = view; let failsLeft = fails, moves = 0;
  const step = () => {
    if (view !== v || !v.auto) return;
    const st = v.state;
    if (st.status !== 'play') return;
    if (v.anims.size) { setTimeout(step, 120); return; }
    let id = st.bestMove();
    if (failsLeft > 0 && moves === 2 && st.hearts > 1) { // a deliberate bonk makes a better hook
      const blocked = [...st.cats.values()].find((c) => st.isAwake(c) && st.ray(c).blocker >= 0 && st.ray(c).steps >= 1);
      if (blocked) { id = blocked.id; failsLeft--; moves--; }
    }
    moves++;
    v.auto = false; tapCat(id); v.auto = true;
    const total = st.total, done = st.removed;
    setTimeout(step, Math.max(150, 620 - 470 * (done / total) ** 0.7));
  };
  setTimeout(step, caption ? 1500 : 800);
}
function clipEnd() {
  setTimeout(() => {
    const e = document.createElement('div'); e.className = 'endcard';
    e.innerHTML = '<div class="logo"><h1><span>Cat</span><span>angle</span></h1></div><p>Free on Google Play</p>';
    document.body.appendChild(e);
    e.addEventListener('click', stopClip);
  }, 1300);
}
function stopClip() {
  document.body.classList.remove('clip');
  document.querySelectorAll('.clip-caption, .endcard').forEach((e) => e.remove());
  show('home');
}

// ------------------------------------------------------------------ wiring
function leaveGame() {
  if (view && view.auto) { stopClip(); return; }
  show('home');
}
$('#btn-play').addEventListener('click', () => { unlockAudio(); Sfx.click(); startGame('level'); });
$('#btn-daily').addEventListener('click', () => { unlockAudio(); Sfx.click(); startGame('daily'); });
$('#btn-cats').addEventListener('click', () => { unlockAudio(); Sfx.click(); openCats(); });
$('#btn-shop').addEventListener('click', () => { unlockAudio(); Sfx.click(); openShop(); });
$('#home-fish').addEventListener('click', () => { unlockAudio(); Sfx.click(); openShop(); });
$('#game-fish').addEventListener('click', () => { Sfx.click(); openShop(); });
$('#btn-settings').addEventListener('click', () => { unlockAudio(); Sfx.click(); openSettings(); });
$('#btn-home').addEventListener('click', () => { Sfx.click(); leaveGame(); });
$('#btn-hint').addEventListener('click', () => { Sfx.click(); useHint(); });
$('#btn-lure').addEventListener('click', () => { Sfx.click(); useLure(); });
$('#btn-restart').addEventListener('click', () => { Sfx.click(); restart(); });

// Android back button
window.__back = () => {
  const top = modals[modals.length - 1];
  if (top) { if (top.dismiss) closeModal(top); return; }
  if (screen === 'game') { leaveGame(); return; }
  Platform.exit();
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { persist(save, true); suspendAudio(); } else if (save.settings.sound) unlockAudio();
});
window.addEventListener('pagehide', () => persist(save, true));

// Test/automation hooks (used by tests/e2e.mjs; harmless in production).
window.__catangle = {
  get save() { return save; }, get view() { return view; },
  best: () => (view ? view.state.bestMove() : null),
  blocked: () => { if (!view) return null; const st = view.state; const c = [...st.cats.values()].find((k) => st.isAwake(k) && st.ray(k).blocker >= 0); return c ? c.id : null; },
  point: (id) => { const c = view.state.cats.get(id); const p = px(c.cells[Math.min(1, c.cells.length - 1)]); return { x: p[0], y: p[1] }; },
  setSave: (patch) => { Object.assign(save, patch); persist(save, true); applyTheme(); refreshHome(); },
  startClip,
};

async function boot() {
  resize(); applyTheme(); refreshHome();
  try { await document.fonts.load('600 20px Fredoka'); } catch (e) { /* fall back to system font */ }
  requestAnimationFrame(frame);
  Platform.ready();
  Platform.storeInfo().then((info) => {
    prices = info.prices || {};
    if (info.owned && info.owned.includes('remove_ads')) { save.noAds = true; persist(save); }
  });
  if (params.has('clip')) startClip({ level: Number(params.get('clip')) || save.level, caption: params.get('caption') || '', fails: Number(params.get('fails')) || 0, daily: params.get('clip') === 'daily' });
}
boot();
