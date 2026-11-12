/* Emberhold — fully synthesized audio (WebAudio). No samples: every sound and the music are generated,
   so there is nothing to license. */
(function (root) {
  'use strict';
  var EH = root.EH = root.EH || {};
  var ctx = null, master, sfxBus, musBus, noiseBuf, started = false, last = {}, musicTimer = null;
  var intensity = 0, bossMode = false, nextBar = 0, bar = 0;

  function init() {
    if (ctx) return true;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createDynamicsCompressor();
      master.threshold.value = -14; master.ratio.value = 6;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      musBus = ctx.createGain(); musBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      A.applyVolume();
      return true;
    } catch (e) { ctx = null; return false; }
  }

  function tone(type, f0, f1, dur, vol, when, bus) {
    var t = (when || ctx.currentTime), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, freq, q, when, bus, type) {
    var t = (when || ctx.currentTime), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  var SFX = {
    shoot: [45, function () { tone('triangle', 880 + Math.random() * 120, 440, 0.06, 0.05); }],
    hit: [40, function () { noise(0.05, 0.10, 2400, 2); }],
    crit: [70, function () { tone('square', 1320, 660, 0.09, 0.06); noise(0.07, 0.10, 4200, 3); }],
    die: [45, function () { tone('sine', 300 + Math.random() * 80, 90, 0.14, 0.11); noise(0.10, 0.06, 900, 1); }],
    bossDie: [500, function () { tone('sawtooth', 220, 40, 0.9, 0.22); noise(0.9, 0.25, 500, 0.7); tone('sine', 660, 1320, 0.5, 0.1, ctx.currentTime + 0.1); }],
    ouch: [120, function () { tone('sawtooth', 150, 70, 0.14, 0.13); }],
    buy: [35, function () { tone('sine', 620, 930, 0.08, 0.10); }],
    deny: [150, function () { tone('square', 160, 120, 0.1, 0.06); }],
    click: [30, function () { tone('sine', 520, 420, 0.04, 0.08); }],
    wave: [300, function () { tone('sine', 392, 392, 0.25, 0.09); tone('sine', 587, 587, 0.35, 0.08, ctx.currentTime + 0.12); }],
    boss: [800, function () { tone('sawtooth', 73, 55, 1.2, 0.2); tone('sawtooth', 110, 82, 1.2, 0.12); noise(1.0, 0.1, 200, 0.6); }],
    boon: [200, function () { [523, 659, 784, 1047].forEach(function (f, i) { tone('triangle', f, f, 0.3, 0.09, ctx.currentTime + i * 0.07); }); }],
    reward: [200, function () { [659, 784, 988, 1319].forEach(function (f, i) { tone('sine', f, f, 0.35, 0.10, ctx.currentTime + i * 0.08); }); }],
    over: [1000, function () { [392, 330, 262, 196].forEach(function (f, i) { tone('triangle', f, f * 0.98, 0.6, 0.12, ctx.currentTime + i * 0.22); }); }],
    flare: [300, function () { noise(0.7, 0.3, 1200, 0.5); tone('sine', 200, 1200, 0.3, 0.14); }],
    ward: [300, function () { tone('sine', 440, 880, 0.4, 0.12); tone('sine', 660, 1320, 0.4, 0.07); }],
    stoke: [300, function () { tone('sawtooth', 220, 660, 0.35, 0.09); noise(0.4, 0.12, 3000, 1); }],
    nova: [200, function () { noise(0.4, 0.14, 700, 0.6); tone('sine', 500, 150, 0.3, 0.08); }],
    gem: [100, function () { tone('sine', 1568, 2093, 0.2, 0.09); tone('sine', 2093, 2637, 0.25, 0.06, ctx.currentTime + 0.08); }]
  };

  // ---- generative music: slow modal pads, a sparse pluck line, fire crackle, and a pulse that grows with danger ----
  var CHORDS = [[146.83, 220.0, 293.66, 349.23], [130.81, 196.0, 261.63, 329.63], [116.54, 174.61, 233.08, 293.66], [110.0, 164.81, 220.0, 261.63]];
  var SCALE = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46];
  var BAR = 4.8;
  function pad(f, t, dur, vol) {
    var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 1.004;
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(380, t); fl.frequency.linearRampToValueAtTime(900 + intensity * 700, t + dur * 0.5);
    fl.frequency.linearRampToValueAtTime(380, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(musBus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function scheduleBar(t) {
    var ch = CHORDS[bar % CHORDS.length], i;
    if (bossMode) ch = ch.map(function (f) { return f * 0.943; });
    for (i = 0; i < ch.length; i++) pad(ch[i], t, BAR * 1.15, 0.035);
    pad(ch[0] / 2, t, BAR * 1.1, 0.05);
    // pluck melody
    var notes = 2 + Math.floor(Math.random() * 3) + (intensity > 0.5 ? 2 : 0);
    for (i = 0; i < notes; i++) {
      var f = SCALE[Math.floor(Math.random() * SCALE.length)] * (Math.random() < 0.25 ? 2 : 1);
      var when = t + Math.floor(Math.random() * 16) * (BAR / 16);
      tone('triangle', f, f, 0.9, 0.045, when, musBus);
      tone('sine', f * 2, f * 2, 0.5, 0.012, when, musBus);
    }
    // pulse (in-run): soft heartbeat on quarter notes, tighter when intense
    if (intensity > 0.05) {
      var steps = bossMode ? 16 : 8;
      for (i = 0; i < steps; i++) {
        var tt = t + i * (BAR / steps);
        tone('sine', 82, 46, 0.22, 0.10 * Math.min(1, intensity + 0.3), tt, musBus);
        if (bossMode && i % 2 === 1) noise(0.05, 0.03, 5000, 2, tt, musBus);
      }
    }
    // fire crackle
    for (i = 0; i < 10; i++) noise(0.03 + Math.random() * 0.04, 0.02 + Math.random() * 0.03, 1500 + Math.random() * 3500, 3, t + Math.random() * BAR, musBus);
    bar++;
  }
  function pump() {
    if (!ctx || ctx.state !== 'running') return;
    while (nextBar < ctx.currentTime + 1.2) {
      if (nextBar < ctx.currentTime) nextBar = ctx.currentTime + 0.05;
      scheduleBar(nextBar); nextBar += BAR;
    }
  }

  var A = EH.Audio = {
    /** must be called from a user gesture at least once */
    unlock: function () {
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (!started) { started = true; nextBar = ctx.currentTime + 0.1; musicTimer = setInterval(pump, 300); pump(); }
    },
    applyVolume: function () {
      if (!ctx) return;
      var s = EH.Save.data ? EH.Save.data.settings : { music: 0.6, sfx: 0.8 };
      sfxBus.gain.value = s.sfx; musBus.gain.value = s.music * 0.9;
    },
    play: function (name) {
      if (!ctx || ctx.state !== 'running') return;
      var s = SFX[name]; if (!s) return;
      var now = ctx.currentTime * 1000;
      if (last[name] && now - last[name] < s[0]) return;
      last[name] = now;
      try { s[1](); } catch (e) { /* never let audio break the game */ }
    },
    setMood: function (i, boss) { intensity = Math.max(0, Math.min(1, i)); bossMode = !!boss; },
    suspend: function () { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume: function () { if (ctx && started && ctx.state === 'suspended') ctx.resume(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
