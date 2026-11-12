/* Emberhold — game controller: economy, progression, run lifecycle, main loop. */
(function (root) {
  'use strict';
  var EH = root.EH, S = null, lastTs = 0, saveT = 0, uiT = 0, coachT = 0, hidden = false;

  function yesterday() { var d = new Date(Date.now() - 864e5); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  var G = EH.Game = {
    state: 'menu', run: null, userPaused: false, summaryOpen: false,

    // ---------- helpers ----------
    bestWaveAny: function () { return Math.max.apply(null, S.bestWave); },
    statValue: function (stat) {
      if (stat === 'bestWaveAny') return this.bestWaveAny();
      if (stat === 'tiersUnlocked') return S.maxTier + 1;
      if (stat === 'flamesOwned') return Object.keys(S.flames).length;
      return S.stats[stat] || 0;
    },
    bump: function (stat, n) {
      if (!n) return;
      S.stats[stat] = (S.stats[stat] || 0) + n;
      S.missions.stat[stat] = (S.missions.stat[stat] || 0) + n;
    },
    addEmbers: function (n) { n = Math.floor(n); if (n > 0) { S.embers += n; S.stats.embersEarned += n; } },
    addGems: function (n) { if (n > 0) S.gems += Math.floor(n); },
    spendGems: function (n) { if (S.gems < n) return false; S.gems -= n; return true; },
    emberMult: function () { return S.iap.keeper ? 1.5 : 1; },
    speedMax: function () { return this.bestWaveAny() >= 20 ? 3 : 2; },

    // ---------- workshop ----------
    wsLevel: function (id) { return S.workshop[id] || 0; },
    wsUnlocked: function (id) { var u = EH.UP[id]; return !u.unlock || S.workshop['_u_' + id] === 1; },
    wsCost: function (id) { var u = EH.UP[id]; return this.wsUnlocked(id) ? u.wcost(this.wsLevel(id)) : u.unlock; },
    wsMaxed: function (id) { return this.wsLevel(id) >= EH.UP[id].max; },
    buyWorkshop: function (id) {
      var c = this.wsCost(id);
      if (S.embers < c) return false;
      if (!this.wsUnlocked(id)) { S.embers -= c; S.workshop['_u_' + id] = 1; EH.Save.save(); return true; }
      if (this.wsMaxed(id)) return false;
      S.embers -= c; S.workshop[id] = this.wsLevel(id) + 1;
      this.bump('workshop', 1);
      return true;
    },
    canAffordWorkshop: function () {
      for (var i = 0; i < EH.UPGRADES.length; i++) {
        var u = EH.UPGRADES[i];
        if (!(this.wsUnlocked(u.id) && this.wsMaxed(u.id)) && S.embers >= this.wsCost(u.id)) return true;
      }
      return false;
    },

    // ---------- flames ----------
    flameReq: function (f) {
      var u = f.unlock;
      if (u.type === 'wave') return 'Reach wave ' + u.wave;
      if (u.type === 'tier') return 'Unlock ' + EH.TIERS[u.tier - 1].name;
      if (u.type === 'gems') return u.gems + ' gems';
      return '';
    },
    checkFlameUnlocks: function () {
      var got = [], best = this.bestWaveAny();
      EH.FLAMES.forEach(function (f) {
        if (S.flames[f.id]) return;
        var u = f.unlock;
        if ((u.type === 'wave' && best >= u.wave) || (u.type === 'tier' && S.maxTier >= u.tier - 1)) { S.flames[f.id] = 1; got.push(f); }
      });
      return got;
    },
    buyFlame: function (id) {
      var f = EH.FLAME[id];
      if (S.flames[id] || f.unlock.type !== 'gems' || !this.spendGems(f.unlock.gems)) return false;
      S.flames[id] = 1; S.flame = id; return true;
    },
    selectFlame: function (id) { if (S.flames[id]) { S.flame = id; return true; } return false; },

    // ---------- abilities ----------
    abilityLevel: function (id) { return S.abilities[id] || 0; },
    abilityLocked: function (id) { var a = EH.ABILITY[id]; return !!a.unlockWave && this.bestWaveAny() < a.unlockWave && !this.abilityLevel(id); },
    abilityCost: function (id) { return EH.ABILITY[id].costs[this.abilityLevel(id)]; },
    upgradeAbility: function (id) {
      var a = EH.ABILITY[id], l = this.abilityLevel(id);
      if (l >= a.max || this.abilityLocked(id) || !this.spendGems(a.costs[l])) return false;
      S.abilities[id] = l + 1; return true;
    },

    // ---------- missions / daily / achievements ----------
    rollMissions: function () {
      var t = EH.today();
      if (S.missions.day === t && S.missions.list.length) return;
      var best = this.bestWaveAny(), d = best < 20 ? 0 : best < 50 ? 1 : 2;
      var pool = EH.MISSIONS.slice(), list = [];
      if (best < 10) pool = pool.filter(function (m) { return m.id !== 'bosses'; });
      for (var i = 0; i < 3 && pool.length; i++) {
        var m = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        list.push({ id: m.id, d: d, claimed: false });
      }
      S.missions = { day: t, list: list, stat: {} };
    },
    missionInfo: function (m) {
      var def = null;
      EH.MISSIONS.forEach(function (x) { if (x.id === m.id) def = x; });
      if (!def) return null;
      var goal = def.n[m.d], cur = Math.min(goal, S.missions.stat[def.stat] || 0);
      return { text: def.text.replace('{n}', EH.fmt(goal)), cur: cur, goal: goal, gems: def.gems + m.d * 2, done: cur >= goal, claimed: m.claimed };
    },
    claimMission: function (i) {
      var m = S.missions.list[i], info = m && this.missionInfo(m);
      if (!info || !info.done || m.claimed) return 0;
      m.claimed = true; this.addGems(info.gems); return info.gems;
    },
    dailyReady: function () { return S.daily.lastClaim !== EH.today(); },
    dailyIndex: function () {
      var st = S.daily.streak;
      if (S.daily.lastClaim && S.daily.lastClaim !== EH.today() && S.daily.lastClaim !== yesterday()) st = 0;
      return st % 7;
    },
    claimDaily: function () {
      if (!this.dailyReady()) return null;
      var i = this.dailyIndex(), r = EH.DAILY_REWARDS[i];
      if (S.daily.lastClaim && S.daily.lastClaim !== yesterday()) S.daily.streak = 0;
      S.daily.streak++; S.daily.lastClaim = EH.today();
      var scale = 1 + S.maxTier * 1.5;
      var out = { gems: r.gems || 0, embers: Math.floor((r.embers || 0) * scale) };
      this.addGems(out.gems); this.addEmbers(out.embers);
      return out;
    },
    achInfo: function (a) {
      var c = S.ach[a.id] || 0, done = c >= a.n.length, i = Math.min(c, a.n.length - 1), v = this.statValue(a.stat);
      return { tier: c, total: a.n.length, complete: done, goal: a.n[i], cur: Math.min(v, a.n[i]), gems: a.gems[i], claimable: !done && v >= a.n[i],
        text: a.text.replace('{n}', EH.fmt(a.n[i])) };
    },
    claimAch: function (id) {
      var a = null; EH.ACHIEVEMENTS.forEach(function (x) { if (x.id === id) a = x; });
      var info = a && this.achInfo(a);
      if (!info || !info.claimable) return 0;
      S.ach[id] = info.tier + 1; this.addGems(info.gems); return info.gems;
    },
    questDot: function () {
      if (this.dailyReady()) return true;
      var self = this, any = false;
      S.missions.list.forEach(function (m) { var i = self.missionInfo(m); if (i && i.done && !m.claimed) any = true; });
      EH.ACHIEVEMENTS.forEach(function (a) { if (self.achInfo(a).claimable) any = true; });
      return any;
    },
    adGemsLeft: function () {
      if (S.adGems.day !== EH.today()) S.adGems = { day: EH.today(), n: 0 };
      return EH.AD_GEMS_PER_DAY - S.adGems.n;
    },
    watchForGems: function (cb) {
      if (this.adGemsLeft() <= 0) return cb(false);
      EH.Platform.rewarded('free_gems', function (ok) {
        if (ok) { S.adGems.n++; G.addGems(EH.AD_GEMS); EH.Save.save(); }
        cb(ok);
      });
    },

    // ---------- offline ----------
    offlineRate: function () { return S.bestEmbers * EH.UP.banked.stat(this.wsLevel('banked')); },   // embers per hour
    offlineCap: function () { return EH.OFFLINE_CAP_H + (S.iap.keeper ? 4 : 0); },
    computeOffline: function () {
      var h = (Date.now() - S.lastSeen) / 36e5;
      if (!(h > 0.08) || S.bestEmbers <= 0) return null;
      h = Math.min(h, this.offlineCap());
      var e = Math.floor(this.offlineRate() * h);
      return e > 0 ? { hours: h, embers: e } : null;
    },
    buyGemOffer: function (id) {
      var o = null; EH.GEM_OFFERS.forEach(function (x) { if (x.id === id) o = x; });
      if (!o) return 0;
      var e = Math.max(50, Math.floor(this.offlineRate() * o.hours));
      if (!this.spendGems(o.gems)) return 0;
      this.addEmbers(e); return e;
    },
    gemOfferEmbers: function (o) { return Math.max(50, Math.floor(this.offlineRate() * o.hours)); },

    // ---------- store ----------
    grant: function (sku) {
      var p = EH.PRODUCT[sku]; if (!p) return;
      if (sku === 'keeper_pack') S.iap.keeper = true;
      if (sku === 'starter_pack') { if (S.iap.starter) return; S.iap.starter = true; }
      if (p.gems) this.addGems(p.gems);
      if (p.embers) this.addEmbers(p.embers);
      EH.Save.save();
    },
    grantOwned: function (sku) {   // restored non-consumables from the store
      if (sku === 'keeper_pack' && !S.iap.keeper) { S.iap.keeper = true; EH.Save.save(); EH.UI.refresh(); }
      if (sku === 'starter_pack' && !S.iap.starter) { this.grant(sku); EH.UI.refresh(); }
    },
    purchase: function (sku) {
      EH.Platform.purchase(sku, function (ok, msg) {
        if (ok) { G.grant(sku); EH.Audio.play('reward'); EH.UI.toast('Thank you! ' + EH.PRODUCT[sku].name + ' unlocked.'); }
        else if (msg) EH.UI.toast(msg);
        EH.UI.refresh();
      });
    },

    // ---------- run lifecycle ----------
    startRun: function () {
      EH.Audio.unlock();
      this.run = new EH.Run({ tier: S.tier, workshop: S.workshop, flame: S.flame, abilities: S.abilities, emberMult: this.emberMult() });
      this.state = 'run'; this.userPaused = false; this.summaryOpen = false;
      EH.Render.clearFx();
      EH.UI.runStart();
    },
    paused: function () { return this.userPaused || hidden || EH.UI.modalOpen(); },
    buy: function (id) {
      var r = this.run; if (!r) return false;
      var mult = S.settings.buyMult, n = 0, lim = mult === 0 ? 500 : mult;
      while (n < lim && r.buy(id)) n++;
      if (n) { EH.Audio.play('buy'); if (!S.tut.buy) { S.tut.buy = 1; EH.UI.coach(null); } }
      else EH.Audio.play('deny');
      return n > 0;
    },
    cast: function (id) {
      if (this.run && !this.paused() && this.run.cast(id)) { if (!S.tut.abil) { S.tut.abil = 1; EH.UI.coach(null); } return true; }
      return false;
    },
    onRunOver: function () {
      EH.Audio.play('over'); EH.Platform.haptic(120);
      EH.UI.coach(null);
      if (!this.run.revived) EH.UI.reviveModal(); else this.finishRun();
    },
    revive: function (how) {
      var r = this.run;
      function go() { r.revive(); EH.UI.closeAll(); EH.Audio.play('reward'); }
      if (how === 'gems') { if (this.spendGems(EH.REVIVE_GEMS)) go(); else EH.UI.toast('Not enough gems'); }
      else EH.Platform.rewarded('revive', function (ok) { if (ok) go(); else EH.UI.toast('No reward — the ad was not completed.'); });
    },
    finishRun: function () {
      var r = this.run; if (!r || this.summaryOpen) return;
      this.summaryOpen = true;
      r.over = true;
      var embers = r.finalEmbers(), wave = r.wave, tier = r.tier, notes = [];
      var newBest = wave > S.bestWave[tier];
      S.pending = null;
      this.addEmbers(embers); this.addGems(r.gems);
      this.bump('kills', r.kills); this.bump('bosses', r.bossKills); this.bump('boons', r.boonsTaken);
      this.bump('waves', wave - 1); this.bump('abilities', r.abilitiesUsed); this.bump('upgrades', r.upgradesBought); this.bump('runs', 1);
      S.stats.playTime += r.time;
      var beforeBest = this.bestWaveAny();
      if (newBest) S.bestWave[tier] = wave;
      if (embers > S.bestEmbers) S.bestEmbers = embers;
      if (tier === S.maxTier && tier < EH.TIERS.length - 1 && wave >= EH.TIERS[tier + 1].unlockWave) {
        S.maxTier++; notes.push('New difficulty unlocked: <b>' + EH.TIERS[S.maxTier].name + '</b> — ×' + EH.TIERS[S.maxTier].ember + ' Embers');
      }
      this.checkFlameUnlocks().forEach(function (f) { notes.push('New flame unlocked: <b>' + f.name + '</b>'); });
      var nowBest = this.bestWaveAny();
      if (beforeBest < 20 && nowBest >= 20) notes.push('<b>3× speed</b> unlocked');
      EH.ABILITIES.forEach(function (a) { if (a.unlockWave && beforeBest < a.unlockWave && nowBest >= a.unlockWave) notes.push('Ability available in the Workshop: <b>' + a.name + '</b>'); });
      EH.Save.save();
      EH.UI.summary({ wave: wave, tier: tier, embers: embers, gems: r.gems, kills: r.kills, time: r.time, newBest: newBest, notes: notes });
    },
    doubleEmbers: function (embers, cb) {
      EH.Platform.rewarded('double_embers', function (ok) {
        if (ok) { G.addEmbers(embers); EH.Save.save(); EH.Audio.play('reward'); }
        cb(ok);
      });
    },
    toMenu: function () {
      this.run = null; this.state = 'menu'; this.summaryOpen = false;
      EH.Render.clearFx();
      EH.Audio.setMood(0, false);
      this.rollMissions();
      EH.UI.runEnd();
    },
    endRunEarly: function () { if (this.run) { this.run.revived = true; this.finishRun(); } },

    // ---------- app lifecycle ----------
    appPause: function () {
      hidden = true;
      if (this.run && !this.summaryOpen) S.pending = { embers: this.run.finalEmbers(), gems: this.run.gems };
      EH.Save.save(); EH.Audio.suspend();
    },
    appResume: function () {
      hidden = false; lastTs = 0; EH.Audio.resume();
      if (this.state === 'menu') {
        var off = this.computeOffline();
        if (off && off.hours > 0.25 && !EH.UI.modalOpen()) EH.UI.offline(off);
        this.rollMissions(); EH.UI.refresh();
      }
    },

    // ---------- loop ----------
    frame: function (ts) {
      root.requestAnimationFrame(G.frame);
      try { G.step(ts); }
      catch (e) { G.fail(e); }
    },
    step: function (ts) {
      var dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0.016; lastTs = ts;
      if (hidden) return;
      var r = this.run, i;
      if (r && this.state === 'run') {
        if (!this.paused() && !r.over) {
          var sim = dt * S.settings.speed, steps = Math.max(1, Math.ceil(sim / 0.034));
          for (i = 0; i < steps && !r.over && !r.pendingBoon; i++) r.update(sim / steps);
        }
        var boss = false;
        for (i = 0; i < r.fx.length; i++) {
          var f = r.fx[i];
          if (f.k === 'wave') { EH.UI.banner(f.boss ? 'DREAD APPROACHES' : 'WAVE ' + f.wave, f.boss); EH.Audio.play(f.boss ? 'boss' : 'wave'); }
          else if (f.k === 'boon') EH.Audio.play('boon');
          else if (f.k === 'over') this.onRunOver();
        }
        EH.Render.consume(r); r.fx.length = 0;
        for (i = 0; i < r.enemies.length; i++) if (r.enemies[i].boss && !r.enemies[i].dead) { boss = true; break; }
        EH.Audio.setMood(0.25 + Math.min(0.5, r.wave / 60) + (r.hp < r.s.maxHp * 0.35 ? 0.25 : 0), boss);
        if (r.pendingBoon && !EH.UI.modalOpen()) {
          if (S.settings.autoBoon) {
            var best = r.pendingBoon[0];
            r.pendingBoon.forEach(function (id) { if (EH.BOON[id].rar > EH.BOON[best].rar) best = id; });
            r.pickBoon(best); EH.UI.toast('Boon: ' + EH.BOON[best].name);
          } else EH.UI.boons();
        }
        uiT += dt; if (uiT > 0.12) { uiT = 0; EH.UI.runTick(); }
        coachT += dt; if (coachT > 0.4) { coachT = 0; this.tutorial(); }
      }
      EH.UI.layout();
      EH.Render.frame(dt, this.state === 'run' ? r : null, EH.FLAME[S.flame], this.state !== 'run');
      saveT += dt;
      if (saveT > 12) {
        saveT = 0;
        if (r && !this.summaryOpen) S.pending = { embers: r.finalEmbers(), gems: r.gems };
        if (!EH.Save.save() && !this._warned) { this._warned = true; EH.UI.toast('Could not save — storage is full or blocked.'); }
      }
    },
    tutorial: function () {
      var r = this.run, U = EH.UI;
      if (!r || this.paused()) return;
      if (!S.tut.buy) { if (r.cinders >= r.cost('damage')) { U.ptab('attack'); U.coach('[data-up="damage"] .buy', 'Tap to spend Cinders ◆ and grow stronger.'); } }
      else if (!S.tut.def && r.upgradesBought >= 4 && U.tab !== 'defense') U.coach('[data-tab="defense"]', 'Shades hit back. Vitality and Rekindle keep the Ember alive.', true);
      else if (!S.tut.abil && S.tut.def && r.wave >= 3 && r.abilityReady('flare') && r.liveCount() >= 4) U.coach('[data-abil="flare"]', 'Tap Flare to scorch every shade at once.');
    },
    fail: function (e) {
      if (this._failed) return; this._failed = true;
      try { if (this.run) S.pending = { embers: this.run.finalEmbers(), gems: this.run.gems }; EH.Save.save(); } catch (x) { /* ignore */ }
      try { EH.UI.fatal(e); } catch (x) { /* ignore */ }
      if (root.console) root.console.error(e);
    },

    boot: function () {
      S = EH.Save.load();
      EH.UI.init();
      EH.Render.init(document.getElementById('cv'));
      EH.Platform.ready();
      EH.Platform.restore();
      this.rollMissions();
      this.checkFlameUnlocks();
      var recovered = null;
      if (S.pending && (S.pending.embers > 0 || S.pending.gems > 0)) {
        recovered = S.pending; this.addEmbers(S.pending.embers); this.addGems(S.pending.gems || 0);
      }
      S.pending = null;
      // Persist the recovery at once: a reload before the delayed save below must not grant the same Embers again.
      // lastSeen is kept as it was so this save does not swallow the offline-earnings window.
      if (recovered) { var seen = S.lastSeen; EH.Save.save(); S.lastSeen = seen; }
      var off = this.computeOffline();
      EH.UI.show('home');
      root.addEventListener('resize', function () { EH.Render.resize(); });
      document.addEventListener('visibilitychange', function () { if (document.hidden) G.appPause(); else G.appResume(); });
      root.addEventListener('pagehide', function () { G.appPause(); });
      root.addEventListener('error', function (ev) { G.fail(ev.error || new Error(ev.message)); });
      root.requestAnimationFrame(G.frame);
      setTimeout(function () {
        document.getElementById('splash').classList.add('out');
        document.getElementById('app').classList.remove('booting');
        EH.Render.resize();
        if (EH.Save.recovered) EH.UI.toast('Save restored from backup.');
        if (recovered) EH.UI.toast('Recovered ' + EH.fmt(recovered.embers) + ' Embers from your interrupted run.');
        if (!S.tut.welcome) EH.UI.welcome();
        else if (off) EH.UI.offline(off);
        else if (G.dailyReady()) EH.UI.daily();
        EH.Save.save();
      }, 700);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { G.boot(); });
  else G.boot();
})(window);
