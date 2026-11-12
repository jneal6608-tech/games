// Catangle — canvas drawing. Every visual is drawn procedurally (no image assets).

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function strokePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

// Slice of a polyline between arc-lengths a and b.
export function subPath(P, a, b) {
  const out = [];
  let acc = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const s0 = acc, s1 = acc + len;
    if (s1 >= a && s0 <= b && len > 0) {
      const ta = Math.max(0, (a - s0) / len), tb = Math.min(1, (b - s0) / len);
      if (!out.length) out.push([x0 + (x1 - x0) * ta, y0 + (y1 - y0) * ta]);
      out.push([x0 + (x1 - x0) * tb, y0 + (y1 - y0) * tb]);
    }
    acc = s1;
  }
  return out;
}

/**
 * Draw one cat. `pts` is the spine in pixels from tail to head; `u` is one cell in pixels.
 * opts: { angle, t, mood: 'idle'|'sleep'|'grumpy'|'happy'|'ouch', seed, glow, alpha }
 */
export function drawCat(ctx, pts, u, coat, opts = {}) {
  if (pts.length < 2) return;
  const t = opts.t || 0, seed = opts.seed || 0;
  const bw = u * 0.56;
  const head = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const angle = opts.angle !== undefined ? opts.angle : Math.atan2(head[1] - prev[1], head[0] - prev[0]);
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // tail
  const tl = pts[0], tn = pts[1];
  let tx = tl[0] - tn[0], ty = tl[1] - tn[1];
  const tlen = Math.hypot(tx, ty) || 1; tx /= tlen; ty /= tlen;
  const wag = Math.sin(t * 3 + seed * 1.7) * 0.16 * u;
  const tipX = tl[0] + tx * u * 0.4 - ty * wag, tipY = tl[1] + ty * u * 0.4 + tx * wag;
  const midX = tl[0] + tx * u * 0.24 + ty * wag * 0.6, midY = tl[1] + ty * u * 0.24 - tx * wag * 0.6;
  const tail = (w, col) => {
    ctx.lineWidth = w; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(tl[0], tl[1]);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY); ctx.stroke();
  };

  // glow (hint / target)
  if (opts.glow) {
    ctx.save();
    ctx.shadowColor = opts.glow; ctx.shadowBlur = u * 0.5;
    ctx.strokeStyle = opts.glow; ctx.lineWidth = bw + u * (0.2 + 0.06 * Math.sin(t * 6));
    strokePath(ctx, pts); ctx.restore();
  }
  // soft drop shadow
  ctx.save(); ctx.translate(0, u * 0.07);
  ctx.strokeStyle = 'rgba(50,25,10,0.16)'; ctx.lineWidth = bw + u * 0.1; strokePath(ctx, pts);
  ctx.restore();

  tail(u * 0.3, coat.line); tail(u * 0.19, coat.tip || coat.base);
  ctx.strokeStyle = coat.line; ctx.lineWidth = bw + u * 0.11; strokePath(ctx, pts);
  ctx.strokeStyle = coat.base; ctx.lineWidth = bw; strokePath(ctx, pts);

  // coat pattern, phase-locked to the tail so it travels with the body
  if (coat.pattern && coat.pattern !== 'plain') {
    ctx.save(); ctx.lineCap = 'butt'; ctx.lineWidth = bw;
    if (coat.pattern === 'bands') {
      ctx.strokeStyle = coat.stripe; ctx.setLineDash([u * 0.1, u * 0.24]); ctx.lineDashOffset = -u * 0.1;
      strokePath(ctx, pts);
    } else {
      // Soft rounded patches that sit inside the body outline (butt-capped full-width dashes read as glitchy blocks).
      ctx.lineCap = 'round'; ctx.lineWidth = bw * 0.74;
      ctx.strokeStyle = coat.stripe; ctx.setLineDash([u * 0.16, u * 1.12]); ctx.lineDashOffset = -u * 0.45;
      strokePath(ctx, pts);
      if (coat.pattern === 'patch2') {
        ctx.lineWidth = bw * 0.6;
        ctx.strokeStyle = coat.stripe2; ctx.setLineDash([u * 0.08, u * 1.2]); ctx.lineDashOffset = -u * 1.05;
        strokePath(ctx, pts);
      }
    }
    ctx.restore();
  }
  // glossy highlight along the back
  ctx.save(); ctx.globalAlpha = (opts.alpha !== undefined ? opts.alpha : 1) * 0.22; ctx.strokeStyle = '#fff'; ctx.lineWidth = bw * 0.22;
  ctx.translate(-u * 0.07, -u * 0.09); strokePath(ctx, pts); ctx.restore();

  // head
  const mood = opts.mood || 'idle';
  const breathe = 1 + Math.sin(t * 2.2 + seed) * 0.02;
  ctx.translate(head[0], head[1]); ctx.rotate(angle); ctx.scale(breathe, breathe);
  const hc = coat.head || coat.base;
  const R = u * 0.37;
  for (const sgn of [-1, 1]) { // ears
    ctx.beginPath();
    ctx.moveTo(R * Math.cos(0.75) * 0.9, sgn * R * Math.sin(0.75) * 0.9);
    ctx.lineTo(-u * 0.02, sgn * u * 0.55);
    ctx.lineTo(R * Math.cos(2.0) * 0.9, sgn * R * Math.sin(2.0) * 0.9);
    ctx.closePath();
    ctx.fillStyle = hc; ctx.strokeStyle = coat.line; ctx.lineWidth = u * 0.055; ctx.stroke(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(u * 0.1, sgn * u * 0.3); ctx.lineTo(u * 0.0, sgn * u * 0.46); ctx.lineTo(-u * 0.07, sgn * u * 0.31);
    ctx.closePath(); ctx.fillStyle = '#FFB3C0'; ctx.fill();
  }
  ctx.beginPath(); ctx.ellipse(0, 0, R, R * 1.04, 0, 0, Math.PI * 2);
  ctx.fillStyle = hc; ctx.strokeStyle = coat.line; ctx.lineWidth = u * 0.055; ctx.fill(); ctx.stroke();
  // muzzle
  ctx.beginPath(); ctx.ellipse(u * 0.2, 0, u * 0.13, u * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  // whiskers
  ctx.strokeStyle = 'rgba(40,25,20,0.45)'; ctx.lineWidth = Math.max(1, u * 0.02);
  for (const sgn of [-1, 1]) for (const k of [0.34, 0.46]) {
    ctx.beginPath(); ctx.moveTo(u * 0.22, sgn * u * 0.1); ctx.lineTo(u * (0.3 - (k - 0.34) * 0.9), sgn * u * k); ctx.stroke();
  }
  // nose
  ctx.beginPath(); ctx.moveTo(u * 0.3, 0); ctx.lineTo(u * 0.23, u * 0.05); ctx.lineTo(u * 0.23, -u * 0.05); ctx.closePath();
  ctx.fillStyle = '#F2788F'; ctx.fill();
  // eyes
  const blink = ((t * 0.9 + seed * 0.37) % 4.3) < 0.13;
  const eyeCol = coat.eye || (isDark(hc) ? '#FFE27A' : '#33241F');
  for (const sgn of [-1, 1]) {
    const ex = u * 0.07, ey = sgn * u * 0.16;
    if (mood === 'sleep' || blink || mood === 'happy') {
      ctx.strokeStyle = eyeCol; ctx.lineWidth = u * 0.04; ctx.beginPath();
      if (mood === 'happy') ctx.arc(ex - u * 0.03, ey, u * 0.065, -Math.PI / 2, Math.PI / 2);
      else ctx.arc(ex + u * 0.03, ey, u * 0.065, Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
    } else if (mood === 'ouch') {
      ctx.strokeStyle = eyeCol; ctx.lineWidth = u * 0.04; ctx.beginPath();
      ctx.moveTo(ex - u * 0.05, ey - u * 0.05); ctx.lineTo(ex + u * 0.05, ey + u * 0.05);
      ctx.moveTo(ex - u * 0.05, ey + u * 0.05); ctx.lineTo(ex + u * 0.05, ey - u * 0.05); ctx.stroke();
    } else {
      ctx.fillStyle = eyeCol; ctx.beginPath(); ctx.ellipse(ex, ey, u * 0.06, u * 0.075, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = isDark(eyeCol) ? '#fff' : '#33241F';
      ctx.beginPath(); ctx.arc(ex + u * 0.022, ey - sgn * u * 0.0 - u * 0.02, u * 0.022, 0, Math.PI * 2); ctx.fill();
      if (mood === 'grumpy') {
        ctx.strokeStyle = '#B3202A'; ctx.lineWidth = u * 0.05; ctx.beginPath();
        ctx.moveTo(ex + u * 0.13, ey - sgn * u * 0.1); ctx.lineTo(ex - u * 0.02, ey + sgn * u * 0.1 * 0.2 + sgn * u * 0.07); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 120;
}

export function drawBadge(ctx, x, y, r, text, fill, pulse) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(pulse, pulse);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = r * 0.22; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(r * 1.25)}px Fredoka, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, r * 0.08);
  ctx.restore();
}

export function drawBackground(ctx, W, H, theme, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, theme.bg[0]); g.addColorStop(1, theme.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // drifting paw prints
  ctx.save(); ctx.globalAlpha = theme.dark ? 0.06 : 0.09; ctx.fillStyle = theme.dark ? '#fff' : theme.panel;
  const step = 150;
  for (let y = -step; y < H + step; y += step) for (let x = -step; x < W + step; x += step) {
    const ox = ((y / step) % 2) * step * 0.5 + ((t * 6) % step), oy = (t * 4) % step;
    paw(ctx, x + ox, y + oy, 15);
  }
  ctx.restore();
}

function paw(ctx, x, y, s) {
  ctx.beginPath(); ctx.ellipse(x, y, s * 0.62, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  for (const [dx, dy] of [[-0.75, -0.55], [-0.27, -0.98], [0.27, -0.98], [0.75, -0.55]]) {
    ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * s, s * 0.24, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawBoard(ctx, L, level, theme) {
  const { ox, oy, u } = L;
  const pad = u * 0.22;
  ctx.save();
  ctx.fillStyle = 'rgba(60,30,10,0.14)'; rr(ctx, ox - pad, oy - pad + u * 0.12, level.w * u + pad * 2, level.h * u + pad * 2, u * 0.34); ctx.fill();
  ctx.fillStyle = theme.panel; rr(ctx, ox - pad, oy - pad, level.w * u + pad * 2, level.h * u + pad * 2, u * 0.34); ctx.fill();
  const gap = Math.max(1.5, u * 0.045);
  for (let y = 0; y < level.h; y++) for (let x = 0; x < level.w; x++) {
    if (!level.mask[y * level.w + x]) continue;
    ctx.fillStyle = (x + y) % 2 ? theme.tile : theme.tile2;
    rr(ctx, ox + x * u + gap, oy + y * u + gap, u - gap * 2, u - gap * 2, u * 0.2); ctx.fill();
  }
  ctx.restore();
}

export function layoutBoard(rect, w, h) {
  const u = Math.floor(Math.min((rect.width - 20) / (w + 0.5), (rect.height - 12) / (h + 0.5), 76));
  return { u, ox: rect.left + (rect.width - w * u) / 2, oy: rect.top + (rect.height - h * u) / 2 };
}
