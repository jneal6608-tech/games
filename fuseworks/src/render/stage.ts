// Canvas renderer: night sky, the board, shell tokens, chain preview and all firework particles.
// Everything is drawn procedurally: there are no image assets in the game.
import { COLOR_HEX, COLOR_SHAPES, COLS, ROWS, SHELLS, SKY_BY_ID, type Color, type ShellType, type StarKind } from '../engine/data';
import { Rng } from '../engine/rng';
import type { Resolution, Shell, ShowState } from '../engine/types';

const TAU = Math.PI * 2;
const WHITE = 4; // sprite index for white-hot particles
const GOLD = 5;
const SPRITE_COLORS = [...COLOR_HEX, '#ffffff', '#ffd98a'];

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; c: number; drag: number; grav: number; flicker: number }
interface Runner { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; c: number }
interface Flash { x: number; y: number; t: number; dur: number; r: number; c: number; ring: boolean }
interface Pop { x: number; y: number; text: string; color: string; t: number; dur: number; size: number }

export interface BoardView {
  show: ShowState;
  levels: Partial<Record<ShellType, number>>;
  selected: number; // selected board cell or -1
  preview: Resolution | null; // chain preview for the selected board shell
  placing: boolean; // a hand shell is selected: highlight free cells
  hover: number; // cell under a dragged shell or -1
  hoverType: ShellType | null;
  hoverReach: number[];
  hint: number; // tutorial: pulse this cell, -1 none
  dim: boolean; // darken board while a chain plays
}

// ---------------------------------------------------------------- shell token drawing (shared with DOM icons)
function shapePath(ctx: CanvasRenderingContext2D, shape: string, x: number, y: number, r: number): void {
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(x, y, r, 0, TAU);
  else if (shape === 'diamond') {
    const k = r * 1.12;
    ctx.moveTo(x, y - k); ctx.lineTo(x + k, y); ctx.lineTo(x, y + k); ctx.lineTo(x - k, y); ctx.closePath();
  } else if (shape === 'hex') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      const px = x + Math.cos(a) * r * 1.06, py = y + Math.sin(a) * r * 1.06;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else {
    const k = r * 0.9, q = r * 0.28;
    ctx.moveTo(x - k + q, y - k);
    ctx.arcTo(x + k, y - k, x + k, y + k, q); ctx.arcTo(x + k, y + k, x - k, y + k, q);
    ctx.arcTo(x - k, y + k, x - k, y - k, q); ctx.arcTo(x - k, y - k, x + k, y - k, q);
    ctx.closePath();
  }
}

export function drawShell(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, type: ShellType, color: Color, o: { locked?: boolean; level?: number; alpha?: number; pulse?: number } = {}): void {
  const hex = COLOR_HEX[color];
  const shape = COLOR_SHAPES[color];
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  // body
  shapePath(ctx, shape, x, y, r);
  const g = ctx.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, '#26315e'); g.addColorStop(1, '#0a0f24');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.11);
  ctx.strokeStyle = hex;
  if (o.locked === false) { ctx.setLineDash([r * 0.3, r * 0.2]); ctx.lineDashOffset = -(o.pulse ?? 0) * r; }
  ctx.shadowColor = hex; ctx.shadowBlur = o.locked === false ? 0 : r * 0.35;
  ctx.stroke();
  ctx.setLineDash([]); ctx.shadowBlur = 0;

  // burst pattern diagram
  const pat = SHELLS[type].pattern;
  const u = r * 0.27;
  const dot = (dc: number, dr: number, rad: number, fill: string) => { ctx.beginPath(); ctx.arc(x + dc * u, y + dr * u, rad, 0, TAU); ctx.fillStyle = fill; ctx.fill(); };
  if (!pat.length) {
    ctx.strokeStyle = hex; ctx.lineWidth = Math.max(1, r * 0.09); ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, a0 = r * 0.22, a1 = r * (i % 2 ? 0.48 : 0.64);
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * a0, y + Math.sin(a) * a0); ctx.lineTo(x + Math.cos(a) * a1, y + Math.sin(a) * a1); ctx.stroke();
    }
  } else {
    const seen = new Set<string>();
    let far = false;
    for (const [dc, dr] of pat) {
      if (Math.abs(dc) > 2 || Math.abs(dr) > 2) { far = true; continue; }
      const k = `${dc},${dr}`;
      if (seen.has(k)) continue;
      seen.add(k);
      dot(dc, dr, r * 0.095, hex);
    }
    if (far) { // long-reach shells: draw rays to the rim
      ctx.strokeStyle = hex; ctx.lineWidth = Math.max(1, r * 0.07); ctx.lineCap = 'round';
      const dirs = new Set(pat.filter(([dc, dr]) => Math.abs(dc) > 2 || Math.abs(dr) > 2).map(([dc, dr]) => `${Math.sign(dc)},${Math.sign(dr)}`));
      for (const d of dirs) {
        const [sx, sy] = d.split(',').map(Number);
        ctx.beginPath(); ctx.moveTo(x + sx * u * 2.2, y + sy * u * 2.2); ctx.lineTo(x + sx * u * 2.9, y + sy * u * 2.9); ctx.stroke();
      }
    }
  }
  dot(0, 0, r * 0.12, '#ffffff');

  // type badges that the pattern alone cannot show
  const badge = type === 'strobe' ? 'x2' : type === 'kamuro' ? '#' : type === 'glitter' ? '+1' : '';
  if (badge) {
    ctx.font = `800 ${Math.round(r * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0a0f24'; ctx.beginPath(); ctx.arc(x + r * 0.62, y - r * 0.62, r * 0.36, 0, TAU); ctx.fill();
    ctx.strokeStyle = hex; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(badge, x + r * 0.62, y - r * 0.6);
  }
  // workshop level pips
  const lvl = o.level ?? 0;
  for (let i = 0; i < Math.min(lvl, 5); i++) {
    ctx.beginPath(); ctx.arc(x + (i - (Math.min(lvl, 5) - 1) / 2) * r * 0.26, y + r * 0.78, r * 0.08, 0, TAU);
    ctx.fillStyle = '#ffd98a'; ctx.fill();
  }
  ctx.restore();
}

const iconCache = new Map<string, string>();
/** Shell token as a data-URL image for DOM cards and lists. */
export function shellIcon(type: ShellType, color: Color, level = 0, px = 96): string {
  const key = `${type}|${color}|${level}|${px}`;
  let url = iconCache.get(key);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    drawShell(c.getContext('2d')!, px / 2, px / 2, px * 0.4, type, color, { level });
    url = c.toDataURL();
    iconCache.set(key, url);
  }
  return url;
}

function drawStar(ctx: CanvasRenderingContext2D, kind: StarKind, x: number, y: number, r: number, a: number): void {
  ctx.save();
  ctx.globalAlpha = a;
  if (kind === 'bright') {
    ctx.fillStyle = '#ffd98a'; ctx.shadowColor = '#ffd98a'; ctx.shadowBlur = r * 0.8;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const ang = (i / 8) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.38 : r; ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); }
    ctx.closePath(); ctx.fill();
  } else if (kind === 'awe') {
    ctx.fillStyle = '#d7a6ff'; ctx.shadowColor = '#c77dff'; ctx.shadowBlur = r * 0.8;
    ctx.beginPath(); // heart
    ctx.moveTo(x, y + r * 0.85);
    ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35);
    ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.85);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#8be9ff'; ctx.shadowColor = '#8be9ff'; ctx.shadowBlur = r * 0.8; ctx.lineWidth = Math.max(1.5, r * 0.24);
    ctx.beginPath(); ctx.arc(x - r * 0.42, y, r * 0.52, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + r * 0.42, y, r * 0.52, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- stage
export class Stage {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private W = 0; private H = 0; private dpr = 1;
  private bg: HTMLCanvasElement | null = null;
  private sprites: HTMLCanvasElement[] = [];
  /** Pre-rendered locked shell tokens. Drawing a token live (glow + gradient) every frame is the main cost on slow phones. */
  private tokenCache = new Map<string, HTMLCanvasElement>();
  private skyId = 'harbor';
  private twinkles: Array<{ x: number; y: number; r: number; p: number }> = [];
  private parts: Particle[] = [];
  private runners: Runner[] = [];
  private flashes: Flash[] = [];
  private pops: Pop[] = [];
  private shake = 0;
  private time = 0;
  private last = 0;
  private attractT = 0;
  private fpsAcc = 0; private fpsN = 0;
  /** 1 = full effects; drops automatically on slow devices */
  quality = 1;
  /** Render resolution as a fraction of the screen's pixel ratio; lowered automatically when painting is too slow. */
  private resScale = 1;
  reducedFx = false;
  view: BoardView | null = null;
  attract = true;
  board = { x: 0, y: 0, cell: 60, top: 120, bottom: 220 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    for (const hex of SPRITE_COLORS) this.sprites.push(this.makeSprite(hex));
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame((t) => this.frame(t));
  }

  private makeSprite(hex: string): HTMLCanvasElement {
    const s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, hex); g.addColorStop(0.5, hex + '55'); g.addColorStop(1, hex + '00');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    return c;
  }

  private token(type: ShellType, color: Color, level: number, r: number): { img: HTMLCanvasElement; half: number } {
    const half = r * 1.55; // room for the glow and the corner badge
    const key = `${type}|${color}|${level}|${Math.round(r * 4)}|${this.dpr}`;
    let img = this.tokenCache.get(key);
    if (!img) {
      if (this.tokenCache.size > 300) this.tokenCache.clear();
      img = document.createElement('canvas');
      img.width = img.height = Math.ceil(half * 2 * this.dpr);
      const x = img.getContext('2d')!;
      x.scale(this.dpr, this.dpr);
      drawShell(x, half, half, r, type, color, { locked: true, level });
      this.tokenCache.set(key, img);
    }
    return { img, half };
  }

  setSky(id: string): void { if (id !== this.skyId) { this.skyId = id; this.paintBackground(); } }

  /** UI tells the stage how much room the HUD (top) and hand tray (bottom) take, in CSS px. */
  setInsets(top: number, bottom: number): void {
    this.board.top = top; this.board.bottom = bottom;
    this.layout();
  }

  resize(): void {
    const css = window.innerWidth * window.innerHeight;
    // cap the canvas at about 1.5 million pixels: big screens at 2x cost more to paint than they gain
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(1.5e6 / css)) * this.resScale);
    this.tokenCache.clear();
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.layout();
    this.paintBackground();
  }

  private layout(): void {
    const availW = this.W - 20, availH = this.H - this.board.top - this.board.bottom - 12;
    const cell = Math.max(24, Math.floor(Math.min(availW / COLS, availH / ROWS, 92)));
    this.board.cell = cell;
    this.board.x = Math.round((this.W - cell * COLS) / 2);
    this.board.y = Math.round(this.board.top + (availH - cell * ROWS) / 2 + 6);
  }

  cellCenter(i: number): { x: number; y: number } {
    const b = this.board;
    return { x: b.x + ((i % COLS) + 0.5) * b.cell, y: b.y + (Math.floor(i / COLS) + 0.5) * b.cell };
  }
  cellAt(x: number, y: number): number {
    const b = this.board;
    const c = Math.floor((x - b.x) / b.cell), r = Math.floor((y - b.y) / b.cell);
    return c < 0 || c >= COLS || r < 0 || r >= ROWS ? -1 : r * COLS + c;
  }

  // -------------------------------------------------------------- background
  private paintBackground(): void {
    const sky = SKY_BY_ID[this.skyId] ?? SKY_BY_ID.harbor;
    const c = this.bg ?? (this.bg = document.createElement('canvas'));
    c.width = this.canvas.width; c.height = this.canvas.height;
    const x = c.getContext('2d')!;
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const W = this.W, H = this.H;
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky.top); g.addColorStop(0.75, sky.bottom); g.addColorStop(1, sky.top);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const horizon = H * 0.8;
    const glow = x.createRadialGradient(W / 2, horizon, 0, W / 2, horizon, W * 0.9);
    glow.addColorStop(0, sky.glow + '55'); glow.addColorStop(1, sky.glow + '00');
    x.fillStyle = glow; x.fillRect(0, 0, W, H);

    const rng = new Rng(`sky-${sky.id}`);
    // fixed faint stars
    x.fillStyle = '#ffffff';
    for (let i = 0; i < 110; i++) { x.globalAlpha = 0.15 + rng.next() * 0.5; x.fillRect(rng.next() * W, rng.next() * horizon * 0.95, 1.2, 1.2); }
    x.globalAlpha = 1;
    this.twinkles = Array.from({ length: 26 }, () => ({ x: rng.next() * W, y: rng.next() * horizon * 0.85, r: 0.8 + rng.next() * 1.3, p: rng.next() * TAU }));

    if (sky.id === 'aurora') {
      for (let b = 0; b < 3; b++) {
        const y0 = H * (0.12 + b * 0.1), amp = 26 + b * 10, ph = rng.next() * TAU;
        const ag = x.createLinearGradient(0, y0 - 60, 0, y0 + 110);
        ag.addColorStop(0, '#58f0b000'); ag.addColorStop(0.4, b === 1 ? '#7fb0ff44' : '#58f0b055'); ag.addColorStop(1, '#58f0b000');
        x.fillStyle = ag; x.beginPath(); x.moveTo(0, y0 + 110);
        for (let px = 0; px <= W; px += 8) x.lineTo(px, y0 + Math.sin(px / 70 + ph) * amp - 60);
        x.lineTo(W, y0 + 110); x.closePath(); x.fill();
      }
    }
    // silhouette along the horizon
    x.fillStyle = '#03050d';
    x.beginPath(); x.moveTo(0, H);
    if (sky.id === 'lake' || sky.id === 'aurora') {
      let px = -40;
      while (px < W + 40) { const w = 70 + rng.next() * 120, h = 40 + rng.next() * 90; x.lineTo(px, horizon + 30); x.lineTo(px + w / 2, horizon + 30 - h); px += w * 0.7; }
      x.lineTo(W + 40, horizon + 30);
    } else if (sky.id === 'dunes') {
      const ph = rng.next() * TAU;
      for (let px = 0; px <= W; px += 6) x.lineTo(px, horizon + 6 + Math.sin(px / 55 + ph) * 12 + Math.sin(px / 23 + ph * 2) * 4);
    } else {
      let px = 0;
      const tall = sky.id === 'city';
      while (px < W) { const w = 14 + rng.next() * 30, h = (tall ? 30 : 12) + rng.next() * (tall ? 90 : 46); x.lineTo(px, horizon + 26 - h); x.lineTo(px + w, horizon + 26 - h); px += w + (rng.next() < 0.25 ? 8 : 0); }
    }
    x.lineTo(W, H); x.closePath(); x.fill();
    if (sky.id === 'harbor' || sky.id === 'city') { // lit windows
      for (let i = 0; i < 46; i++) { x.fillStyle = rng.next() < 0.5 ? '#ffd98a' : sky.glow; x.globalAlpha = 0.25 + rng.next() * 0.4; x.fillRect(rng.next() * W, horizon + 28 - rng.next() * (sky.id === 'city' ? 70 : 20), 2, 2); }
      x.globalAlpha = 1;
    }
    // water / ground sheen
    const wg = x.createLinearGradient(0, horizon + 26, 0, H);
    wg.addColorStop(0, sky.glow + '22'); wg.addColorStop(1, '#00000000');
    x.fillStyle = wg; x.fillRect(0, horizon + 26, W, H - horizon);
  }

  // -------------------------------------------------------------- effects API
  private budget(): number { return (this.reducedFx ? 500 : 1700) * this.quality; }

  private spark(x: number, y: number, vx: number, vy: number, life: number, size: number, c: number, drag = 2.4, grav = 46, flicker = 0): void {
    if (this.parts.length >= this.budget()) return;
    this.parts.push({ x, y, vx, vy, life, max: life, size, c, drag, grav, flicker });
  }

  /** Firework burst for one chain step. */
  burst(idx: number, shell: Shell, hits: number[], stepDur: number, strength = 1): void {
    const { x, y } = this.cellCenter(idx);
    const cs = this.board.cell;
    const c = shell.color as number;
    const k = (this.reducedFx ? 0.45 : 1) * this.quality * strength;
    const n = (base: number) => Math.max(6, Math.round(base * k));
    const sp = cs * 2.1;
    const rnd = () => Math.random();
    const radial = (count: number, speed: number, jitter: number, color: number, life = 0.9, size = cs * 0.2, grav = 46) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + rnd() * 0.2, v = speed * (1 - jitter + rnd() * jitter);
        this.spark(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.7 + rnd() * 0.5), size * (0.7 + rnd() * 0.6), color, 2.4, grav);
      }
    };
    const jet = (dx: number, dy: number, count: number, color: number) => {
      const len = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < count; i++) {
        const v = sp * (0.5 + rnd() * 1.1), spread = (rnd() - 0.5) * 0.35;
        const ux = dx / len, uy = dy / len;
        this.spark(x, y, (ux - uy * spread) * v, (uy + ux * spread) * v, 0.5 + rnd() * 0.6, cs * 0.17, color, 2.2, 30);
      }
    };
    switch (shell.type) {
      case 'ring': radial(n(34), sp * 0.95, 0.04, c, 0.9); break;
      case 'crossette': for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) jet(dx, dy, n(10), c); radial(n(10), sp * 0.4, 0.6, WHITE, 0.5); break;
      case 'comet': jet(0, -1, n(30), c); jet(0, -1, n(10), WHITE); break;
      case 'willow': for (let i = 0; i < n(40); i++) { const a = rnd() * TAU, v = sp * (0.3 + rnd() * 0.5); this.spark(x, y, Math.cos(a) * v, Math.sin(a) * v - sp * 0.25, 1.2 + rnd() * 0.7, cs * 0.16, rnd() < 0.5 ? c : GOLD, 1.6, 150); } break;
      case 'wave': jet(1, 0, n(18), c); jet(-1, 0, n(18), c); radial(n(8), sp * 0.3, 0.5, WHITE, 0.4); break;
      case 'brocade': radial(n(46), sp * 0.9, 0.5, GOLD, 1.2, cs * 0.22, 80); radial(n(18), sp * 0.5, 0.5, c, 0.8); break;
      case 'palm': jet(0, -1, n(14), c); for (const dx of [-1, -0.5, 0.5, 1]) jet(dx, -1.2, n(7), c); break;
      case 'chrys': radial(n(30), sp * 1.15, 0.05, c, 0.9); radial(n(22), sp * 0.6, 0.05, WHITE, 0.7); break;
      case 'salute': radial(n(40), sp * 1.3, 0.7, WHITE, 0.5, cs * 0.26); radial(n(20), sp * 0.7, 0.7, c, 0.8); this.shake = Math.max(this.shake, this.reducedFx ? 0 : 9); break;
      case 'glitter': for (let i = 0; i < n(34); i++) { const a = rnd() * TAU, v = sp * rnd() * 0.8; this.spark(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.8 + rnd() * 0.8, cs * 0.12, rnd() < 0.6 ? WHITE : c, 3, 20, 1); } break;
      case 'strobe': radial(n(26), sp * 0.8, 0.5, WHITE, 0.6, cs * 0.2); radial(n(14), sp * 0.6, 0.5, c, 0.8); break;
      case 'kamuro': for (let i = 0; i < n(50); i++) { const a = rnd() * TAU, v = sp * (0.4 + rnd() * 0.6); this.spark(x, y, Math.cos(a) * v, Math.sin(a) * v, 1.3 + rnd() * 0.6, cs * 0.15, GOLD, 1.8, 120, 0.5); } break;
      case 'dragon': for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) jet(dx, dy, n(16), c); radial(n(12), sp * 0.5, 0.6, WHITE, 0.5); this.shake = Math.max(this.shake, this.reducedFx ? 0 : 5); break;
      default: radial(n(36), sp * 0.85, 0.55, c, 0.95); radial(n(8), sp * 0.35, 0.6, WHITE, 0.45);
    }
    this.flashes.push({ x, y, t: 0, dur: 0.22, r: cs * 1.25, c, ring: false });
    this.flashes.push({ x, y, t: 0, dur: 0.42, r: cs * 1.1, c, ring: true });
    // fuse sparks racing to every cell this burst reaches
    for (const h of hits) {
      const p = this.cellCenter(h);
      this.runners.push({ x0: x, y0: y, x1: p.x, y1: p.y, t: 0, dur: Math.max(0.07, stepDur * 0.9), c });
    }
    if (!this.reducedFx) this.shake = Math.max(this.shake, 2.5);
  }

  /** Free-floating burst anywhere on screen (title screen, celebrations). */
  burstAt(x: number, y: number, color: number, scale = 1): void {
    const cs = 54 * scale, count = Math.round(44 * (this.reducedFx ? 0.5 : 1) * this.quality);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + Math.random() * 0.3, v = cs * 2.4 * (0.45 + Math.random() * 0.6);
      this.spark(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.9 + Math.random() * 0.6, cs * 0.2, Math.random() < 0.15 ? WHITE : color, 2.2, 50);
    }
    this.flashes.push({ x, y, t: 0, dur: 0.25, r: cs * 1.4, c: color, ring: false });
  }

  celebrate(n = 6): void {
    for (let i = 0; i < n; i++) setTimeout(() => this.burstAt(this.W * (0.15 + Math.random() * 0.7), this.H * (0.15 + Math.random() * 0.4), Math.floor(Math.random() * 4), 1.1 + Math.random() * 0.6), i * 170);
  }

  /** Drop floating text and fuse sparks (called when leaving the show screen). */
  clearText(): void { this.pops.length = 0; this.runners.length = 0; }

  pop(idx: number, text: string, color = '#fff', size = 1, dy = 0): void {
    const { x, y } = this.cellCenter(idx);
    this.pops.push({ x, y: y - this.board.cell * 0.35 + dy, text, color, t: 0, dur: 0.9, size });
  }

  // -------------------------------------------------------------- frame
  private frame(t: number): void {
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016);
    this.last = t;
    this.time += dt;
    // adaptive quality: if we cannot hold ~45fps with particles on screen, thin them out
    if (this.parts.length > 150) {
      this.fpsAcc += dt; this.fpsN++;
      if (this.fpsN >= 20) {
        const avg = this.fpsAcc / this.fpsN;
        if (avg > 1 / 42) {
          // Too slow: first paint fewer pixels (the main cost on phones), then thin out particles.
          if (this.dpr > 1.01) { this.resScale *= 0.75; this.resize(); }
          else if (this.quality > 0.4) this.quality = Math.max(0.4, this.quality - 0.15);
        }
        this.fpsAcc = 0; this.fpsN = 0;
      }
    }
    this.update(dt);
    this.draw();
    requestAnimationFrame((n) => this.frame(n));
  }

  private update(dt: number): void {
    if (this.attract) {
      this.attractT -= dt;
      if (this.attractT <= 0) {
        this.attractT = 0.7 + Math.random() * 1.3;
        this.burstAt(this.W * (0.12 + Math.random() * 0.76), this.H * (0.08 + Math.random() * 0.32), Math.floor(Math.random() * 4), 0.9 + Math.random() * 0.7);
      }
    }
    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = this.runners.length - 1; i >= 0; i--) { const r = this.runners[i]; r.t += dt; if (r.t >= r.dur) this.runners.splice(i, 1); }
    for (let i = this.flashes.length - 1; i >= 0; i--) { const f = this.flashes[i]; f.t += dt; if (f.t >= f.dur) this.flashes.splice(i, 1); }
    for (let i = this.pops.length - 1; i >= 0; i--) { const p = this.pops[i]; p.t += dt; if (p.t >= p.dur) this.pops.splice(i, 1); }
    this.shake *= Math.exp(-9 * dt);
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.bg) ctx.drawImage(this.bg, 0, 0, this.W, this.H);
    // twinkling stars
    ctx.fillStyle = '#fff';
    for (const s of this.twinkles) { ctx.globalAlpha = 0.35 + 0.55 * Math.abs(Math.sin(this.time * 1.3 + s.p)); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;

    if (this.shake > 0.3) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    if (this.view) this.drawBoard(ctx, this.view);

    // particles (additive)
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flashes) {
      const k = f.t / f.dur;
      if (f.ring) {
        ctx.globalAlpha = (1 - k) * 0.7; ctx.strokeStyle = SPRITE_COLORS[f.c]; ctx.lineWidth = 2.5 * (1 - k) + 0.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.3 + k * 0.9), 0, TAU); ctx.stroke();
      } else {
        const r = f.r * (0.6 + k * 0.8);
        ctx.globalAlpha = (1 - k) * 0.9; ctx.drawImage(this.sprites[f.c], f.x - r, f.y - r, r * 2, r * 2);
      }
    }
    for (const r of this.runners) {
      const k = r.t / r.dur, x = r.x0 + (r.x1 - r.x0) * k, y = r.y0 + (r.y1 - r.y0) * k, s = this.board.cell * 0.34;
      ctx.globalAlpha = 0.5; ctx.strokeStyle = SPRITE_COLORS[r.c]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(r.x0 + (r.x1 - r.x0) * Math.max(0, k - 0.35), r.y0 + (r.y1 - r.y0) * Math.max(0, k - 0.35)); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalAlpha = 1; ctx.drawImage(this.sprites[WHITE], x - s / 2, y - s / 2, s, s);
    }
    for (const p of this.parts) {
      const k = p.life / p.max;
      let a = k < 0.5 ? k * 2 : 1;
      if (p.flicker && Math.random() < 0.35 * p.flicker) a *= 0.2;
      ctx.globalAlpha = a;
      const s = p.size * (0.55 + k * 0.6);
      ctx.drawImage(this.sprites[p.c], p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // floating score text
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of this.pops) {
      const k = p.t / p.dur;
      ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) * 4;
      const size = Math.round(this.board.cell * 0.3 * p.size * (k < 0.12 ? 0.6 + k * 3.3 : 1));
      ctx.font = `800 ${size}px system-ui, sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(4,6,16,0.85)';
      const y = p.y - k * this.board.cell * 0.55;
      ctx.strokeText(p.text, p.x, y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;
  }

  private rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  private drawBoard(ctx: CanvasRenderingContext2D, v: BoardView): void {
    const b = this.board, cs = b.cell, pad = Math.max(2, cs * 0.045);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
    const chainCells = new Map<number, number>(); // cell -> first order in previewed chain
    if (v.preview) for (const s of v.preview.steps) if (!chainCells.has(s.idx)) chainCells.set(s.idx, s.order);
    const reachSel = new Set(v.preview ? v.preview.steps.filter((s) => s.idx === v.selected).flatMap((s) => s.hits) : []);
    const hoverReach = new Set(v.hoverReach);

    for (let i = 0; i < v.show.cells.length; i++) {
      const cell = v.show.cells[i];
      const x = b.x + (i % COLS) * cs, y = b.y + Math.floor(i / COLS) * cs;
      this.rr(ctx, x + pad, y + pad, cs - pad * 2, cs - pad * 2, cs * 0.16);
      if (cell.blocked) {
        ctx.fillStyle = 'rgba(160,175,210,0.10)'; ctx.fill();
        // cloud
        ctx.fillStyle = 'rgba(190,200,225,0.42)';
        const cx = x + cs / 2, cy = y + cs / 2 + cs * 0.06;
        for (const [dx, dy, r] of [[-0.2, 0.02, 0.17], [0, -0.09, 0.22], [0.2, 0.02, 0.17], [0, 0.07, 0.19]]) { ctx.beginPath(); ctx.arc(cx + dx * cs, cy + dy * cs, r * cs, 0, TAU); ctx.fill(); }
        continue;
      }
      let fill = 'rgba(255,255,255,0.035)', stroke = 'rgba(255,255,255,0.11)', lw = 1;
      if (v.placing && !cell.shell) { fill = `rgba(255,255,255,${0.05 + pulse * 0.04})`; stroke = 'rgba(255,255,255,0.28)'; }
      if (reachSel.has(i)) { fill = 'rgba(255,217,138,0.13)'; stroke = 'rgba(255,217,138,0.5)'; }
      if (hoverReach.has(i)) { fill = 'rgba(139,233,255,0.16)'; stroke = 'rgba(139,233,255,0.65)'; }
      if (i === v.hover) { fill = 'rgba(255,255,255,0.2)'; stroke = '#ffffff'; lw = 2; }
      if (i === v.hint) { stroke = `rgba(255,217,138,${0.5 + pulse * 0.5})`; lw = 3; fill = `rgba(255,217,138,${0.1 + pulse * 0.12})`; }
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
      if (cell.star) {
        if (cell.shell) drawStar(ctx, cell.star, x + cs * 0.2, y + cs * 0.2, cs * 0.1, 1);
        else drawStar(ctx, cell.star, x + cs / 2, y + cs / 2, cs * 0.17, 0.55 + pulse * 0.3);
      }
    }

    // chain preview links (drawn under the tokens)
    if (v.preview) {
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,217,138,0.55)'; ctx.setLineDash([4, 5]); ctx.lineDashOffset = -this.time * 22;
      for (const s of v.preview.steps) {
        if (s.parent < 0 || s.repeat) continue;
        const a = this.cellCenter(s.parent), c = this.cellCenter(s.idx);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    for (let i = 0; i < v.show.cells.length; i++) {
      const cell = v.show.cells[i];
      if (!cell.shell) continue;
      const { x, y } = this.cellCenter(i);
      const inChain = chainCells.has(i);
      const alpha = v.dim ? 0.55 : v.preview && !inChain ? 0.45 : 1;
      const base = cs * 0.36, k = i === v.selected ? 1.08 + pulse * 0.04 : 1, lvl = v.levels[cell.shell.type] ?? 0;
      if (cell.locked) {
        const t = this.token(cell.shell.type, cell.shell.color, lvl, base), hs = t.half * k;
        ctx.globalAlpha = alpha; ctx.drawImage(t.img, x - hs, y - hs, hs * 2, hs * 2); ctx.globalAlpha = 1;
      } else drawShell(ctx, x, y, base * k, cell.shell.type, cell.shell.color, { locked: false, level: lvl, alpha, pulse: this.time * 1.5 });
      if (i === v.selected) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + pulse * 0.4;
        ctx.beginPath(); ctx.arc(x, y, cs * 0.46, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (inChain && v.preview) {
        const n = chainCells.get(i)!;
        ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(x + cs * 0.3, y + cs * 0.3, cs * 0.14, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1a1206'; ctx.font = `800 ${Math.round(cs * 0.17)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(n), x + cs * 0.3, y + cs * 0.31);
      }
    }
    // ghost of the shell being dragged over a cell
    if (v.hover >= 0 && v.hoverType) {
      const { x, y } = this.cellCenter(v.hover);
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, cs * 0.1, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
}
