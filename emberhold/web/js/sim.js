/* Emberhold — run simulation. Pure logic (no DOM) so it can be tested headless in Node. */
(function (root) {
  'use strict';
  var EH = root.EH = root.EH || {};
  var SPAWN_R = 300, EMBER_R = 15, SPARK_SPEED = 430, MAX_ENEMIES = 220;

  function Run(o) {
    this.tier = o.tier || 0;
    this.workshop = o.workshop || {};
    this.flame = o.flame || 'hearth';
    this.abilLv = o.abilities || {};
    this.emberMult = o.emberMult || 1;
    this.rand = o.rand || Math.random;
    this.lv = {};                 // run levels
    this.boons = {};
    this.wave = 0;
    this.waveT = 0;               // time into current wave
    this.toSpawn = [];            // queue of {t,type}
    this.enemies = [];
    this.sparks = [];
    this.shots = [];              // enemy projectiles
    this.fx = [];                 // presentation events, drained by renderer/audio
    this.time = 0;
    this.cinders = 0;
    this.embers = 0;
    this.gems = 0;
    this.kills = 0; this.bossKills = 0; this.boonsTaken = 0; this.upgradesBought = 0; this.abilitiesUsed = 0;
    this.cool = 0;
    this.novaT = 0;
    this.usedSecond = false;
    this.revived = false;
    this.over = false;
    this.pendingBoon = null;      // array of boon ids awaiting a choice
    this.cd = { flare: 0, ward: 0, stoke: 0 };
    this.wardT = 0; this.stokeT = 0;
    this.s = {};
    this.recompute();
    this.hp = this.s.maxHp;
    this.cinders = this.wsStat('startCinders');
    this.nextWave();
  }

  Run.prototype.level = function (id) { return (this.workshop[id] || 0) + (this.lv[id] || 0); };
  Run.prototype.wsStat = function (id) { return EH.UP[id].stat(this.workshop[id] || 0); };
  Run.prototype.b = function (id) { return this.boons[id] || 0; };

  Run.prototype.recompute = function () {
    var s = this.s, f = this.flame, self = this;
    function st(id) { return EH.UP[id].stat(self.level(id)); }
    s.dmg = st('damage') * (1 + 0.25 * this.b('kindle')) * (1 + 0.8 * this.b('glass')) * (f === 'storm' ? 0.9 : 1);
    s.speed = st('speed') * (1 + 0.15 * this.b('quick'));
    s.crit = Math.min(0.9, st('crit') + (f === 'void' ? 0.15 : 0));
    s.critMult = st('critMult') + (f === 'void' ? 1 : 0);
    s.range = Math.min(262, st('range') * (1 + 0.10 * this.b('glow')));
    s.multi = st('multishot');
    var oldMax = s.maxHp || 0;
    s.maxHp = st('health') * (1 + 0.3 * this.b('stone')) * Math.pow(0.75, this.b('glass')) *
      (f === 'frost' ? 1.15 : 1) * (f === 'void' ? 0.8 : 1);
    s.regen = st('regen') * (f === 'hearth' ? 1.25 : 1);
    s.armor = Math.min(0.75, st('armor'));
    s.thorns = st('thorns');
    s.cinderMult = st('cinderKill') * (1 + 0.3 * this.b('greed')) * (f === 'wild' ? 1.2 : 1);
    s.cinderWave = st('cinderWave') * (1 + 0.3 * this.b('greed'));
    s.emberMult = st('emberBonus') * (1 + 0.2 * this.b('yield')) * this.emberMult;
    s.chain = this.b('chain') + (f === 'storm' ? 1 : 0);
    s.burn = 0.4 * this.b('sear') + (f === 'wild' ? 0.4 : 0);
    s.slow = Math.min(0.7, 0.12 * this.b('frost') + (f === 'frost' ? 0.2 : 0));
    s.luck = this.wsStat('boonLuck');
    if (oldMax && s.maxHp > oldMax && this.hp != null) this.hp += s.maxHp - oldMax;
    if (this.hp > s.maxHp) this.hp = s.maxHp;
  };

  // ----- upgrades -----
  Run.prototype.unlocked = function (id) {
    var u = EH.UP[id];
    return !u.workshopOnly && (!u.unlock || (this.workshop['_u_' + id] === 1));
  };
  Run.prototype.cost = function (id) { return EH.UP[id].cost(this.lv[id] || 0); };
  Run.prototype.maxed = function (id) { return this.level(id) >= EH.UP[id].max; };
  Run.prototype.buy = function (id) {
    if (this.over || !this.unlocked(id) || this.maxed(id)) return false;
    var c = this.cost(id);
    if (this.cinders < c) return false;
    this.cinders -= c;
    this.lv[id] = (this.lv[id] || 0) + 1;
    this.upgradesBought++;
    this.recompute();
    return true;
  };

  // ----- waves -----
  Run.prototype.nextWave = function () {
    this.wave++;
    this.waveT = 0;
    var w = this.wave, n = EH.waveCount(w), i, types = [];
    var E = EH.ENEMIES;
    for (i = 0; i < n; i++) {
      var r = this.rand(), t = 'shade';
      if (w >= E.splitter.from && r < 0.10) t = 'splitter';
      else if (w >= E.spitter.from && r < 0.24) t = 'spitter';
      else if (w >= E.brute.from && r < 0.36) t = 'brute';
      else if (w >= E.wisp.from && r < 0.58) t = 'wisp';
      types.push(t);
    }
    for (i = 0; i < n; i++) this.toSpawn.push({ t: (i / n) * EH.WAVE_SPAWN_TIME, type: types[i] });
    var boss = w % EH.BOSS_EVERY === 0;
    if (boss) this.toSpawn.push({ t: 2, type: 'boss' });
    this.toSpawn.sort(function (a, b) { return a.t - b.t; });
    this.fx.push({ k: 'wave', wave: w, boss: boss });
  };

  Run.prototype.spawn = function (type, x, y) {
    if (this.enemies.length >= MAX_ENEMIES) return null;
    var d = EH.ENEMIES[type], w = this.wave;
    if (x == null) {
      var a = this.rand() * Math.PI * 2;
      var R = Math.min(SPAWN_R, this.s.range * 1.5 + 25);
      x = Math.cos(a) * R; y = Math.sin(a) * R;
    }
    var hp = EH.enemyHp(w, this.tier) * d.hp;
    var e = { type: type, x: x, y: y, hp: hp, maxHp: hp, dmg: EH.enemyDmg(w, this.tier) * d.dmg,
      speed: d.speed * (0.9 + this.rand() * 0.2), r: d.r, atk: 0.4, burn: 0, burnT: 0, hit: 0,
      cinder: EH.enemyCinder(w) * d.cinder, boss: !!d.boss, ranged: d.ranged || 0, dead: false,
      seed: this.rand() * 1000, wob: 0 };
    this.enemies.push(e);
    return e;
  };

  // ----- combat -----
  Run.prototype.hurt = function (e, dmg, crit, quiet) {
    if (e.dead) return;
    if ((e.boss || e.type === 'brute') && this.b('slayer')) dmg *= 1 + 0.7 * this.b('slayer');
    e.hp -= dmg; e.hit = 0.12;
    if (!quiet) this.fx.push({ k: 'hit', x: e.x, y: e.y, dmg: dmg, crit: crit });
    if (e.hp <= 0) this.kill(e);
  };

  Run.prototype.kill = function (e) {
    e.dead = true;
    this.kills++;
    var c = e.cinder * this.s.cinderMult;
    this.cinders += c;
    this.fx.push({ k: 'die', x: e.x, y: e.y, type: e.type, r: e.r, boss: e.boss, cinder: c });
    if (e.boss) {
      this.bossKills++; this.gems += 1;
      this.embers += EH.emberForWave(this.wave, this.tier) * 4 * this.s.emberMult;
      this.fx.push({ k: 'gem', x: e.x, y: e.y });
    }
    if (this.b('leech')) this.hp = Math.min(this.s.maxHp, this.hp + this.s.maxHp * 0.01 * this.b('leech'));
    var d = EH.ENEMIES[e.type];
    if (d.split) for (var i = 0; i < d.split; i++) {
      var a = this.rand() * 6.283;
      this.spawn('mite', e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10);
    }
    if (this.b('splint') && this.rand() < 0.25) {
      var R = 38 + 6 * this.b('splint'), dm = this.s.dmg * (0.8 + 0.3 * this.b('splint'));
      this.fx.push({ k: 'boom', x: e.x, y: e.y, r: R });
      for (var j = 0; j < this.enemies.length; j++) {
        var o = this.enemies[j];
        if (!o.dead && o !== e && (o.x - e.x) * (o.x - e.x) + (o.y - e.y) * (o.y - e.y) < R * R) this.hurt(o, dm, false, true);
      }
    }
  };

  Run.prototype.targets = function (n) {
    var out = [], r2 = this.s.range * this.s.range, es = this.enemies, i, e, d;
    for (i = 0; i < es.length; i++) {
      e = es[i]; if (e.dead) continue;
      d = e.x * e.x + e.y * e.y;
      if (d <= r2) { e._d = d; out.push(e); }
    }
    if (out.length > n) { out.sort(function (a, b) { return a._d - b._d; }); out.length = n; }
    else if (out.length > 1) out.sort(function (a, b) { return a._d - b._d; });
    return out;
  };

  Run.prototype.fire = function (e, chain, mult) {
    this.sparks.push({ x: 0, y: 0, tgt: e, chain: chain, mult: mult || 1, life: 2 });
  };

  Run.prototype.sparkHit = function (sp) {
    var e = sp.tgt, s = this.s;
    var crit = this.rand() < s.crit;
    var dmg = s.dmg * sp.mult * (crit ? s.critMult : 1);
    if (s.burn > 0) { e.burn = Math.max(e.burn, s.dmg * s.burn); e.burnT = 3; }
    this.hurt(e, dmg, crit);
    if (sp.chain > 0) {
      var best = null, bd = 90 * 90, es = this.enemies;
      for (var i = 0; i < es.length; i++) {
        var o = es[i]; if (o.dead || o === e) continue;
        var d = (o.x - e.x) * (o.x - e.x) + (o.y - e.y) * (o.y - e.y);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        this.sparks.push({ x: e.x, y: e.y, tgt: best, chain: sp.chain - 1, mult: sp.mult * 0.6, life: 1 });
      }
    }
  };

  Run.prototype.damageEmber = function (dmg, src) {
    if (this.wardT > 0 || this.over) return;
    dmg *= (1 - this.s.armor);
    this.hp -= dmg;
    this.fx.push({ k: 'ouch', dmg: dmg });
    if (src && this.s.thorns > 0 && !src.dead) {
      this.hurt(src, src.maxHp * this.s.thorns * (src.boss ? 0.35 : 1), false, true);
    }
    if (this.hp <= 0) {
      if (this.b('second') && !this.usedSecond) {
        this.usedSecond = true; this.hp = this.s.maxHp * 0.5; this.wardT = 2;
        this.fx.push({ k: 'revive' });
      } else { this.hp = 0; this.over = true; this.fx.push({ k: 'over' }); }
    }
  };

  // ----- boons -----
  Run.prototype.rollBoons = function () {
    var self = this, pool = EH.BOONS.filter(function (b) { return self.b(b.id) < b.max; });
    var out = [];
    for (var n = 0; n < 3 && pool.length; n++) {
      var tot = 0, i;
      var ws = pool.map(function (b) { var w = EH.RARITY[b.rar].w * (b.rar > 0 ? self.s.luck : 1); tot += w; return w; });
      var r = this.rand() * tot;
      for (i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) break; }
      i = Math.min(i, pool.length - 1);
      out.push(pool[i].id); pool.splice(i, 1);
    }
    return out;
  };
  Run.prototype.pickBoon = function (id) {
    if (!this.pendingBoon || this.pendingBoon.indexOf(id) < 0) return false;
    this.boons[id] = (this.boons[id] || 0) + 1;
    this.boonsTaken++;
    this.pendingBoon = null;
    this.recompute();
    if (id === 'stone') this.hp = this.s.maxHp;
    this.fx.push({ k: 'boon', id: id });
    return true;
  };
  Run.prototype.reroll = function () { if (this.pendingBoon) this.pendingBoon = this.rollBoons(); };

  // ----- abilities -----
  Run.prototype.abilityReady = function (id) { return (this.abilLv[id] || 0) > 0 && this.cd[id] <= 0 && !this.over; };
  Run.prototype.cast = function (id) {
    if (!this.abilityReady(id)) return false;
    var l = this.abilLv[id], i;
    this.cd[id] = EH.ABILITY[id].cd;
    this.abilitiesUsed++;
    if (id === 'flare') {
      var dm = this.s.dmg * (4 + 1.5 * l);
      for (i = this.enemies.length - 1; i >= 0; i--) {
        var e = this.enemies[i];
        if (!e.dead && e.x * e.x + e.y * e.y < 280 * 280) this.hurt(e, dm, true);
      }
    } else if (id === 'ward') this.wardT = 3 + l;
    else if (id === 'stoke') this.stokeT = 6 + 2 * l;
    this.fx.push({ k: 'cast', id: id });
    return true;
  };

  Run.prototype.revive = function () {
    if (!this.over || this.revived) return false;
    this.revived = true; this.over = false;
    this.hp = this.s.maxHp; this.wardT = 3;
    // push the dark back
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i], d = Math.sqrt(e.x * e.x + e.y * e.y) || 1;
      if (d < 200 && !e.boss) { e.x = e.x / d * 230; e.y = e.y / d * 230; }
    }
    this.shots.length = 0;
    this.fx.push({ k: 'revive' });
    return true;
  };

  // ----- main update -----
  Run.prototype.update = function (dt) {
    if (this.over || this.pendingBoon) return;
    var s = this.s, i, e, d;
    this.time += dt; this.waveT += dt;
    if (this.wardT > 0) this.wardT -= dt;
    if (this.stokeT > 0) this.stokeT -= dt;
    for (var k in this.cd) if (this.cd[k] > 0) this.cd[k] -= dt;

    // spawning
    while (this.toSpawn.length && this.toSpawn[0].t <= this.waveT) this.spawn(this.toSpawn.shift().type);

    // wave end
    if (this.waveT >= EH.WAVE_TIME || (this.toSpawn.length === 0 && this.liveCount() === 0 && this.waveT > 1.5)) {
      var w = this.wave;
      var bonus = s.cinderWave * (1 + w * 0.08);
      this.cinders += bonus;
      this.embers += EH.emberForWave(w, this.tier) * s.emberMult;
      this.fx.push({ k: 'waveEnd', wave: w, cinder: bonus });
      this.toSpawnCarry();
      if (w % EH.BOON_EVERY === 0) { this.pendingBoon = this.rollBoons(); if (!this.pendingBoon.length) this.pendingBoon = null; }
      this.nextWave();
      if (this.pendingBoon) return;
    }

    // regen
    if (this.hp < s.maxHp) this.hp = Math.min(s.maxHp, this.hp + s.regen * dt);

    // firing
    var spd = s.speed * (this.stokeT > 0 ? 2 : 1) * ((this.b('frenzy') && this.hp < s.maxHp * 0.5) ? 1 + 0.6 * this.b('frenzy') : 1);
    this.cool -= dt;
    var guard = 0;
    while (this.cool <= 0 && guard++ < 8) {
      var extra = Math.floor(s.multi) + (this.rand() < (s.multi % 1) ? 1 : 0);
      var ts = this.targets(1 + extra);
      if (!ts.length) { this.cool = 0; break; }
      for (i = 0; i < ts.length; i++) this.fire(ts[i], s.chain, 1);
      this.fx.push({ k: 'shoot' });
      this.cool += 1 / spd;
    }

    // nova
    if (this.b('nova')) {
      this.novaT += dt;
      if (this.novaT >= 7) {
        this.novaT = 0;
        var nd = s.dmg * (2.5 + 1.0 * (this.b('nova') - 1)), r2 = s.range * s.range;
        this.fx.push({ k: 'nova', r: s.range });
        for (i = this.enemies.length - 1; i >= 0; i--) {
          e = this.enemies[i];
          if (!e.dead && e.x * e.x + e.y * e.y <= r2) this.hurt(e, nd, false, true);
        }
      }
    }

    // sparks
    for (i = this.sparks.length - 1; i >= 0; i--) {
      var sp = this.sparks[i];
      sp.life -= dt;
      if (sp.tgt.dead || sp.life <= 0) {
        var nt = sp.tgt.dead && sp.life > 0 ? this.nearestTo(sp.x, sp.y, 120) : null;
        if (nt) sp.tgt = nt; else { this.sparks.splice(i, 1); continue; }
      }
      var dx = sp.tgt.x - sp.x, dy = sp.tgt.y - sp.y;
      d = Math.sqrt(dx * dx + dy * dy);
      var step = SPARK_SPEED * dt;
      if (d <= step + sp.tgt.r) { sp.x = sp.tgt.x; sp.y = sp.tgt.y; this.sparkHit(sp); this.sparks.splice(i, 1); }
      else { sp.x += dx / d * step; sp.y += dy / d * step; }
    }

    // enemies
    var range2 = s.range * s.range;
    for (i = this.enemies.length - 1; i >= 0; i--) {
      e = this.enemies[i];
      if (e.dead) { this.enemies.splice(i, 1); continue; }
      if (e.hit > 0) e.hit -= dt;
      if (e.burnT > 0) {
        e.burnT -= dt; e.hp -= e.burn * dt;
        if (e.hp <= 0) { this.kill(e); continue; }
      }
      d = Math.sqrt(e.x * e.x + e.y * e.y) || 0.001;
      var stop = e.ranged ? e.ranged : EMBER_R + e.r;
      if (d > stop) {
        var v = e.speed * ((s.slow > 0 && d * d < range2) ? (1 - s.slow * (e.boss ? 0.5 : 1)) : 1) * dt;
        v = Math.min(v, d - stop);
        e.x -= e.x / d * v; e.y -= e.y / d * v;
        e.wob += dt * e.speed * 0.25;
      } else {
        e.atk -= dt;
        if (e.atk <= 0) {
          e.atk = e.ranged ? 1.6 : 1;
          if (e.ranged) this.shots.push({ x: e.x, y: e.y, dmg: e.dmg, src: e });
          else { this.damageEmber(e.dmg, e); this.fx.push({ k: 'bite', x: e.x, y: e.y }); if (this.over) return; }
        }
      }
    }
    // enemy shots
    for (i = this.shots.length - 1; i >= 0; i--) {
      var sh = this.shots[i];
      d = Math.sqrt(sh.x * sh.x + sh.y * sh.y) || 0.001;
      var mv = 120 * dt;
      if (d <= EMBER_R + mv) { this.shots.splice(i, 1); this.damageEmber(sh.dmg, null); if (this.over) return; }
      else { sh.x -= sh.x / d * mv; sh.y -= sh.y / d * mv; }
    }
  };

  Run.prototype.toSpawnCarry = function () {
    // unspawned leftovers of the previous wave arrive at the start of the next one
    for (var i = 0; i < this.toSpawn.length; i++) this.toSpawn[i].t = i * 0.15;
  };
  Run.prototype.liveCount = function () {
    var n = 0; for (var i = 0; i < this.enemies.length; i++) if (!this.enemies[i].dead) n++; return n;
  };
  Run.prototype.nearestTo = function (x, y, maxD) {
    var best = null, bd = maxD * maxD;
    for (var i = 0; i < this.enemies.length; i++) {
      var o = this.enemies[i]; if (o.dead) continue;
      var d = (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  };
  Run.prototype.finalEmbers = function () { return Math.floor(this.embers); };

  EH.Run = Run;
  EH.SPAWN_R = SPAWN_R;
})(typeof window !== 'undefined' ? window : globalThis);
