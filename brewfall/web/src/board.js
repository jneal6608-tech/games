// The cauldron: canvas rendering, pointer input and the physics loop for one brew.
import { World, W, H, RADII, LINE_Y, DROP_Y } from './physics.js';
import * as D from './data.js';
import { sfx } from './audio.js';
import { native } from './platform.js';

const PAD = 8, CW = W + PAD * 2, CH = H + PAD * 2;
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = k < 0 ? 0 : 255, a = Math.abs(k); r = Math.round(r + (f - r) * a); g = Math.round(g + (f - g) * a); b = Math.round(b + (f - b) * a); return `rgb(${r},${g},${b})`; };

const spriteCache = {};
// Each essence is drawn once per skin into an offscreen canvas: glossy orb + a little face.
export function orbSprite(tier, skin) {
  const key = skin.id + ':' + tier; if (spriteCache[key]) return spriteCache[key];
  const r = RADII[tier], S = 2, size = Math.ceil((r + 3) * 2 * S), c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.scale(S, S); g.translate(r + 3, r + 3);
  const col = skin.colors[tier - 1];
  const grad = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r); grad.addColorStop(0, shade(col, 0.55)); grad.addColorStop(0.55, col); grad.addColorStop(1, shade(col, -0.35));
  g.fillStyle = grad; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.lineWidth = Math.max(1.5, r * 0.06); g.strokeStyle = shade(col, -0.55); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-r * 0.38, -r * 0.48, r * 0.22, r * 0.12, -0.6, 0, 7); g.fill();
  // face
  const ink = shade(col, -0.75), ex = r * 0.3, ey = -r * 0.05, er = Math.max(1.6, r * 0.09);
  g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = Math.max(1.4, r * 0.06); g.lineCap = 'round';
  const mood = tier % 5;
  if (mood === 3) { g.beginPath(); g.moveTo(-ex - er, ey); g.lineTo(-ex + er, ey); g.moveTo(ex - er, ey); g.lineTo(ex + er, ey); g.stroke(); } // sleepy
  else if (mood === 4) { g.beginPath(); g.arc(-ex, ey, er, 0, 7); g.fill(); g.beginPath(); g.arc(ex, ey + er * 0.3, er * 1.1, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } // wink
  else { g.beginPath(); g.arc(-ex, ey, er, 0, 7); g.arc(ex, ey, er, 0, 7); g.fill(); if (r > 24) { g.fillStyle = '#fff'; g.beginPath(); g.arc(-ex + er * 0.3, ey - er * 0.3, er * 0.35, 0, 7); g.arc(ex + er * 0.3, ey - er * 0.3, er * 0.35, 0, 7); g.fill(); } }
  g.beginPath();
  if (mood === 2) g.arc(0, r * 0.28, r * 0.08, 0, 7); // 'o'
  else if (mood === 0) { g.moveTo(-r * 0.14, r * 0.25); g.lineTo(r * 0.14, r * 0.25); } // flat
  else g.arc(0, r * 0.14, r * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); // smile
  g.stroke();
  if (tier >= 7) { g.fillStyle = 'rgba(255,150,170,.45)'; g.beginPath(); g.arc(-r * 0.5, r * 0.18, r * 0.09, 0, 7); g.arc(r * 0.5, r * 0.18, r * 0.09, 0, 7); g.fill(); }
  return (spriteCache[key] = c);
}

export class Board {
  // hooks: { onScore(ev), onChange(), onEnd(result, reason), onTutorial(key) }
  constructor(canvas, run, cosmetics, hooks) {
    this.cv = canvas; this.g = canvas.getContext('2d'); this.run = run; this.hooks = hooks; this.skin = cosmetics.skin; this.theme = cosmetics.theme;
    this.world = new World(); this.world.load(run.bodies);
    this.aimX = W / 2; this.idleT = 0; this.aiming = false; this.cool = 0; this.fx = []; this.texts = []; this.ended = false; this.endT = -1; this.lostT = 0; this.paused = false; this.shakeT = 0; this.t = 0; this.acc = 0; this.last = 0; this.raf = 0;
    this.resize = this.resize.bind(this); this.frame = this.frame.bind(this);
    canvas.addEventListener('pointerdown', e => { if (this.paused || this.ended) return; this.aiming = true; this.setAim(e); try { canvas.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); });
    canvas.addEventListener('pointermove', e => { if (this.aiming) this.setAim(e); });
    const up = e => { if (!this.aiming) return; this.aiming = false; this.setAim(e); this.drop(); };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', () => { this.aiming = false; });
    window.addEventListener('resize', this.resize); this.resize(); this.applyCharms();
    this.raf = requestAnimationFrame(this.frame);
  }
  destroy() { cancelAnimationFrame(this.raf); window.removeEventListener('resize', this.resize); this.dead = true; }
  applyCharms() { this.world.magnet = this.run.has('magnet') ? D.CHARM.magnet.magnet : 0; this.limit = 2.5 * (this.run.has('deep') ? 2 : 1); }
  resize() {
    const box = this.cv.parentElement.getBoundingClientRect(); if (!box.width) return;
    const k = Math.min(box.width / CW, box.height / CH), dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.style.width = Math.floor(CW * k) + 'px'; this.cv.style.height = Math.floor(CH * k) + 'px';
    this.cv.width = Math.floor(CW * k * dpr); this.cv.height = Math.floor(CH * k * dpr); this.k = k * dpr;
  }
  bounds() { const r = RADII[this.run.queue[0]] || 14; return this.run.hex === 'narrow' ? [Math.max(r, W * 0.25), Math.min(W - r, W * 0.75)] : [r, W - r]; }
  setAim(e) { const b = this.cv.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width * CW - PAD; const [lo, hi] = this.bounds(); this.aimX = Math.max(lo, Math.min(hi, x)); }
  drop() {
    const run = this.run; if (this.paused || this.ended || this.cool > 0 || run.dropsLeft <= 0 || run.phase !== 'round' || run.reached) return false;
    const [lo, hi] = this.bounds(); this.aimX = Math.max(lo, Math.min(hi, this.aimX));
    const t = run.drop(); if (!t) return false;
    this.world.add(t, this.aimX, DROP_Y); this.cool = 0.42; this.lostT = 0; sfx('drop'); native.haptic(8);
    this.hooks.onChange(); this.hooks.onTutorial('dropped'); return true;
  }
  useTonic(i) {
    const id = this.run.tonics[i]; if (!id || this.ended || this.paused) return false;
    if (!this.run.useTonic(i, this.world)) return false;
    sfx('tonic'); native.haptic(20); this.shakeT = id === 'stir' ? 0.4 : 0.15; this.lostT = 0;
    this.say(W / 2, H / 2, D.TONIC[id].name + '!', '#9ff', 22); this.hooks.onChange(); return true;
  }
  say(x, y, text, color = '#fff', size = 16) { this.texts.push({ x: Math.max(40, Math.min(W - 40, x)), y, text, color, size, t: 0 }); }
  burst(x, y, color, n = 10) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 160; this.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, t: 0, life: 0.45 + Math.random() * 0.3, color }); } if (this.fx.length > 260) this.fx.splice(0, this.fx.length - 260); }
  onMerge(e) {
    const run = this.run, res = run.merge(e.tier, this.world.bodies.length); if (!res) return; this.idleT = 0;
    const col = this.skin.colors[Math.min(10, e.tier) - 1];
    this.burst(e.x, e.y, col, 8 + e.tier * 2); sfx('merge', e.tier, res.chain); native.haptic(Math.min(30, 6 + e.tier * 2));
    if (res.gain > 0) this.say(e.x, e.y - 8, '+' + fmt(res.gain), res.lucky ? '#ffe36b' : '#fff', Math.min(30, 15 + e.tier * 1.4));
    if (res.chain >= 2) this.say(e.x, e.y - 34, 'Chain x' + res.chain, '#ffb86b', 14);
    if (res.sparks) this.say(e.x, e.y + 16, '+' + res.sparks + ' Sparks', '#ffd24d', 13);
    if (res.refund) this.say(e.x, e.y + 32, '+1 drop', '#9ff', 13);
    if (e.tier >= 7) this.shakeT = 0.25;
    if (e.tier === 11) { this.say(W / 2, H / 2, 'GRAND ELIXIR!', '#ffe36b', 30); this.burst(e.x, e.y, '#fff', 50); }
    this.hooks.onScore(res); this.hooks.onTutorial('merged');
  }
  frame(ts) {
    if (this.dead) return; this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (ts - (this.last || ts)) / 1000); this.last = ts;
    if (!this.paused) { this.acc += dt; let n = 0; while (this.acc >= 1 / 60 && n++ < 4) { this.acc -= 1 / 60; this.tick(1 / 60); } if (n >= 4) this.acc = 0; }
    this.draw();
  }
  tick(dt) {
    this.t += dt; this.cool = Math.max(0, this.cool - dt); this.shakeT = Math.max(0, this.shakeT - dt);
    this.world.step(dt, e => this.onMerge(e));
    for (const p of this.fx) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; }
    this.fx = this.fx.filter(p => p.t < p.life);
    for (const s of this.texts) { s.t += dt; s.y -= 34 * dt; } this.texts = this.texts.filter(s => s.t < 1.1);
    if (this.ended) return;
    const run = this.run;
    if (run.reached) { if (this.endT < 0) { this.endT = 0.9; sfx('win'); native.haptic(40); } this.endT -= dt; if (this.endT <= 0) this.finish('won'); return; }
    if (this.world.overT > this.limit) return this.finish('lost', 'overflow');
    if (this.world.overT > 0.4 && Math.floor(this.t * 3) !== Math.floor((this.t - dt) * 3)) sfx('warn');
    if (run.dropsLeft <= 0) { // out of drops: end once the cauldron is calm, or after 4s without a merge even if something is still wobbling
      this.idleT += dt; if (this.world.settled()) this.lostT += dt; else this.lostT = Math.max(0, this.lostT - dt * 0.5);
      if (this.lostT > 1.1 || this.idleT > 4) this.finish('lost', 'drops');
    } else this.idleT = 0;
  }
  finish(result, reason) { this.ended = true; this.run.bodies = this.world.serialize(); if (result === 'lost') sfx('lose'); this.hooks.onEnd(result, reason); }
  snapshot() { this.run.bodies = this.world.serialize(); }
  // After a revive the run is live again with an empty cauldron.
  revive() { this.world.clear(); this.idleT = 0; this.ended = false; this.endT = -1; this.lostT = 0; this.cool = 0.3; }
  draw() {
    const g = this.g, k = this.k, run = this.run, th = this.theme; if (!k) return;
    g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, CW, CH);
    const sx = this.shakeT > 0 ? (Math.random() - 0.5) * 8 * this.shakeT * 3 : 0;
    g.save(); g.translate(PAD + sx, PAD);
    // cauldron body
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, th.bg[0]); bg.addColorStop(1, th.bg[1]);
    rr(g, -4, 0, W + 8, H + 4, 22); g.fillStyle = bg; g.fill(); g.lineWidth = 5; g.strokeStyle = th.rim; g.stroke();
    g.save(); rr(g, 0, 0, W, H, 18); g.clip();
    // soft bubbles in the background
    g.fillStyle = 'rgba(255,255,255,.035)'; for (let i = 0; i < 7; i++) { const bx = (i * 67 + 30) % W, by = H - ((this.t * (14 + i * 3) + i * 90) % (H - LINE_Y)); g.beginPath(); g.arc(bx, by, 5 + (i % 3) * 4, 0, 7); g.fill(); }
    // boil-over line
    const danger = Math.min(1, this.world.overT / this.limit);
    g.setLineDash([8, 7]); g.lineWidth = 2; g.strokeStyle = danger > 0 ? `rgba(255,${Math.round(120 - danger * 90)},90,${0.5 + 0.5 * Math.abs(Math.sin(this.t * 9))})` : 'rgba(255,255,255,.22)';
    g.beginPath(); g.moveTo(0, LINE_Y); g.lineTo(W, LINE_Y); g.stroke(); g.setLineDash([]);
    if (danger > 0) { g.fillStyle = `rgba(255,70,70,${danger * 0.25})`; g.fillRect(0, 0, W, LINE_Y); }
    if (run.hex === 'narrow') { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W * 0.25, LINE_Y); g.fillRect(W * 0.75, 0, W * 0.25, LINE_Y); }
    // essences
    for (const b of this.world.bodies) {
      const sp = orbSprite(b.tier, this.skin), s = b.r / b.rT, d = (b.rT + 3) * 2 * s;
      g.save(); g.translate(b.x, b.y); g.rotate(b.rot); g.drawImage(sp, -d / 2, -d / 2, d, d); g.restore();
    }
    // the essence waiting to be poured
    if (!this.ended && run.dropsLeft > 0 && !run.reached) {
      const t = run.queue[0], r = RADII[t], a = this.cool > 0 ? 0.35 : 1;
      g.globalAlpha = a * 0.5; g.strokeStyle = th.glow; g.lineWidth = 2; g.setLineDash([3, 9]); g.beginPath(); g.moveTo(this.aimX, DROP_Y + r); g.lineTo(this.aimX, H); g.stroke(); g.setLineDash([]);
      g.globalAlpha = a; const sp = orbSprite(t, this.skin), d = (r + 3) * 2; g.drawImage(sp, this.aimX - d / 2, DROP_Y - d / 2, d, d); g.globalAlpha = 1;
    }
    for (const p of this.fx) { g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, 3.2, 0, 7); g.fill(); } g.globalAlpha = 1;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const s of this.texts) { g.globalAlpha = Math.min(1, (1.1 - s.t) * 2.2); g.font = `900 ${s.size}px system-ui,sans-serif`; g.lineWidth = 4; g.strokeStyle = 'rgba(20,10,40,.85)'; g.strokeText(s.text, s.x, s.y); g.fillStyle = s.color; g.fillText(s.text, s.x, s.y); } g.globalAlpha = 1;
    g.restore(); g.restore();
  }
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export function fmt(n) { n = Math.floor(n); if (n < 10000) return n.toLocaleString('en-US'); const u = ['K', 'M', 'B', 'T']; let i = -1; while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; } return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + u[i]; }
