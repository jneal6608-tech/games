// Position-based circle physics for the cauldron. No dependencies; stable for stacks of ~100 orbs.
export const W = 360, H = 500, LINE_Y = 84, DROP_Y = 44;
export const RADII = [0, 14, 20, 27, 35, 45, 57, 71, 87, 105, 124];
export const MAX_TIER = 10;

export class World {
  constructor() { this.bodies = []; this.nextId = 1; this.gravity = 1500; this.bounce = 0; this.magnet = 0; this.overT = 0; this.time = 0; }
  add(tier, x, y, vx = 0, vy = 0) {
    const r = RADII[tier];
    const b = { id: this.nextId++, tier, r, rT: r, x: Math.max(r, Math.min(W - r, x)), y, vx, vy, px: 0, py: 0, age: 0, rot: 0, born: 0 };
    this.bodies.push(b); return b;
  }
  remove(b) { const i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1); }
  clear() { this.bodies.length = 0; this.overT = 0; }
  // Advance by dt seconds. Returns merge events [{tier,x,y}] (tier = resulting tier; MAX_TIER+1 = two top orbs vanished).
  step(dt, onMerge) {
    const SUB = 4, h = dt / SUB, bs = this.bodies;
    for (let s = 0; s < SUB; s++) {
      if (this.magnet) this._magnet(h);
      for (const b of bs) {
        if (b.r < b.rT) b.r = Math.min(b.rT, b.r + b.rT * h * 4); // merged essences swell into place instead of exploding outward
        b.vy += this.gravity * h;
        const sp = Math.hypot(b.vx, b.vy), mx = 1400;
        if (sp > mx) { b.vx *= mx / sp; b.vy *= mx / sp; }
        b.px = b.x; b.py = b.y; b.x += b.vx * h; b.y += b.vy * h;
      }
      for (let it = 0; it < 3; it++) {
        for (let i = 0; i < bs.length; i++) {
          const a = bs[i];
          for (let j = i + 1; j < bs.length; j++) {
            const b = bs[j]; const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
            const d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr) continue;
            let d = Math.sqrt(d2), nx, ny;
            if (d < 1e-4) { nx = 0; ny = -1; d = 0; } else { nx = dx / d; ny = dy / d; }
            const pen = rr - d, ma = a.r * a.r, mb = b.r * b.r, wa = mb / (ma + mb), wb = ma / (ma + mb);
            a.x -= nx * pen * wa; a.y -= ny * pen * wa; b.x += nx * pen * wb; b.y += ny * pen * wb;
            a.touch = b.touch = true;
          }
        }
        for (const b of bs) {
          if (b.x < b.r) b.x = b.r; else if (b.x > W - b.r) b.x = W - b.r;
          if (b.y > H - b.r) { b.y = H - b.r; b.touch = true; }
        }
      }
      for (const b of bs) {
        let vx = (b.x - b.px) / h, vy = (b.y - b.py) / h;
        if (b.touch) { vx *= 0.985; vy *= 0.995; }
        const sp2 = Math.hypot(vx, vy); if (sp2 > 620 && sp2 > Math.hypot(b.vx, b.vy) + 1) { vx *= 620 / sp2; vy *= 620 / sp2; } // cap speed gained from overlap pushes
        b.vx = vx; b.vy = vy; b.rot += vx * h / b.r; b.touch = false;
      }
      this._merges(onMerge);
    }
    this.time += dt;
    let over = false;
    for (const b of bs) { b.age += dt; if (b.age > 1.2 && b.y - b.r < LINE_Y && Math.abs(b.vy) < 60) over = true; }
    this.overT = over ? this.overT + dt : Math.max(0, this.overT - dt * 2);
  }
  _merges(onMerge) {
    const bs = this.bodies;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i]; if (a.dead) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j]; if (b.dead || b.tier !== a.tier) continue;
        const rr = a.r + b.r + 1.5, dx = b.x - a.x, dy = b.y - a.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        a.dead = b.dead = true;
        const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, t = a.tier + 1;
        let nb = null;
        if (t <= MAX_TIER) { nb = this.add(t, x, Math.min(y, H - RADII[t]), (a.vx + b.vx) / 2, (a.vy + b.vy) / 2); nb.age = Math.min(a.age, b.age); nb.born = this.time; nb.r = Math.max(a.r, nb.rT * 0.6); }
        if (onMerge) onMerge({ tier: t, x, y, body: nb });
        break;
      }
    }
    for (let i = bs.length - 1; i >= 0; i--) if (bs[i].dead) bs.splice(i, 1);
  }
  _magnet(h) {
    const bs = this.bodies, k = this.magnet;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j]; if (a.tier !== b.tier) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) + 1; if (d > 170) continue;
      const f = k * h / d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
  }
  shake(rng, power = 520) { for (const b of this.bodies) { b.vx += (rng.next() - 0.5) * power * 2; b.vy -= rng.next() * power; } }
  settled() { for (const b of this.bodies) if (Math.abs(b.vx) + Math.abs(b.vy) > 25) return false; return true; }
  serialize() { return this.bodies.map(b => [b.tier, Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10]); }
  load(arr) { this.clear(); for (const [t, x, y] of arr || []) { const b = this.add(t, x, y); b.age = 2; } }
}
