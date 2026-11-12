// Catangle — deterministic procedural level generator (pure; runs in browser and Node).
// A level is a grid of "cats": self-avoiding paths with a head. A cat leaves by running
// straight ahead from its head; it can leave only when every cell ahead of it is empty.
// Removal is monotone (removing a cat never blocks another), so greedy solving is complete.

export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];

export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MASKS = {
  full: () => true,
  corners: (x, y, w, h) => !((x === 0 || x === w - 1) && (y === 0 || y === h - 1)),
  diamond: (x, y, w, h) => {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    return Math.abs(x - cx) / (w / 2) + Math.abs(y - cy) / (h / 2) <= 1.2;
  },
  donut: (x, y, w, h) => {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    return !(Math.abs(x - cx) < 1 && Math.abs(y - cy) < 1.6);
  },
  plus: (x, y, w, h) => {
    const a = Math.floor(w / 4), b = Math.floor(h / 4);
    return !((x < a || x >= w - a) && (y < b || y >= h - b));
  },
  hourglass: (x, y, w, h) => {
    const cy = (h - 1) / 2, cx = (w - 1) / 2;
    const k = Math.abs(y - cy) / (h / 2);
    return Math.abs(x - cx) <= 0.6 + (w / 2) * (0.25 + 0.75 * k);
  },
};
const MASK_NAMES = ['corners', 'diamond', 'donut', 'plus', 'hourglass'];

export function levelParams(n) {
  const boss = n % 10 === 0;
  let w, h;
  if (n <= 2) { w = 4; h = 5; }
  else if (n <= 5) { w = 5; h = 6; }
  else if (n <= 10) { w = 6; h = 7; }
  else if (n <= 20) { w = 6; h = 8; }
  else if (n <= 40) { w = 7; h = 9; }
  else if (n <= 80) { w = 7; h = 10; }
  else { w = 8; h = 11; }
  if (boss) { w = Math.min(9, w + 1); h = Math.min(12, h + 1); }
  const t = Math.min(1, n / 60);
  const wave = [0.1, 0.3, 0.5, 0.2, 0.6, 0.4, 0.8, 0.5, 0.9, 1][(n - 1) % 10];
  return {
    n, w, h, boss,
    minLen: 2,
    maxLen: Math.round(3 + 4 * t),
    fill: n <= 2 ? 0.55 : 0.72 + 0.2 * t,
    turn: 0.25 + 0.35 * t,
    depth: wave * (0.4 + 0.6 * t),
    sleepy: n >= 15 && n % 3 !== 1 ? Math.min(4, 1 + Math.floor((n - 15) / 25)) : 0,
    grumpy: n >= 30 && (n % 4 === 2 || boss) ? (n >= 70 ? 2 : 1) : 0,
    mask: n >= 12 && n % 5 === 3 ? MASK_NAMES[Math.floor(n / 5) % MASK_NAMES.length] : 'full',
    seed: (n * 2654435761) >>> 0,
  };
}

export function dailyParams(dayNumber) {
  const r = makeRng(dayNumber * 7919 + 13);
  return {
    n: 0, daily: true, w: 8, h: 11, boss: true,
    minLen: 2, maxLen: 7, fill: 0.92, turn: 0.6, depth: 0.9,
    sleepy: 2 + Math.floor(r() * 2), grumpy: 1 + Math.floor(r() * 2),
    mask: ['full', ...MASK_NAMES][Math.floor(r() * 6)],
    seed: (dayNumber * 40503 + 977) >>> 0,
  };
}

function headDir(cells) {
  const dx = cells[0][0] - cells[1][0], dy = cells[0][1] - cells[1][1];
  return dx === 1 ? 0 : dy === 1 ? 1 : dx === -1 ? 2 : 3;
}

// A head is valid if the straight ray ahead of it never crosses its own body.
function validHead(cells) {
  const d = headDir(cells);
  for (let i = 1; i < cells.length; i++) {
    const rx = cells[i][0] - cells[0][0], ry = cells[i][1] - cells[0][1];
    if (d === 0 && ry === 0 && rx > 0) return false;
    if (d === 2 && ry === 0 && rx < 0) return false;
    if (d === 1 && rx === 0 && ry > 0) return false;
    if (d === 3 && rx === 0 && ry < 0) return false;
  }
  return true;
}

// Ids of all cats standing on the ray ahead of `cat`.
function rayCats(cat, occ, w, h) {
  const out = new Set();
  let x = cat.cells[0][0] + DX[cat.dir], y = cat.cells[0][1] + DY[cat.dir];
  while (x >= 0 && y >= 0 && x < w && y < h) {
    const o = occ[y * w + x];
    if (o >= 0) out.add(o);
    x += DX[cat.dir]; y += DY[cat.dir];
  }
  return out;
}

function occOf(cats, w, h) {
  const occ = new Int16Array(w * h).fill(-1);
  for (const c of cats) for (const [x, y] of c.cells) occ[y * w + x] = c.id;
  return occ;
}

// Greedy layered solve. Returns {layers: Map(id -> round), stuck: [cats]}.
function solveLayers(cats, w, h) {
  const occ = occOf(cats, w, h);
  let remaining = cats.slice();
  const layers = new Map();
  let round = 0;
  while (remaining.length) {
    const free = remaining.filter((c) => rayCats(c, occ, w, h).size === 0);
    if (!free.length) break;
    for (const c of free) {
      layers.set(c.id, round);
      for (const [x, y] of c.cells) occ[y * w + x] = -1;
    }
    const fs = new Set(free);
    remaining = remaining.filter((c) => !fs.has(c));
    round++;
  }
  return { layers, stuck: remaining, rounds: round };
}

function buildCandidate(p, rand) {
  const { w, h } = p;
  const mask = MASKS[p.mask] || MASKS.full;
  const occ = new Int16Array(w * h).fill(-1);
  let total = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (mask(x, y, w, h)) total++; else occ[y * w + x] = -2;
  }
  let cats = [];
  let filled = 0, nextId = 0;
  for (let attempt = 0; attempt < 500 && filled / total < p.fill; attempt++) {
    let sx, sy, tries = 0;
    do { sx = Math.floor(rand() * w); sy = Math.floor(rand() * h); tries++; }
    while (occ[sy * w + sx] !== -1 && tries < 40);
    if (occ[sy * w + sx] !== -1) continue;
    const L = p.minLen + Math.floor(rand() * (p.maxLen - p.minLen + 1));
    const path = [[sx, sy]];
    const inPath = new Set([sy * w + sx]);
    let dir = Math.floor(rand() * 4);
    while (path.length < L) {
      const [cx, cy] = path[path.length - 1];
      const opts = [];
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (occ[ny * w + nx] !== -1 || inPath.has(ny * w + nx)) continue;
        opts.push(d);
      }
      if (!opts.length) break;
      if (!(opts.includes(dir) && rand() > p.turn)) dir = opts[Math.floor(rand() * opts.length)];
      const nx = cx + DX[dir], ny = cy + DY[dir];
      path.push([nx, ny]); inPath.add(ny * w + nx);
    }
    if (path.length < 2) continue;
    const cands = [path, path.slice().reverse()].filter(validHead);
    if (!cands.length) continue;
    const cells = cands[Math.floor(rand() * cands.length)];
    const id = nextId++;
    cats.push({ id, cells, dir: headDir(cells), sleep: 0, fuse: 0 });
    for (const [x, y] of cells) occ[y * w + x] = id;
    filled += cells.length;
  }
  // Repair cycles until greedy-solvable: flip a stuck cat once, otherwise drop it.
  const flipped = new Set();
  for (let guard = 0; guard < 400; guard++) {
    const { stuck } = solveLayers(cats, w, h);
    if (!stuck.length) break;
    const c = stuck[Math.floor(rand() * stuck.length)];
    const rev = c.cells.slice().reverse();
    if (!flipped.has(c.id) && validHead(rev)) {
      flipped.add(c.id); c.cells = rev; c.dir = headDir(rev);
    } else {
      cats = cats.filter((k) => k !== c);
    }
  }
  const maskArr = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) maskArr.push(mask(x, y, w, h));
  return { cats, mask: maskArr, total };
}

// Build a full solution order that frees the grumpy cats as early as possible.
function planOrder(cats, w, h, grumpyIds, rand) {
  const occ = occOf(cats, w, h);
  const byId = new Map(cats.map((c) => [c.id, c]));
  const remaining = new Set(cats.map((c) => c.id));
  const order = [];
  const closure = (id) => {
    const seen = new Set([id]); const stack = [id];
    while (stack.length) {
      for (const b of rayCats(byId.get(stack.pop()), occ, w, h)) {
        if (!seen.has(b)) { seen.add(b); stack.push(b); }
      }
    }
    return seen;
  };
  while (remaining.size) {
    const avail = [...remaining].filter((id) => rayCats(byId.get(id), occ, w, h).size === 0);
    if (!avail.length) return null;
    const target = grumpyIds.find((g) => remaining.has(g));
    let pool = avail;
    if (target !== undefined) {
      const cl = closure(target);
      const need = avail.filter((id) => cl.has(id));
      if (need.length) pool = need;
    }
    const pick = pool[Math.floor(rand() * pool.length)];
    remaining.delete(pick); order.push(pick);
    for (const [x, y] of byId.get(pick).cells) occ[y * w + x] = -1;
  }
  return order;
}

export function generate(p) {
  const rand = makeRng(p.seed);
  let best = null, bestScore = -1e9;
  const targetFree = 0.6 - 0.5 * p.depth;
  for (let k = 0; k < 8; k++) {
    const cand = buildCandidate(p, makeRng((p.seed ^ (k * 0x9e3779b1)) >>> 0));
    if (cand.cats.length < 2) continue;
    const { layers, rounds } = solveLayers(cand.cats, p.w, p.h);
    let free = 0; for (const v of layers.values()) if (v === 0) free++;
    const cells = cand.cats.reduce((s, c) => s + c.cells.length, 0);
    const score = -Math.abs(free / cand.cats.length - targetFree) + 0.5 * (cells / cand.total) + 0.02 * rounds;
    if (score > bestScore) { bestScore = score; best = cand; }
  }
  const cats = best.cats;
  cats.forEach((c, i) => { c.id = i; });
  const { layers } = solveLayers(cats, p.w, p.h);

  // Grumpy cats: buried a little, must leave before their countdown runs out.
  const grumpy = [];
  if (p.grumpy) {
    const pool = cats.filter((c) => layers.get(c.id) >= 1).sort((a, b) => layers.get(a.id) - layers.get(b.id));
    for (let i = 0; i < p.grumpy && pool.length; i++) {
      const idx = Math.min(pool.length - 1, Math.floor(rand() * Math.ceil(pool.length * 0.6)));
      grumpy.push(pool.splice(idx, 1)[0].id);
    }
  }
  const order = planOrder(cats, p.w, p.h, grumpy, rand);
  const pos = new Map(order.map((id, i) => [id, i]));
  const protectedIds = new Set();
  let lastGrumpyPos = -1;
  for (const g of grumpy) {
    const c = cats[g];
    c.fuse = pos.get(g) + 1 + (p.daily ? 1 : 2);
    lastGrumpyPos = Math.max(lastGrumpyPos, pos.get(g));
  }
  for (const id of order.slice(0, lastGrumpyPos + 1)) protectedIds.add(id);

  // Sleepy cats: wake after `sleep` other cats have left. Never ahead of a grumpy plan.
  if (p.sleepy) {
    const pool = cats.filter((c) => !protectedIds.has(c.id) && pos.get(c.id) >= 2);
    for (let i = 0; i < p.sleepy && pool.length; i++) {
      const c = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      c.sleep = 1 + Math.floor(rand() * Math.min(pos.get(c.id), 6));
    }
  }
  return { w: p.w, h: p.h, mask: best.mask, cats, order, params: p };
}

export function generateLevel(n) { return generate(levelParams(n)); }
export function generateDaily(dayNumber) { return generate(dailyParams(dayNumber)); }
