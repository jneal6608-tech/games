/* Emberhold — persistence: versioned, checksummed, with a rolling backup slot. */
(function (root) {
  'use strict';
  var EH = root.EH = root.EH || {};
  var KEY = 'emberhold.save', BAK = 'emberhold.save.bak';

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h.toString(36);
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  EH.today = today;

  function defaults() {
    return {
      v: EH.SAVE_VERSION, createdAt: Date.now(), lastSeen: Date.now(),
      embers: 0, gems: 20,
      workshop: {}, flame: 'hearth', flames: { hearth: 1 }, abilities: { flare: 1 },
      tier: 0, maxTier: 0, bestWave: [0, 0, 0, 0, 0, 0], bestEmbers: 0,
      stats: { kills: 0, bosses: 0, runs: 0, boons: 0, embersEarned: 0, waves: 0, abilities: 0, upgrades: 0, workshop: 0, playTime: 0 },
      settings: { music: 0.6, sfx: 0.8, haptics: true, shake: true, reduceMotion: false, contrast: false,
        textScale: 1, dmgNumbers: true, autoBoon: false, leftHand: false, speed: 1, buyMult: 1 },
      tut: {}, iap: { keeper: false, starter: false },
      daily: { streak: 0, lastClaim: '' },
      missions: { day: '', list: [], stat: {} },
      adGems: { day: '', n: 0 }, freeReroll: '',
      ach: {}, pending: null
    };
  }

  function merge(def, got) {
    if (got == null || typeof got !== 'object' || Array.isArray(def)) return got == null ? def : got;
    for (var k in def) {
      if (!(k in got) || got[k] == null) got[k] = def[k];
      else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k])) got[k] = merge(def[k], got[k]);
      else if (typeof def[k] !== typeof got[k]) got[k] = def[k];
    }
    return got;
  }

  function sanitize(s) {
    function num(o, k, min) { if (typeof o[k] !== 'number' || !isFinite(o[k]) || o[k] < min) o[k] = min; }
    num(s, 'embers', 0); num(s, 'gems', 0); num(s, 'tier', 0); num(s, 'maxTier', 0);
    s.maxTier = Math.min(EH.TIERS.length - 1, Math.floor(s.maxTier));
    s.tier = Math.min(s.maxTier, Math.floor(s.tier));
    if (!Array.isArray(s.bestWave)) s.bestWave = [0, 0, 0, 0, 0, 0];
    while (s.bestWave.length < EH.TIERS.length) s.bestWave.push(0);
    if (!EH.FLAME[s.flame] || !s.flames[s.flame]) s.flame = 'hearth';
    s.flames.hearth = 1;
    if (!s.abilities.flare) s.abilities.flare = 1;
    for (var k in s.workshop) num(s.workshop, k, 0);
    var st = s.settings;
    st.music = Math.min(1, Math.max(0, +st.music || 0));
    st.sfx = Math.min(1, Math.max(0, +st.sfx || 0));
    if ([1, 1.15, 1.3].indexOf(st.textScale) < 0) st.textScale = 1;
    if ([1, 2, 3].indexOf(st.speed) < 0) st.speed = 1;
    return s;
  }

  function read(key) {
    try {
      var raw = root.localStorage.getItem(key);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o.d !== 'string' || hash(o.d) !== o.h) return null;
      return JSON.parse(o.d);
    } catch (e) { return null; }
  }

  EH.Save = {
    data: null, recovered: false, failed: false,
    load: function () {
      var d = read(KEY);
      if (!d) { d = read(BAK); if (d) this.recovered = true; }
      if (d && d.v > EH.SAVE_VERSION) d = null;       // save from a newer build: start clean rather than corrupt it
      this.data = sanitize(merge(defaults(), d || {}));
      this.data.v = EH.SAVE_VERSION;
      return this.data;
    },
    save: function () {
      if (!this.data) return false;
      try {
        this.data.lastSeen = Date.now();
        var d = JSON.stringify(this.data);
        var prev = root.localStorage.getItem(KEY);
        if (prev) root.localStorage.setItem(BAK, prev);
        root.localStorage.setItem(KEY, JSON.stringify({ d: d, h: hash(d) }));
        this.failed = false;
        return true;
      } catch (e) { this.failed = true; return false; }
    },
    exportString: function () {
      var d = JSON.stringify(this.data);
      return 'EH1.' + hash(d) + '.' + btoa(unescape(encodeURIComponent(d)));
    },
    importString: function (str) {
      try {
        var p = String(str).trim().split('.');
        if (p.length !== 3 || p[0] !== 'EH1') return false;
        var d = decodeURIComponent(escape(atob(p[2])));
        if (hash(d) !== p[1]) return false;
        var o = JSON.parse(d);
        if (!o || o.v > EH.SAVE_VERSION) return false;
        this.data = sanitize(merge(defaults(), o));
        return this.save();
      } catch (e) { return false; }
    },
    reset: function () {
      try { root.localStorage.removeItem(KEY); root.localStorage.removeItem(BAK); } catch (e) { /* ignore */ }
      this.data = defaults();
      this.save();
      return this.data;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
