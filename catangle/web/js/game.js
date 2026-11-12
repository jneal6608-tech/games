// Catangle — rules for one level (pure logic, no rendering).
import { DX, DY } from './levelgen.js';

export class LevelState {
  constructor(def) {
    this.def = def;
    this.w = def.w; this.h = def.h; this.mask = def.mask;
    this.cats = new Map();
    this.occ = new Int16Array(this.w * this.h).fill(-1);
    for (const c of def.cats) {
      this.cats.set(c.id, { id: c.id, cells: c.cells.map((p) => p.slice()), dir: c.dir, sleep: c.sleep, fuse: c.fuse, fuseBonus: 0 });
      for (const [x, y] of c.cells) this.occ[y * this.w + x] = c.id;
    }
    this.total = def.cats.length;
    this.removed = 0;
    this.hearts = 3;
    this.mistakes = 0;
    this.status = 'play'; // play | won | lost
    this.lostReason = null; // hearts | fuse
    this.lostCat = null;
    this.revives = 0;
  }

  ray(cat) {
    let x = cat.cells[0][0] + DX[cat.dir], y = cat.cells[0][1] + DY[cat.dir], steps = 0;
    while (x >= 0 && y >= 0 && x < this.w && y < this.h) {
      const o = this.occ[y * this.w + x];
      if (o >= 0) return { steps, blocker: o };
      steps++; x += DX[cat.dir]; y += DY[cat.dir];
    }
    return { steps, blocker: -1 };
  }

  isAwake(cat) { return this.removed >= cat.sleep; }
  sleepLeft(cat) { return Math.max(0, cat.sleep - this.removed); }
  fuseLeft(cat) { return cat.fuse ? cat.fuse + cat.fuseBonus - this.removed : Infinity; }
  isFree(cat) { return this.isAwake(cat) && this.ray(cat).blocker < 0; }
  freeIds() { return [...this.cats.values()].filter((c) => this.isFree(c)).map((c) => c.id); }

  _remove(cat) {
    for (const [x, y] of cat.cells) this.occ[y * this.w + x] = -1;
    this.cats.delete(cat.id);
    this.removed++;
    if (!this.cats.size) { this.status = 'won'; return; }
    for (const c of this.cats.values()) {
      if (c.fuse && this.fuseLeft(c) <= 0) {
        this.status = 'lost'; this.lostReason = 'fuse'; this.lostCat = c.id; return;
      }
    }
  }

  tap(id) {
    if (this.status !== 'play') return null;
    const cat = this.cats.get(id);
    if (!cat) return null;
    if (!this.isAwake(cat)) return { type: 'asleep', cat };
    const r = this.ray(cat);
    if (r.blocker < 0) {
      this._remove(cat);
      return { type: 'exit', cat, steps: r.steps };
    }
    this.hearts--; this.mistakes++;
    if (this.hearts <= 0) { this.status = 'lost'; this.lostReason = 'hearts'; }
    return { type: 'bump', cat, steps: r.steps, blocker: r.blocker };
  }

  // Booster: whisk any cat away regardless of what is in front of it.
  lure(id) {
    if (this.status !== 'play') return null;
    const cat = this.cats.get(id);
    if (!cat) return null;
    this._remove(cat);
    return { type: 'lure', cat };
  }

  revive() {
    if (this.status !== 'lost') return;
    this.hearts = Math.max(1, this.hearts);
    if (this.lostReason === 'hearts') this.hearts = 1;
    for (const c of this.cats.values()) if (c.fuse && this.fuseLeft(c) < 3) c.fuseBonus += 3 - this.fuseLeft(c);
    this.status = 'play'; this.lostReason = null; this.lostCat = null; this.revives++;
  }

  // Best next tap: a free cat, preferring one that helps the most urgent grumpy cat.
  bestMove() {
    const free = this.freeIds();
    if (!free.length) return null;
    const grumpy = [...this.cats.values()].filter((c) => c.fuse).sort((a, b) => this.fuseLeft(a) - this.fuseLeft(b));
    for (const g of grumpy) {
      const seen = new Set([g.id]); const stack = [g.id];
      while (stack.length) {
        const c = this.cats.get(stack.pop());
        let x = c.cells[0][0] + DX[c.dir], y = c.cells[0][1] + DY[c.dir];
        while (x >= 0 && y >= 0 && x < this.w && y < this.h) {
          const o = this.occ[y * this.w + x];
          if (o >= 0 && !seen.has(o)) { seen.add(o); stack.push(o); }
          x += DX[c.dir]; y += DY[c.dir];
        }
      }
      const hit = free.find((id) => seen.has(id));
      if (hit !== undefined) return hit;
    }
    return free[0];
  }
}
