/* Emberhold — canvas renderer. All art is procedural (original, nothing to license). */
(function (root) {
  'use strict';
  var EH = root.EH = root.EH || {};
  var cv, g, W = 0, H = 0, dpr = 1;
  var view = { cx: 0, cy: 0, scale: 1, range: 105 };
  var ground = null, glowCache = {};
  var parts = [], nums = [], rings = [], shake = 0, flash = 0, time = 0, hurtT = 0;
  var MAX_PARTS = 260, MAX_NUMS = 36;
  var EYES = { shade: '#ffd27a', wisp: '#9fe8ff', brute: '#ff5a4a', spitter: '#9dff6a', splitter: '#ff9cf0', mite: '#ff9cf0', boss: '#ff3355' };

  function opt() { return EH.Save.data.settings; }

  function makeGround() {
    var c = document.createElement('canvas'), n = 640; c.width = c.height = n;
    var x = c.getContext('2d'), i, r = mulberry(7);
    x.fillStyle = '#4a3626'; x.fillRect(0, 0, n, n);
    for (i = 0; i < 2600; i++) {
      var px = r() * n, py = r() * n, s = 0.6 + r() * 2.2, v = r();
      x.fillStyle = v < 0.5 ? 'rgba(20,12,8,' + (0.10 + r() * 0.18) + ')' : 'rgba(255,214,160,' + (0.03 + r() * 0.07) + ')';
      x.beginPath(); x.arc(px, py, s, 0, 6.283); x.fill();
    }
    for (i = 0; i < 70; i++) {   // grass tufts
      var gx = r() * n, gy = r() * n; x.strokeStyle = 'rgba(96,118,60,' + (0.25 + r() * 0.3) + ')'; x.lineWidth = 1.4;
      for (var b = -2; b <= 2; b++) { x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + b * 2.2, gy - 5 - r() * 5); x.stroke(); }
    }
    for (i = 0; i < 46; i++) {   // pebbles
      var qx = r() * n, qy = r() * n, qs = 2 + r() * 4;
      x.fillStyle = 'rgba(120,104,92,0.55)'; x.beginPath(); x.ellipse(qx, qy, qs, qs * 0.7, r() * 3, 0, 6.283); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(qx + 1, qy + qs * 0.6, qs, qs * 0.3, 0, 0, 6.283); x.fill();
    }
    return c;
  }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function glow(rgb) {
    if (glowCache[rgb]) return glowCache[rgb];
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.35, 'rgba(' + rgb + ',0.45)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return (glowCache[rgb] = c);
  }
  function drawGlow(rgb, x, y, r, a) {
    g.globalAlpha = a; g.drawImage(glow(rgb), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
  }

  function part(x, y, vx, vy, life, size, color, kind) {
    if (parts.length >= MAX_PARTS) parts.shift();
    parts.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, size: size, color: color, kind: kind || 0 });
  }

  var R = EH.Render = {
    view: view,
    init: function (canvas) { cv = canvas; g = cv.getContext('2d', { alpha: false }); ground = makeGround(); this.resize(); },
    resize: function () {
      dpr = Math.min(2, root.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    },
    setView: function (cx, cy, radiusPx) { view.cx = cx; view.cy = cy; view.px = radiusPx; },
    shake: function (a) { if (opt().shake && !opt().reduceMotion) shake = Math.max(shake, a); },
    clearFx: function () { parts.length = 0; nums.length = 0; rings.length = 0; shake = 0; flash = 0; },

    /** turn simulation events into particles / numbers / sound */
    consume: function (run) {
      var fx = run.fx, i, f, S = opt(), A = EH.Audio, few = S.reduceMotion;
      for (i = 0; i < fx.length; i++) {
        f = fx[i];
        switch (f.k) {
          case 'shoot': A.play('shoot'); break;
          case 'hit':
            A.play(f.crit ? 'crit' : 'hit');
            if (!few) for (var n = 0; n < (f.crit ? 5 : 2); n++) part(f.x, f.y, (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, 0.25, 1.6, f.crit ? '#fff' : '#ffd9a0');
            if (S.dmgNumbers) { if (nums.length >= MAX_NUMS) nums.shift(); nums.push({ x: f.x + (Math.random() - 0.5) * 10, y: f.y - 8, t: 0, txt: EH.fmt(f.dmg), crit: f.crit }); }
            break;
          case 'die':
            A.play(f.boss ? 'bossDie' : 'die');
            for (var m = 0; m < (few ? 3 : (f.boss ? 30 : 7)); m++) { var a = Math.random() * 6.283, sp = 20 + Math.random() * (f.boss ? 120 : 60); part(f.x, f.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.4, f.r * (0.3 + Math.random() * 0.4), '#1a1322', 1); }
            if (f.boss) { R.shake(10); EH.Platform.haptic(60); }
            break;
          case 'ouch': A.play('ouch'); hurtT = 0.25; R.shake(3); break;
          case 'bite': if (!few) for (var q = 0; q < 3; q++) part(f.x * 0.6, f.y * 0.6, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0.3, 2, '#ff6a5a'); break;
          case 'nova': A.play('nova'); rings.push({ x: 0, y: 0, r: 10, to: f.r, t: 0, d: 0.45, c: '255,190,110' }); break;
          case 'boom': rings.push({ x: f.x, y: f.y, r: 4, to: f.r, t: 0, d: 0.3, c: '255,150,80' }); break;
          case 'cast':
            A.play(f.id); EH.Platform.haptic(25);
            if (f.id === 'flare') { rings.push({ x: 0, y: 0, r: 10, to: 290, t: 0, d: 0.5, c: '255,240,200' }); if (!few) flash = 0.35; R.shake(6); }
            break;
          case 'revive': A.play('ward'); rings.push({ x: 0, y: 0, r: 10, to: 240, t: 0, d: 0.7, c: '255,255,255' }); break;
          case 'gem': A.play('gem'); break;
        }
      }
    },

    frame: function (dt, run, flame, menu) {
      time += dt;
      var S = opt(), sc = view.scale, cx = view.cx, cy = view.cy, i, e;
      if (shake > 0) { cx += (Math.random() - 0.5) * shake; cy += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 30); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#07060b'; g.fillRect(0, 0, W, H);

      var range = run ? run.s.range : 120;
      view.range += (range - view.range) * Math.min(1, dt * 6);
      // the camera pulls back as the light grows, so the edge of the dark is always on screen
      view.scale = (view.px || 180) / Math.max(165, view.range * 1.5);
      sc = view.scale;
      var flick = S.reduceMotion ? 1 : 1 + Math.sin(time * 9) * 0.012 + Math.sin(time * 23) * 0.008;
      var lightR = view.range * sc * flick;

      // lit ground, clipped to a bit beyond the light
      var gr = Math.min(lightR * 1.5, 420 * sc);
      g.save(); g.beginPath(); g.arc(cx, cy, gr, 0, 6.283); g.clip();
      var gs = 640 * sc * 1.35;
      g.drawImage(ground, cx - gs / 2, cy - gs / 2, gs, gs);
      g.restore();
      // tint + darkness falloff
      g.globalCompositeOperation = 'lighter';
      drawGlow(flame.glow, cx, cy, lightR * 1.25, 0.22);
      g.globalCompositeOperation = 'source-over';
      var dk = g.createRadialGradient(cx, cy, lightR * 0.35, cx, cy, gr);
      dk.addColorStop(0, 'rgba(7,6,11,0)'); dk.addColorStop(lightR * 0.92 / gr > 0.98 ? 0.98 : lightR * 0.92 / gr, 'rgba(7,6,11,0.55)'); dk.addColorStop(1, 'rgba(7,6,11,1)');
      g.fillStyle = dk; g.fillRect(cx - gr - 2, cy - gr - 2, gr * 2 + 4, gr * 2 + 4);
      // light edge ring (reads as "range")
      g.strokeStyle = 'rgba(' + flame.glow + ',' + (S.contrast ? 0.75 : 0.32) + ')'; g.lineWidth = S.contrast ? 2 : 1.2;
      g.setLineDash([5, 7]); g.lineDashOffset = -time * 6;
      g.beginPath(); g.arc(cx, cy, lightR, 0, 6.283); g.stroke(); g.setLineDash([]);

      // fire pit
      for (i = 0; i < 9; i++) {
        var sa = i / 9 * 6.283 + 0.3, sx = cx + Math.cos(sa) * 17 * sc, sy = cy + Math.sin(sa) * 17 * sc * 0.82 + 5 * sc;
        g.fillStyle = i % 2 ? '#6b5f58' : '#857870'; g.beginPath(); g.ellipse(sx, sy, 5.2 * sc, 4 * sc, sa, 0, 6.283); g.fill();
      }
      g.strokeStyle = '#3b2415'; g.lineWidth = 4.5 * sc; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx - 10 * sc, cy + 8 * sc); g.lineTo(cx + 10 * sc, cy + 2 * sc); g.moveTo(cx - 10 * sc, cy + 2 * sc); g.lineTo(cx + 10 * sc, cy + 8 * sc); g.stroke();

      if (run) {
        // enemies
        for (i = 0; i < run.enemies.length; i++) { e = run.enemies[i]; if (!e.dead) drawEnemy(e, cx, cy, sc, S.contrast, run.s.range); }
        // enemy shots
        for (i = 0; i < run.shots.length; i++) { var sh = run.shots[i]; g.globalCompositeOperation = 'lighter'; drawGlow('150,255,90', cx + sh.x * sc, cy + sh.y * sc, 7 * sc, 0.9); g.globalCompositeOperation = 'source-over'; }
        // sparks
        g.globalCompositeOperation = 'lighter';
        for (i = 0; i < run.sparks.length; i++) { var sp = run.sparks[i]; drawGlow(flame.glow, cx + sp.x * sc, cy + sp.y * sc, 9 * sc, 1); drawGlow('255,255,255', cx + sp.x * sc, cy + sp.y * sc, 3.5 * sc, 1); }
        g.globalCompositeOperation = 'source-over';
      }

      // flame
      var hpFrac = run ? Math.max(0.25, run.hp / run.s.maxHp) : 1;
      drawFlame(cx, cy + 2 * sc, sc * (menu ? 1.9 : 1.15) * (0.75 + 0.25 * hpFrac), flame, S.reduceMotion);
      if (!S.reduceMotion && Math.random() < dt * 14) part((Math.random() - 0.5) * 10, -6, (Math.random() - 0.5) * 14, -30 - Math.random() * 40, 1 + Math.random(), 1.4, flame.mid, 2);
      // ward bubble / stoke aura
      if (run && run.wardT > 0) { g.strokeStyle = 'rgba(160,220,255,' + (0.5 + 0.3 * Math.sin(time * 8)) + ')'; g.lineWidth = 2.5; hexagon(cx, cy, 30 * sc, time * 0.6); g.stroke(); g.fillStyle = 'rgba(120,200,255,0.10)'; g.fill(); }
      if (run && run.stokeT > 0) { g.globalCompositeOperation = 'lighter'; drawGlow('255,120,40', cx, cy, 46 * sc, 0.5 + 0.2 * Math.sin(time * 12)); g.globalCompositeOperation = 'source-over'; }

      // rings
      for (i = rings.length - 1; i >= 0; i--) {
        var rg = rings[i]; rg.t += dt; var k = rg.t / rg.d;
        if (k >= 1) { rings.splice(i, 1); continue; }
        var rr = (rg.r + (rg.to - rg.r) * (1 - Math.pow(1 - k, 2))) * sc;
        g.strokeStyle = 'rgba(' + rg.c + ',' + (1 - k) * 0.9 + ')'; g.lineWidth = (1 - k) * 7 + 1;
        g.beginPath(); g.arc(cx + rg.x * sc, cy + rg.y * sc, rr, 0, 6.283); g.stroke();
      }
      // particles
      for (i = parts.length - 1; i >= 0; i--) {
        var p = parts[i]; p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        var al = p.life / p.max;
        if (p.kind === 1) { p.vx *= 0.94; p.vy *= 0.94; g.globalAlpha = al * 0.8; g.fillStyle = p.color; g.beginPath(); g.arc(cx + p.x * sc, cy + p.y * sc, p.size * sc * (1.4 - al * 0.4), 0, 6.283); g.fill(); }
        else { if (p.kind === 2) p.vx += Math.sin(time * 5 + p.max * 20) * 30 * dt; g.globalAlpha = al; g.fillStyle = p.color; g.fillRect(cx + p.x * sc - p.size * 0.5, cy + p.y * sc - p.size * 0.5, p.size * sc, p.size * sc); }
      }
      g.globalAlpha = 1;
      // damage numbers
      if (nums.length) {
        g.textAlign = 'center'; g.lineJoin = 'round';
        for (i = nums.length - 1; i >= 0; i--) {
          var nm = nums[i]; nm.t += dt;
          if (nm.t > 0.7) { nums.splice(i, 1); continue; }
          var fs = (nm.crit ? 15 : 11) * Math.max(0.85, sc) * S.textScale;
          g.font = '700 ' + fs + 'px system-ui, sans-serif';
          g.globalAlpha = 1 - nm.t / 0.7;
          var nx = cx + nm.x * sc, ny = cy + (nm.y - nm.t * 34) * sc;
          g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 3; g.strokeText(nm.txt, nx, ny);
          g.fillStyle = nm.crit ? '#ffe45c' : '#ffffff'; g.fillText(nm.txt, nx, ny);
        }
        g.globalAlpha = 1;
      }
      // hurt vignette / flash
      if (hurtT > 0) {
        hurtT -= dt;
        var vg = g.createRadialGradient(W / 2, cy, Math.min(W, H) * 0.3, W / 2, cy, Math.max(W, H) * 0.75);
        vg.addColorStop(0, 'rgba(255,40,40,0)'); vg.addColorStop(1, 'rgba(255,40,40,' + Math.max(0, hurtT) * 1.4 + ')');
        g.fillStyle = vg; g.fillRect(0, 0, W, H);
      }
      if (flash > 0) { flash -= dt; g.fillStyle = 'rgba(255,240,210,' + Math.max(0, flash) + ')'; g.fillRect(0, 0, W, H); }
    }
  };

  function hexagon(x, y, r, rot) {
    g.beginPath();
    for (var i = 0; i < 6; i++) { var a = rot + i / 6 * 6.283; if (i) g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.closePath();
  }

  function drawFlame(x, y, s, f, still) {
    var t = still ? 0 : time;
    g.globalCompositeOperation = 'lighter';
    drawGlow(f.glow, x, y - 8 * s, 46 * s, 0.75);
    g.globalCompositeOperation = 'source-over';
    var layers = [[f.out, 13, 30, 0], [f.mid, 9, 21, 1.7], [f.core, 5, 12, 3.1]];
    for (var i = 0; i < 3; i++) {
      var L = layers[i], w = L[1] * s, h = L[2] * s * (1 + Math.sin(t * 7 + L[3]) * 0.08), sway = Math.sin(t * 4.3 + L[3]) * 3 * s;
      g.fillStyle = L[0];
      g.beginPath();
      g.moveTo(x - w, y);
      g.bezierCurveTo(x - w * 1.25, y - h * 0.45, x - w * 0.25 + sway, y - h * 0.6, x + sway, y - h);
      g.bezierCurveTo(x + w * 0.25 + sway, y - h * 0.6, x + w * 1.25, y - h * 0.45, x + w, y);
      g.quadraticCurveTo(x, y + w * 0.7, x - w, y);
      g.fill();
    }
  }

  function drawEnemy(e, cx, cy, sc, contrast, range) {
    var x = cx + e.x * sc, y = cy + e.y * sc, r = e.r * sc;
    var d = Math.sqrt(e.x * e.x + e.y * e.y) || 1, fx = -e.x / d, fy = -e.y / d;
    var lit = d < range, bob = Math.sin(e.wob + e.seed) * r * 0.12;
    var body = e.hit > 0 ? '#ffffff' : (lit ? '#120d1a' : '#1d162b');
    y += bob;
    if (e.boss) { g.globalCompositeOperation = 'lighter'; drawGlow('255,40,80', x, y, r * 2.4, 0.35 + 0.1 * Math.sin(time * 4)); g.globalCompositeOperation = 'source-over'; }
    g.fillStyle = body;
    g.beginPath();
    switch (e.type) {
      case 'wisp': // teardrop, tail away from the ember
        g.moveTo(x + fx * r, y + fy * r);
        g.quadraticCurveTo(x - fy * r * 1.1, y + fx * r * 1.1, x - fx * r * 2.4, y - fy * r * 2.4);
        g.quadraticCurveTo(x + fy * r * 1.1, y - fx * r * 1.1, x + fx * r, y + fy * r);
        break;
      case 'brute': // horned block
        rrect(x - r, y - r * 0.9, r * 2, r * 1.9, r * 0.45);
        g.moveTo(x - r * 0.9, y - r * 0.6); g.lineTo(x - r * 1.35, y - r * 1.5); g.lineTo(x - r * 0.3, y - r * 0.9);
        g.moveTo(x + r * 0.9, y - r * 0.6); g.lineTo(x + r * 1.35, y - r * 1.5); g.lineTo(x + r * 0.3, y - r * 0.9);
        break;
      case 'spitter': // spiky star
        for (var i = 0; i < 14; i++) { var a = i / 14 * 6.283 + time * 0.8, rr = i % 2 ? r * 0.7 : r * 1.25; if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        break;
      case 'splitter': // cluster of three
        g.arc(x - r * 0.45, y + r * 0.3, r * 0.62, 0, 6.283); g.moveTo(x + r * 1.07, y + r * 0.3); g.arc(x + r * 0.45, y + r * 0.3, r * 0.62, 0, 6.283); g.moveTo(x + r * 0.62, y - r * 0.4); g.arc(x, y - r * 0.4, r * 0.62, 0, 6.283);
        break;
      case 'boss': // crowned mass
        g.arc(x, y, r, 0, 6.283);
        for (var c = -2; c <= 2; c++) { g.moveTo(x + c * r * 0.36 - r * 0.2, y - r * 0.85); g.lineTo(x + c * r * 0.36, y - r * (1.55 - Math.abs(c) * 0.15)); g.lineTo(x + c * r * 0.36 + r * 0.2, y - r * 0.85); }
        break;
      default: // shade / mite: ghost blob with a wavy hem
        g.arc(x, y - r * 0.15, r, Math.PI, 0);
        g.lineTo(x + r, y + r * 0.8);
        for (var k = 0; k < 4; k++) { var hx = x + r - (k + 0.5) * r * 0.5; g.quadraticCurveTo(hx + r * 0.12, y + r * (0.45 + 0.15 * Math.sin(time * 6 + k + e.seed)), x + r - (k + 1) * r * 0.5, y + r * 0.8); }
        g.closePath();
    }
    g.fill();
    if (contrast || e.boss) { g.strokeStyle = contrast ? '#ffffff' : 'rgba(255,60,90,0.8)'; g.lineWidth = contrast ? 1.5 : 2; g.stroke(); }
    else if (!lit) { g.strokeStyle = 'rgba(150,120,200,0.5)'; g.lineWidth = 1; g.stroke(); }
    // eyes
    var ec = EYES[e.type], ex = x + fx * r * 0.3, ey = y + fy * r * 0.3 - r * 0.1, es = Math.max(1.3, r * 0.17);
    g.fillStyle = ec;
    if (e.type === 'spitter' || e.type === 'wisp') { g.beginPath(); g.arc(ex, ey, es * 1.5, 0, 6.283); g.fill(); }
    else if (e.boss) { for (var b = -1; b <= 1; b++) { g.beginPath(); g.ellipse(ex + b * r * 0.42, ey + Math.abs(b) * r * 0.1, es, es * 1.4, 0, 0, 6.283); g.fill(); } }
    else { g.beginPath(); g.arc(ex - es * 1.7, ey, es, 0, 6.283); g.arc(ex + es * 1.7, ey, es, 0, 6.283); g.fill(); }
    // health bar
    if (e.hp < e.maxHp && (e.boss || e.type === 'brute' || e.type === 'splitter' || contrast)) {
      var bw = r * 2.2, bx = x - bw / 2, by = y - r * (e.boss ? 1.9 : 1.75);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(bx - 1, by - 1, bw + 2, 5);
      g.fillStyle = e.boss ? '#ff3355' : '#ff8a4a'; g.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3);
    }
  }
  function rrect(x, y, w, h, r) {
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
})(typeof window !== 'undefined' ? window : globalThis);
