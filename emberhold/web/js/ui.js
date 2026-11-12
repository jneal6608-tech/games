/* Emberhold — DOM UI: screens, HUD, modals, toasts, coach marks. */
(function (root) {
  'use strict';
  var EH = root.EH, G, S, $ = function (id) { return document.getElementById(id); };
  var cur = 'home', wsTab = 'attack', rows = {}, abilEls = {}, bannerT = null, coachSel = null;
  var fmt = EH.fmt;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var UI = EH.UI = {
    tab: 'attack',

    init: function () {
      G = EH.Game; S = EH.Save.data;
      $('app').addEventListener('click', onClick);
      $('app').addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('role') === 'button') { e.preventDefault(); e.target.click(); } });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') UI.back(); });
      document.addEventListener('pointerdown', function () { EH.Audio.unlock(); }, { passive: true });
      this.applySettings();
    },
    applySettings: function () {
      var st = S.settings, a = $('app');
      document.documentElement.style.fontSize = (16 * st.textScale) + 'px';
      a.classList.toggle('contrast', !!st.contrast);
      a.classList.toggle('reduce', !!st.reduceMotion);
      a.classList.toggle('left', !!st.leftHand);
      EH.Audio.applyVolume();
    },

    // ---------- navigation ----------
    show: function (name) {
      cur = name;
      ['home', 'workshop', 'flames', 'quests', 'shop'].forEach(function (n) { $(n).classList.toggle('on', n === name); });
      var nb = document.querySelectorAll('#nav button');
      for (var i = 0; i < nb.length; i++) nb[i].classList.toggle('on', nb[i].getAttribute('data-to') === name);
      if (name === 'workshop' && !S.tut.workshop && S.stats.runs > 0) { S.tut.workshop = 1; UI.coach(null); }
      this.refresh();
    },
    refresh: function () {
      S = EH.Save.data;
      $('tEmbers').textContent = fmt(S.embers); $('tGems').textContent = fmt(S.gems);
      if (G.state === 'run') return;
      ({ home: home, workshop: workshop, flames: flames, quests: quests, shop: shop })[cur]();
      var nb = document.querySelectorAll('#nav button');
      nb[0].classList.toggle('has-dot', G.canAffordWorkshop());
      nb[3].classList.toggle('has-dot', G.questDot());
      var needWs = !S.tut.workshop && S.stats.runs > 0 && cur !== 'workshop';
      nb[0].classList.toggle('pulse', needWs);
      if (needWs && !UI.modalOpen()) UI.coach('#nav button[data-to="workshop"]', 'Embers 🔥 are permanent. Spend them in the Workshop.');
    },
    layout: function () {
      var el = G.state === 'run' ? $('playfield') : document.querySelector('.home-mid'), R = EH.Render;
      if (G.state !== 'run' && cur !== 'home') { R.setView(root.innerWidth / 2, root.innerHeight * 0.36, Math.min(root.innerWidth, 560) * 0.62); return; }
      if (!el) return;
      var b = el.getBoundingClientRect();
      if (!b.width) return;
      if (G.state === 'run') R.setView(b.left + b.width / 2, b.top + b.height / 2, Math.min(Math.max(b.width, b.height) / 2, Math.min(b.width, b.height) * 0.62));
      else R.setView(b.left + b.width / 2, b.top + b.height * 0.56, Math.min(b.width, 560) * 0.62);
    },
    back: function () {
      var m = $('modals').lastElementChild;
      if (m) { if (m.getAttribute('data-lock') !== '1') UI.close(m); return true; }
      if (G.state === 'run') { UI.pause(); return true; }
      if (cur !== 'home') { UI.show('home'); return true; }
      return false;
    },

    // ---------- run HUD ----------
    runStart: function () {
      $('run').classList.remove('hidden'); $('topbar').classList.add('hidden'); $('screens').classList.add('hidden'); $('nav').classList.add('hidden');
      UI.coach(null);
      $('hTier').textContent = EH.TIERS[G.run.tier].name;
      S.settings.speed = Math.min(S.settings.speed, G.speedMax());
      $('hSpeed').textContent = S.settings.speed + '×';
      multLabel();
      var h = '';
      EH.ABILITIES.forEach(function (a) {
        if (G.abilityLevel(a.id) > 0) h += '<button class="abil" data-act="cast" data-abil="' + a.id + '" aria-label="' + a.name + '">' + a.icon + '<span class="mask"></span><small></small></button>';
      });
      $('abilities').innerHTML = h; abilEls = {};
      var bs = $('abilities').children;
      for (var i = 0; i < bs.length; i++) abilEls[bs[i].getAttribute('data-abil')] = bs[i];
      UI.ptab('attack', true);
      UI.runTick();
    },
    runEnd: function () {
      $('run').classList.add('hidden'); $('topbar').classList.remove('hidden'); $('screens').classList.remove('hidden'); $('nav').classList.remove('hidden');
      UI.show('home');
    },
    ptab: function (tab, force) {
      if (UI.tab === tab && !force) return;
      UI.tab = tab;
      if (tab === 'defense' && !S.tut.def) { S.tut.def = 1; UI.coach(null); }
      var tb = document.querySelectorAll('#ptabs [data-tab]');
      for (var i = 0; i < tb.length; i++) tb[i].classList.toggle('on', tb[i].getAttribute('data-tab') === tab);
      var h = '', r = G.run; rows = {};
      EH.UPGRADES.forEach(function (u) {
        if (u.tab !== tab || u.workshopOnly) return;
        if (!r.unlocked(u.id)) { h += '<div class="row locked"><div class="icn">🔒</div><div class="info"><b>' + u.name + '</b><small>Unlock in the Workshop</small></div></div>'; return; }
        h += '<div class="row" data-up="' + u.id + '"><div class="icn">' + u.icon + '</div><div class="info"><b>' + u.name + '</b><span class="val"></span></div>' +
          '<button class="buy" data-act="buy" data-id="' + u.id + '" aria-label="Upgrade ' + u.name + '"><span class="c"></span><small></small></button></div>';
      });
      $('plist').innerHTML = h; $('plist').scrollTop = 0;
      var els = $('plist').querySelectorAll('[data-up]');
      for (i = 0; i < els.length; i++) rows[els[i].getAttribute('data-up')] = { val: els[i].querySelector('.val'), buy: els[i].querySelector('.buy'), c: els[i].querySelector('.c'), s: els[i].querySelector('small') };
      UI.runTick();
    },
    runTick: function () {
      var r = G.run; if (!r) return;
      $('hWave').textContent = 'Wave ' + r.wave;
      $('hHpBar').style.transform = 'scaleX(' + Math.max(0, r.hp / r.s.maxHp) + ')';
      $('hHp').textContent = fmt(Math.ceil(r.hp)) + ' / ' + fmt(r.s.maxHp);
      $('hWaveBar').style.transform = 'scaleX(' + Math.min(1, r.waveT / EH.WAVE_TIME) + ')';
      $('hCinders').textContent = fmt(Math.floor(r.cinders)); $('hEmbers').textContent = fmt(r.finalEmbers());
      $('hBoonN').textContent = r.boonsTaken;
      var mult = S.settings.buyMult;
      for (var id in rows) {
        var u = EH.UP[id], w = rows[id], L = r.level(id);
        if (r.maxed(id)) { set(w.val, u.show(u.stat(L))); set(w.c, 'MAX'); set(w.s, ''); w.buy.className = 'buy max'; continue; }
        var n = 0, cost = 0, lv = r.lv[id] || 0, lim = mult === 0 ? 500 : mult;
        while (n < lim && L + n < u.max) { var c = u.cost(lv + n); if (mult === 0 && n > 0 && cost + c > r.cinders) break; cost += c; n++; }
        set(w.val, u.show(u.stat(L)) + ' <em>→ ' + u.show(u.stat(L + n)) + '</em>', true);
        set(w.c, '◆ ' + fmt(cost)); set(w.s, 'LV ' + L + (n > 1 ? '  +' + n : ''));
        w.buy.className = 'buy' + (r.cinders >= cost ? ' can' : '');
      }
      for (var a in abilEls) {
        var el = abilEls[a], cd = r.cd[a], tot = EH.ABILITY[a].cd;
        el.classList.toggle('cd', cd > 0);
        el.children[0].style.height = (cd > 0 ? cd / tot * 100 : 0) + '%';
        set(el.children[1], cd > 0 ? Math.ceil(cd) + 's' : '');
      }
      if (coachSel) UI.coach(coachSel.sel, coachSel.text, coachSel.up);
    },
    banner: function (text, boss) {
      var b = $('banner'); b.textContent = text; b.className = 'show' + (boss ? ' boss' : '');
      clearTimeout(bannerT); bannerT = setTimeout(function () { b.className = ''; }, boss ? 2600 : 1500);
    },

    // ---------- coach marks ----------
    coach: function (sel, text, up) {
      var c = $('coach');
      if (!sel) { coachSel = null; c.classList.add('hidden'); return; }
      var t = document.querySelector(sel);
      if (!t || !t.getBoundingClientRect().width) { c.classList.add('hidden'); coachSel = null; return; }
      coachSel = { sel: sel, text: text, up: up };
      c.textContent = text; c.classList.remove('hidden'); c.classList.toggle('up', !!up);
      var b = t.getBoundingClientRect(), a = $('app').getBoundingClientRect(), cw = c.offsetWidth, ch = c.offsetHeight;
      var x = Math.max(8, Math.min(a.width - cw - 8, b.left - a.left + b.width / 2 - cw / 2));
      c.style.left = x + 'px';
      c.style.top = (up ? b.bottom - a.top + 12 : b.top - a.top - ch - 12) + 'px';
      c.style.setProperty('--ax', (b.left - a.left + b.width / 2 - x) + 'px');
    },

    // ---------- modals ----------
    modalOpen: function () { return $('modals').childElementCount > 0; },
    modal: function (html, lock) {
      var m = document.createElement('div');
      m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
      if (lock) m.setAttribute('data-lock', '1');
      m.innerHTML = '<div class="sheet">' + html + '</div>';
      $('modals').appendChild(m);
      UI.coach(null);
      var f = m.querySelector('button'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      return m;
    },
    close: function (m) { if (m && m.parentNode) m.parentNode.removeChild(m); if (!UI.modalOpen()) UI.refresh(); },
    closeAll: function () { $('modals').innerHTML = ''; UI.refresh(); },
    toast: function (text) {
      var t = document.createElement('div'); t.className = 'toast'; t.textContent = text;
      $('toasts').appendChild(t);
      while ($('toasts').childElementCount > 3) $('toasts').removeChild($('toasts').firstChild);
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2900);
    },
    confirm: function (title, text, cb) {
      var m = UI.modal('<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p><div class="btns"><button class="btn primary" data-k="y">Confirm</button><button class="btn ghost" data-k="n">Cancel</button></div>');
      m.addEventListener('click', function (e) { var k = e.target.closest('[data-k]'); if (!k) return; UI.close(m); cb(k.getAttribute('data-k') === 'y'); });
    },
    fakeAd: function (cb) {   // web / preview builds only: stands in for a rewarded video
      var m = UI.modal('<div class="adcard"><h2>Sponsored break</h2><p>Preview build — a rewarded video plays here in the Android app.</p><div class="spin"></div><p id="adT">Reward in 3…</p></div>', true);
      var n = 3, iv = setInterval(function () {
        n--; var t = m.querySelector('#adT'); if (t) t.textContent = 'Reward in ' + n + '…';
        if (n <= 0) { clearInterval(iv); UI.close(m); cb(true); }
      }, 700);
    },
    welcome: function () {
      var m = UI.modal('<div class="logo sm" style="margin-bottom:10px"><span>EMBER</span><span>HOLD</span></div>' +
        '<p>The night is full of shades, and yours is the last fire burning.</p>' +
        '<div class="stats" style="grid-template-columns:auto 1fr"><span>🔥</span><span style="text-align:left;font-weight:400">The Ember fights on its own. You decide how it grows.</span>' +
        '<span class="cinc">◆</span><span style="text-align:left;font-weight:400">Spend Cinders during a run. They are gone when the fire dies.</span>' +
        '<span class="embc">✦</span><span style="text-align:left;font-weight:400">Embers are forever. Every run makes the next one stronger.</span></div>' +
        '<div class="btns"><button class="btn primary big wide" data-k="go">BEGIN</button></div>', true);
      m.addEventListener('click', function (e) { if (!e.target.closest('[data-k]')) return; S.tut.welcome = 1; EH.Audio.unlock(); EH.Audio.play('click'); $('modals').innerHTML = ''; G.startRun(); });
    },
    boons: function () {
      var r = G.run, free = S.freeReroll !== EH.today();
      function body() {
        var h = '<h2>Choose a Boon</h2><p>It lasts until this fire dies.</p>';
        r.pendingBoon.forEach(function (id) {
          var b = EH.BOON[id], rr = EH.RARITY[b.rar], have = r.b(id);
          h += '<button class="boon" data-boon="' + id + '" style="--rc:' + rr.color + '"><small>' + rr.name + '</small><b>' + b.name + (have ? ' <span class="tag">owned ×' + have + '</span>' : '') + '</b><span>' + b.desc + '</span></button>';
        });
        h += '<div class="btns"><button class="btn ghost" data-k="re">↻ Reroll ' + (free ? '<small>(free today)</small>' : '<small class="gemc">◈ ' + EH.REROLL_GEMS + '</small>') + '</button></div>';
        return h;
      }
      var m = UI.modal(body(), true);
      m.addEventListener('click', function (e) {
        var b = e.target.closest('[data-boon]');
        if (b) { r.pickBoon(b.getAttribute('data-boon')); UI.close(m); return; }
        if (e.target.closest('[data-k="re"]')) {
          if (free) { S.freeReroll = EH.today(); free = false; }
          else if (!G.spendGems(EH.REROLL_GEMS)) { UI.toast('Not enough gems'); return; }
          r.reroll(); EH.Audio.play('click'); m.firstChild.innerHTML = body();
        }
      });
    },
    boonList: function () {
      var r = G.run, h = '<h2>Boons this run</h2>', any = false;
      EH.BOONS.forEach(function (b) { var n = r.b(b.id); if (n) { any = true; h += '<div class="boon" style="--rc:' + EH.RARITY[b.rar].color + '"><small>×' + n + '</small><b>' + b.name + '</b><span>' + b.desc + '</span></div>'; } });
      if (!any) h += '<p>None yet. You choose one every ' + EH.BOON_EVERY + ' waves.</p>';
      closable(UI.modal(h + '<div class="btns"><button class="btn" data-k="x">Close</button></div>'));
    },
    pause: function () {
      if (UI.modalOpen() || !G.run) return;
      var m = UI.modal('<h2>Paused</h2><p>Wave ' + G.run.wave + ' · ' + EH.TIERS[G.run.tier].name + '</p><div class="btns">' +
        '<button class="btn primary" data-k="x">Resume</button><button class="btn" data-k="set">Settings</button><button class="btn ghost" data-k="end">End run &amp; keep Embers</button></div>');
      m.addEventListener('click', function (e) {
        var k = e.target.closest('[data-k]'); if (!k) return; k = k.getAttribute('data-k');
        if (k === 'x') UI.close(m);
        else if (k === 'set') UI.settings();
        else UI.confirm('End this run?', 'You keep the ' + fmt(G.run.finalEmbers()) + ' Embers earned so far.', function (ok) { if (ok) { $('modals').innerHTML = ''; G.endRunEarly(); } });
      });
    },
    reviveModal: function () {
      var r = G.run, keeper = S.iap.keeper;
      var m = UI.modal('<h2>The Ember gutters…</h2><p>Wave ' + r.wave + '. Rekindle once at full health and push the dark back?</p><div class="btns">' +
        '<button class="btn ad" data-k="ad">' + (keeper ? '✚ Rekindle <small>(Keeper)</small>' : '▶ Rekindle <small>(watch ad)</small>') + '</button>' +
        '<button class="btn gemb" data-k="gems"' + (S.gems < EH.REVIVE_GEMS ? ' disabled' : '') + '>◈ ' + EH.REVIVE_GEMS + ' Rekindle</button>' +
        '<button class="btn ghost" data-k="no">Let it rest</button></div>', true);
      m.addEventListener('click', function (e) {
        var k = e.target.closest('[data-k]'); if (!k || k.disabled) return; k = k.getAttribute('data-k');
        if (k === 'no') { $('modals').innerHTML = ''; G.finishRun(); } else G.revive(k);
      });
    },
    summary: function (o) {
      var doubled = false;
      var h = '<h2>' + (o.newBest ? 'New Record!' : 'The fire rests') + '</h2><p>' + EH.TIERS[o.tier].name + ' · reached wave ' + o.wave + '</p>' +
        '<div class="big-num">🔥 <span id="sumE">+' + fmt(o.embers) + '</span></div>';
      o.notes.forEach(function (n) { h += '<div class="note">' + n + '</div>'; });
      h += '<div class="stats"><span>Shades extinguished</span><span>' + fmt(o.kills) + '</span><span>Time</span><span>' + EH.fmtTime(o.time) + '</span>' +
        (o.gems ? '<span>Gems from Dreads</span><span class="gemc">◈ ' + o.gems + '</span>' : '') +
        '<span>Best wave (' + EH.TIERS[o.tier].name + ')</span><span>' + S.bestWave[o.tier] + '</span></div><div class="btns">' +
        (o.embers > 0 ? '<button class="btn ad" data-k="dbl">' + (S.iap.keeper ? '×2 Embers <small>(Keeper)</small>' : '▶ ×2 Embers <small>(watch ad)</small>') + '</button>' : '') +
        '<button class="btn primary" data-k="again">Run again</button><button class="btn" data-k="menu">Back to the Hold</button></div>';
      var m = UI.modal(h, true);
      m.addEventListener('click', function (e) {
        var k = e.target.closest('[data-k]'); if (!k) return; var key = k.getAttribute('data-k');
        if (key === 'dbl') {
          if (doubled) return;
          G.doubleEmbers(o.embers, function (ok) { if (ok) { doubled = true; k.disabled = true; k.textContent = 'Doubled ✓'; m.querySelector('#sumE').textContent = '+' + fmt(o.embers * 2); } else UI.toast('No reward — the ad was not completed.'); });
        } else { $('modals').innerHTML = ''; G.toMenu(); if (key === 'again' && S.tut.workshop) G.startRun(); }
      });
    },
    offline: function (off) {
      var m = UI.modal('<h2>While you were away</h2><p>Your keepers tended the fire for ' + EH.fmtTime(off.hours * 3600) + '.</p><div class="big-num">🔥 +' + fmt(off.embers) + '</div><div class="btns">' +
        '<button class="btn ad" data-k="dbl">' + (S.iap.keeper ? 'Collect ×2 <small>(Keeper)</small>' : '▶ Collect ×2 <small>(watch ad)</small>') + '</button><button class="btn primary" data-k="one">Collect</button></div>', true);
      var done = false;
      function fin(mult) { if (done) return; done = true; G.addEmbers(off.embers * mult); EH.Save.save(); EH.Audio.play('reward'); UI.close(m); if (G.dailyReady()) UI.daily(); }
      m.addEventListener('click', function (e) {
        var k = e.target.closest('[data-k]'); if (!k) return;
        if (k.getAttribute('data-k') === 'one') fin(1);
        else EH.Platform.rewarded('offline_double', function (ok) { fin(ok ? 2 : 1); });
      });
    },
    daily: function () {
      var idx = G.dailyIndex(), h = '<h2>Daily Kindling</h2><p>Return each day for a bigger gift.</p><div class="daily">';
      EH.DAILY_REWARDS.forEach(function (r, i) {
        h += '<div class="' + (i < idx ? 'done' : i === idx ? 'today' : '') + '">Day ' + (i + 1) + '<b>' + (r.gems ? '<span class="gemc">◈' + r.gems + '</span>' : '') + (r.gems && r.embers ? '<br>' : '') + (r.embers ? '🔥' : '') + '</b></div>';
      });
      var m = UI.modal(h + '</div><div class="btns"><button class="btn primary" data-k="c">Claim</button></div>');
      m.addEventListener('click', function (e) {
        if (!e.target.closest('[data-k]')) return;
        var r = G.claimDaily(); EH.Save.save(); UI.close(m);
        if (r) { EH.Audio.play('reward'); UI.toast('Claimed ' + (r.gems ? '◈ ' + r.gems + ' ' : '') + (r.embers ? '🔥 ' + fmt(r.embers) : '')); }
      });
    },
    statsModal: function () {
      var s = S.stats, h = '<h2>Chronicle</h2><div class="stats">';
      [['Best wave', G.bestWaveAny()], ['Runs', s.runs], ['Shades extinguished', fmt(s.kills)], ['Dreads defeated', fmt(s.bosses)], ['Boons chosen', fmt(s.boons)],
        ['Embers earned', fmt(s.embersEarned)], ['Time in the dark', EH.fmtTime(s.playTime)]].forEach(function (r) { h += '<span>' + r[0] + '</span><span>' + r[1] + '</span>'; });
      h += '</div><h3>Best wave by difficulty</h3><div class="stats">';
      EH.TIERS.forEach(function (t, i) { if (i <= S.maxTier) h += '<span>' + t.name + '</span><span>' + S.bestWave[i] + '</span>'; });
      closable(UI.modal(h + '</div><div class="btns"><button class="btn" data-k="x">Close</button></div>'));
    },
    settings: function () {
      var st = S.settings;
      function tg(key, label, sub) { return '<div class="setrow"><label>' + label + (sub ? '<small>' + sub + '</small>' : '') + '</label><button class="toggle' + (st[key] ? ' on' : '') + '" role="switch" aria-checked="' + !!st[key] + '" aria-label="' + label + '" data-tg="' + key + '"></button></div>'; }
      var h = '<h2>Settings</h2>' +
        '<div class="setrow"><label for="vM">Music</label><input id="vM" type="range" min="0" max="100" value="' + Math.round(st.music * 100) + '" data-vol="music"></div>' +
        '<div class="setrow"><label for="vS">Sound effects</label><input id="vS" type="range" min="0" max="100" value="' + Math.round(st.sfx * 100) + '" data-vol="sfx"></div>' +
        tg('haptics', 'Vibration') + tg('dmgNumbers', 'Damage numbers') + tg('autoBoon', 'Auto-pick boons', 'Takes the rarest boon so runs never wait for you') +
        '<h3>Accessibility</h3>' +
        '<div class="setrow"><label>Text size</label><div class="seg" style="margin:0;width:54%">' + [1, 1.15, 1.3].map(function (v, i) { return '<button data-ts="' + v + '" class="' + (st.textScale === v ? 'on' : '') + '">' + ['A', 'A+', 'A++'][i] + '</button>'; }).join('') + '</div></div>' +
        tg('contrast', 'High contrast', 'Outlines every shade, shows all health bars') + tg('reduceMotion', 'Reduce motion', 'No screen shake, flashes or flicker') +
        tg('shake', 'Screen shake') + tg('leftHand', 'Left-handed abilities') +
        '<h3>Save data</h3><div class="btns" style="margin-top:0"><button class="btn" data-k="exp">Export / import save</button>' +
        (EH.Platform.mode === 'android' ? '<button class="btn" data-k="rest">Restore purchases</button>' : '') +
        '<button class="btn" data-k="priv">Privacy policy</button><button class="btn ghost" data-k="reset">Erase all progress</button><button class="btn primary" data-k="x">Done</button></div>' +
        '<p class="fine">Emberhold v' + EH.VERSION + '</p>';
      var m = UI.modal(h);
      m.addEventListener('input', function (e) { var v = e.target.getAttribute('data-vol'); if (v) { st[v] = e.target.value / 100; EH.Audio.applyVolume(); if (v === 'sfx') EH.Audio.play('buy'); } });
      m.addEventListener('click', function (e) {
        var t = e.target.closest('[data-tg]'), k = e.target.closest('[data-k]'), ts = e.target.closest('[data-ts]');
        if (t) { var key = t.getAttribute('data-tg'); st[key] = !st[key]; t.classList.toggle('on', st[key]); t.setAttribute('aria-checked', st[key]); UI.applySettings(); EH.Audio.play('click'); if (key === 'haptics') EH.Platform.haptic(30); }
        if (ts) { st.textScale = +ts.getAttribute('data-ts'); UI.applySettings(); var bs = ts.parentNode.children; for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i] === ts); }
        if (!k) return; k = k.getAttribute('data-k');
        if (k === 'x') { EH.Save.save(); UI.close(m); }
        else if (k === 'rest') { EH.Platform.restore(); UI.toast('Checking your purchases…'); }
        else if (k === 'priv') EH.Platform.openUrl(EH.PRIVACY_URL);
        else if (k === 'exp') UI.saveCode();
        else if (k === 'reset') UI.confirm('Erase all progress?', 'This permanently deletes your save. Purchases can be restored afterwards.', function (ok) {
          if (!ok) return; EH.Save.reset(); root.location.reload();
        });
      });
    },
    saveCode: function () {
      var m = UI.modal('<h2>Save code</h2><p>Copy this code to back up your progress, or paste a code and tap Import.</p><textarea class="code" aria-label="Save code">' + esc(EH.Save.exportString()) + '</textarea>' +
        '<div class="btns"><button class="btn" data-k="copy">Copy</button><button class="btn" data-k="imp">Import pasted code</button><button class="btn primary" data-k="x">Close</button></div>');
      m.addEventListener('click', function (e) {
        var k = e.target.closest('[data-k]'); if (!k) return; k = k.getAttribute('data-k'); var ta = m.querySelector('textarea');
        if (k === 'x') UI.close(m);
        else if (k === 'copy') { ta.select(); try { if (navigator.clipboard) navigator.clipboard.writeText(ta.value); else document.execCommand('copy'); UI.toast('Copied'); } catch (x) { UI.toast('Select the text and copy it manually'); } }
        else if (EH.Save.importString(ta.value)) root.location.reload(); else UI.toast('That code is not valid.');
      });
    },
    fatal: function (err) {
      $('modals').innerHTML = '';
      var m = UI.modal('<h2>Something went wrong</h2><p>Your progress has been saved. Reload to keep playing.</p><p class="fine">' + esc(err && err.message || err) + '</p><div class="btns"><button class="btn primary" data-k="r">Reload</button></div>', true);
      m.addEventListener('click', function (e) { if (e.target.closest('[data-k]')) root.location.reload(); });
    }
  };
  EH.PRIVACY_URL = 'https://example.com/emberhold/privacy';   // replace with your hosted policy before release

  function closable(m) { m.addEventListener('click', function (e) { if (e.target.closest('[data-k="x"]')) UI.close(m); }); }
  function set(el, v, html) { if (el._v === v) return; el._v = v; if (html) el.innerHTML = v; else el.textContent = v; }
  function multLabel() { var m = S.settings.buyMult; $('pMult').textContent = m === 0 ? 'MAX' : '×' + m; }

  // ---------- click routing ----------
  function onClick(e) {
    var t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
    var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
    if (act !== 'buy' && act !== 'cast') EH.Audio.play('click');
    switch (act) {
      case 'nav': UI.show(t.getAttribute('data-to')); break;
      case 'settings': UI.settings(); break;
      case 'play': G.startRun(); break;
      case 'tier': S.tier = Math.max(0, Math.min(S.maxTier, S.tier + (+t.getAttribute('data-d')))); UI.refresh(); break;
      case 'daily': UI.daily(); break;
      case 'stats': UI.statsModal(); break;
      case 'pause': UI.pause(); break;
      case 'boons': UI.boonList(); break;
      case 'speed': S.settings.speed = S.settings.speed >= G.speedMax() ? 1 : S.settings.speed + 1; t.textContent = S.settings.speed + '×';
        if (G.speedMax() < 3 && S.settings.speed === 1) UI.toast('3× speed unlocks at wave 20'); break;
      case 'ptab': UI.ptab(t.getAttribute('data-tab')); break;
      case 'mult': S.settings.buyMult = { 1: 10, 10: 0, 0: 1 }[S.settings.buyMult]; multLabel(); UI.runTick(); break;
      case 'buy': if (G.buy(id)) { EH.Platform.haptic(8); UI.runTick(); } break;
      case 'cast': if (!G.cast(t.getAttribute('data-abil'))) EH.Audio.play('deny'); break;
      case 'wstab': wsTab = t.getAttribute('data-tab'); UI.refresh(); break;
      case 'ws': if (G.buyWorkshop(id)) { EH.Audio.play('buy'); EH.Platform.haptic(8); } else EH.Audio.play('deny'); UI.refresh(); break;
      case 'abup': if (G.upgradeAbility(id)) { EH.Audio.play('reward'); EH.Save.save(); } else { EH.Audio.play('deny'); UI.toast('Not enough gems'); } UI.refresh(); break;
      case 'flame': G.selectFlame(id); UI.refresh(); break;
      case 'flamebuy': if (G.buyFlame(id)) { EH.Audio.play('reward'); EH.Save.save(); } else UI.toast('Not enough gems'); UI.refresh(); break;
      case 'mission': var g1 = G.claimMission(+id); if (g1) { EH.Audio.play('gem'); UI.toast('◈ +' + g1); EH.Save.save(); } UI.refresh(); break;
      case 'ach': var g2 = G.claimAch(id); if (g2) { EH.Audio.play('gem'); UI.toast('◈ +' + g2); EH.Save.save(); } UI.refresh(); break;
      case 'iap': G.purchase(id); break;
      case 'adgems': G.watchForGems(function (ok) { if (ok) { EH.Audio.play('gem'); UI.toast('◈ +' + EH.AD_GEMS); } UI.refresh(); }); break;
      case 'gemoffer': var em = G.buyGemOffer(id); if (em) { EH.Audio.play('reward'); UI.toast('🔥 +' + fmt(em)); EH.Save.save(); } else UI.toast('Not enough gems'); UI.refresh(); break;
    }
  }

  // ---------- screens ----------
  function home() {
    var t = EH.TIERS[S.tier], f = EH.FLAME[S.flame], best = S.bestWave[S.tier];
    var nextReq = S.tier === S.maxTier && S.tier < EH.TIERS.length - 1 ? 'Reach wave ' + EH.TIERS[S.tier + 1].unlockWave + ' to unlock ' + EH.TIERS[S.tier + 1].name : '';
    $('home').innerHTML = '<div class="home-top"><div class="logo sm"><span>EMBER</span><span>HOLD</span></div></div><div class="home-mid"></div>' +
      '<div class="home-flame">' + f.name + '</div>' +
      '<div class="tiersel"><button class="iconbtn" data-act="tier" data-d="-1" aria-label="Easier difficulty"' + (S.tier <= 0 ? ' disabled style="opacity:.3"' : '') + '>‹</button>' +
      '<div class="mid"><b>' + (S.tier + 1) + ' · ' + t.name + '</b><small>Best wave ' + best + ' · Embers ×' + t.ember + '</small></div>' +
      '<button class="iconbtn" data-act="tier" data-d="1" aria-label="Harder difficulty"' + (S.tier >= S.maxTier ? ' disabled style="opacity:.3"' : '') + '>›</button></div>' +
      '<button class="btn primary big" data-act="play">PLAY</button>' +
      '<div class="home-row"><button class="btn' + (G.dailyReady() ? ' has-dot' : '') + '" data-act="daily"' + (G.dailyReady() ? '' : ' disabled') + '>Daily gift<em class="dot"></em></button>' +
      '<button class="btn" data-act="stats">Chronicle</button></div>' +
      '<p class="fine" style="margin:0 0 4px;min-height:1.2em">' + nextReq + '</p>';
  }

  function workshop() {
    var h = '<h2>Workshop</h2><p class="sub">Permanent upgrades. Every run starts from these levels.</p><div class="seg">' +
      ['attack', 'defense', 'utility', 'abilities'].map(function (t) { return '<button data-act="wstab" data-tab="' + t + '" class="' + (wsTab === t ? 'on' : '') + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>'; }).join('') + '</div>';
    if (wsTab === 'abilities') {
      EH.ABILITIES.forEach(function (a) {
        var l = G.abilityLevel(a.id), locked = G.abilityLocked(a.id), maxed = l >= a.max, c = maxed ? 0 : a.costs[l];
        h += '<div class="row' + (locked ? ' locked' : '') + '"><div class="icn">' + (locked ? '🔒' : a.icon) + '</div><div class="info"><b>' + a.name + (l ? ' <span class="tag">Lv ' + l + '</span>' : '') + '</b><small>' +
          (locked ? 'Reach wave ' + a.unlockWave + ' to discover' : a.desc(Math.max(1, l)) + ' ' + a.cd + 's cooldown.' + (l && !maxed ? ' Next: ' + a.desc(l + 1) : '')) + '</small></div>' +
          (locked ? '' : maxed ? '<button class="buy max" disabled>MAX</button>' :
            '<button class="buy gemcost' + (S.gems >= c ? ' can' : '') + '" data-act="abup" data-id="' + a.id + '">' + (c ? '◈ ' + c : 'FREE') + '<small>' + (l ? 'UPGRADE' : 'UNLOCK') + '</small></button>') + '</div>';
      });
      h += '<p class="fine">Gems come from Dreads, quests, achievements and daily gifts.</p>';
    } else {
      EH.UPGRADES.forEach(function (u) {
        if (u.tab !== wsTab) return;
        var l = G.wsLevel(u.id), un = G.wsUnlocked(u.id), mx = un && G.wsMaxed(u.id), c = G.wsCost(u.id);
        h += '<div class="row' + (un ? '' : ' locked') + '"><div class="icn">' + (un ? u.icon : '🔒') + '</div><div class="info"><b>' + u.name + (un ? ' <span class="tag">Lv ' + l + '</span>' : '') + '</b>' +
          (un ? '<span class="val">' + u.show(u.stat(l)) + (mx ? '' : ' <em>→ ' + u.show(u.stat(l + 1)) + '</em>') + '</span>' : '') + '<small>' + EH.UPG_DESC[u.id] + '</small></div>' +
          (mx ? '<button class="buy max" disabled>MAX</button>' : '<button class="buy' + (S.embers >= c ? ' can' : '') + '" data-act="ws" data-id="' + u.id + '" aria-label="' + (un ? 'Upgrade ' : 'Unlock ') + u.name + '">🔥 ' + fmt(c) + '<small>' + (un ? 'UPGRADE' : 'UNLOCK') + '</small></button>') + '</div>';
      });
    }
    var sc = $('workshop').scrollTop; $('workshop').innerHTML = h; $('workshop').scrollTop = sc;
  }

  function flames() {
    var h = '<h2>Flames</h2><p class="sub">Each flame burns differently. Choose one before a run.</p>';
    EH.FLAMES.forEach(function (f) {
      var own = !!S.flames[f.id], sel = S.flame === f.id;
      h += '<div class="card flame-card' + (sel ? ' sel' : '') + '"><div class="swatch" style="--c1:' + f.core + ';--c2:' + f.mid + ';--c3:' + f.out + '"></div><div class="info" style="flex:1"><b>' + f.name +
        (sel ? '<span class="tag on">burning</span>' : '') + '</b><br><small style="color:var(--dim);line-height:1.3;display:block;margin-top:3px">' + f.perk + '</small></div>' +
        (sel ? '' : own ? '<button class="btn" data-act="flame" data-id="' + f.id + '">Select</button>' :
          f.unlock.type === 'gems' ? '<button class="btn gemb" data-act="flamebuy" data-id="' + f.id + '"' + (S.gems < f.unlock.gems ? ' disabled' : '') + '>◈ ' + f.unlock.gems + '</button>' :
            '<span class="tag">🔒 ' + G.flameReq(f) + '</span>') + '</div>';
    });
    $('flames').innerHTML = h;
  }

  function quests() {
    var h = '<h2>Quests</h2><h3>Today</h3>';
    S.missions.list.forEach(function (m, i) {
      var q = G.missionInfo(m); if (!q) return;
      h += '<div class="row"><div class="info"><b>' + q.text + '</b><small>' + fmt(q.cur) + ' / ' + fmt(q.goal) + '</small><div class="prog"><i style="width:' + (q.cur / q.goal * 100) + '%"></i></div></div>' +
        (q.claimed ? '<button class="buy max" disabled>DONE</button>' : '<button class="buy gemcost' + (q.done ? ' can' : '') + '" data-act="mission" data-id="' + i + '"' + (q.done ? '' : ' disabled') + '>◈ ' + q.gems + '<small>' + (q.done ? 'CLAIM' : 'REWARD') + '</small></button>') + '</div>';
    });
    h += '<p class="fine" style="margin:4px">New quests every day.</p><h3>Achievements</h3>';
    EH.ACHIEVEMENTS.forEach(function (a) {
      var q = G.achInfo(a);
      h += '<div class="row"><div class="info"><b>' + a.name + ' <span class="tag">' + q.tier + '/' + q.total + '</span></b><small>' + (q.complete ? 'Complete' : q.text + ' · ' + fmt(q.cur) + ' / ' + fmt(q.goal)) + '</small>' +
        '<div class="prog"><i style="width:' + (q.complete ? 100 : q.cur / q.goal * 100) + '%"></i></div></div>' +
        (q.complete ? '<button class="buy max" disabled>DONE</button>' : '<button class="buy gemcost' + (q.claimable ? ' can' : '') + '" data-act="ach" data-id="' + a.id + '"' + (q.claimable ? '' : ' disabled') + '>◈ ' + q.gems + '<small>' + (q.claimable ? 'CLAIM' : 'REWARD') + '</small></button>') + '</div>';
    });
    var sc = $('quests').scrollTop; $('quests').innerHTML = h; $('quests').scrollTop = sc;
  }

  function shop() {
    var h = '<h2>Shop</h2>', left = G.adGemsLeft(), P = EH.Platform;
    h += '<div class="row"><div class="icn gemc">◈</div><div class="info"><b>Free gems</b><small>' + (S.iap.keeper ? 'Keeper: no ad needed' : 'Watch a short video') + ' · ' + left + ' left today</small></div>' +
      '<button class="buy' + (left > 0 ? ' can' : '') + '" style="' + (left > 0 ? 'background:linear-gradient(180deg,#a5f0a0,#45b85a);border-color:#cbf7c6;color:#06270c' : '') + '" data-act="adgems"' + (left > 0 ? '' : ' disabled') + '>' + (S.iap.keeper ? '' : '▶ ') + '+' + EH.AD_GEMS + '<small>FREE</small></button></div>';
    h += '<h3>Offers</h3>';
    EH.PRODUCTS.forEach(function (p) {
      var owned = (p.sku === 'keeper_pack' && S.iap.keeper) || (p.sku === 'starter_pack' && S.iap.starter);
      if (p.sku === 'gems_1') h += '<h3>Gems</h3>';
      h += '<div class="row offer' + (p.best ? ' best' : '') + '">' + (p.best && !owned ? '<span class="ribbon">BEST VALUE</span>' : '') + '<div class="icn ' + (p.gems ? 'gemc' : '') + '">' + (p.gems ? '◈' : '♛') + '</div><div class="info"><b>' + p.name + '</b><small>' + p.desc + '</small></div>' +
        (owned ? '<button class="buy max" disabled>OWNED</button>' : '<button class="buy can" data-act="iap" data-id="' + p.sku + '">' + esc(P.price(p.sku)) + '</button>') + '</div>';
    });
    h += '<h3>Spend gems</h3>';
    EH.GEM_OFFERS.forEach(function (o) {
      h += '<div class="row"><div class="icn">🔥</div><div class="info"><b>' + o.name + '</b><small>' + o.desc + ' · 🔥 ' + fmt(G.gemOfferEmbers(o)) + '</small></div><button class="buy gemcost' + (S.gems >= o.gems ? ' can' : '') + '" data-act="gemoffer" data-id="' + o.id + '">◈ ' + o.gems + '</button></div>';
    });
    h += '<p class="fine">Emberhold never interrupts play with ads. Videos are always your choice.' + (P.canPurchase() ? '' : '<br>Purchases are available in the Android app.') + '</p>';
    var sc = $('shop').scrollTop; $('shop').innerHTML = h; $('shop').scrollTop = sc;
  }
})(window);
