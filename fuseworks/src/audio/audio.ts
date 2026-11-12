// All sound is synthesised live with the Web Audio API: no audio files, no licences, tiny download.
// SFX are one-shot voices; music is a slow generative loop (pad chords + sparse plucks).

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode, sfxBus: GainNode, musicBus: GainNode, verb: ConvolverNode;
let noiseBuf: AudioBuffer;
let sfxOn = true, musicOn = true;
let musicTimer: number | null = null;
let nextBar = 0, bar = 0;

const PENTA = [0, 2, 4, 7, 9]; // major pentatonic degrees
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
/** nth note of a rising pentatonic ladder starting at A3 */
const ladder = (n: number) => midi(57 + 12 * Math.floor(n / 5) + PENTA[n % 5]);

function ensure(): Ctx | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.5 : 0; musicBus.connect(master);

  // 2 seconds of white noise, reused by every boom / hiss / crackle / cheer
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // small synthetic reverb (decaying noise impulse) to give bursts an open-sky tail
  const len = Math.floor(ctx.sampleRate * 1.6);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const x = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  verb = ctx.createConvolver(); verb.buffer = ir;
  const verbGain = ctx.createGain(); verbGain.gain.value = 0.28;
  verb.connect(verbGain); verbGain.connect(master);
  return ctx;
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(freq: number, o: { type?: OscillatorType; t?: number; peak?: number; attack?: number; decay?: number; to?: number; bus?: AudioNode; wet?: number } = {}) {
  const c = ensure(); if (!c) return;
  const t = o.t ?? c.currentTime;
  const osc = c.createOscillator(); osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.attack ?? 0.005) + (o.decay ?? 0.2));
  const g = c.createGain();
  env(g, t, o.peak ?? 0.2, o.attack ?? 0.005, o.decay ?? 0.2);
  osc.connect(g); g.connect(o.bus ?? sfxBus);
  if (o.wet) { const w = c.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(verb); }
  osc.start(t); osc.stop(t + (o.attack ?? 0.005) + (o.decay ?? 0.2) + 0.05);
}

function noise(o: { t?: number; peak?: number; attack?: number; decay?: number; type?: BiquadFilterType; freq?: number; to?: number; q?: number; wet?: number }) {
  const c = ensure(); if (!c) return;
  const t = o.t ?? c.currentTime;
  const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = o.type ?? 'lowpass'; f.Q.value = o.q ?? 0.7;
  f.frequency.setValueAtTime(o.freq ?? 1000, t);
  const dur = (o.attack ?? 0.005) + (o.decay ?? 0.3);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const g = c.createGain();
  env(g, t, o.peak ?? 0.3, o.attack ?? 0.005, o.decay ?? 0.3);
  src.connect(f); f.connect(g); g.connect(sfxBus);
  if (o.wet) { const w = c.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(verb); }
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}

export const Sfx = {
  tick() { tone(1400, { type: 'triangle', peak: 0.05, decay: 0.04 }); },
  select() { tone(660, { type: 'triangle', peak: 0.09, decay: 0.07 }); },
  place() { tone(240, { peak: 0.22, decay: 0.09, to: 150 }); noise({ peak: 0.06, decay: 0.04, freq: 2500, type: 'highpass' }); },
  pickup() { tone(300, { peak: 0.12, decay: 0.07, to: 420 }); },
  deny() { tone(150, { type: 'square', peak: 0.07, decay: 0.12, to: 110 }); },
  restock() { for (let i = 0; i < 4; i++) noise({ t: ensure()!.currentTime + i * 0.045, peak: 0.08, decay: 0.05, freq: 3000 + i * 500, type: 'bandpass', q: 2 }); },
  fuse() { noise({ peak: 0.14, attack: 0.02, decay: 0.42, type: 'bandpass', freq: 2500, to: 7000, q: 1.5 }); },

  /** One burst in a chain. `order` drives a rising pentatonic note so long chains climb like a melody. */
  burst(order: number, big = false) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime;
    const vol = Math.max(0.35, 1 - order * 0.02);
    noise({ t, peak: 0.5 * vol, decay: big ? 0.9 : 0.5, freq: big ? 900 : 1400, to: 90, wet: 0.5 }); // boom
    tone(big ? 95 : 130, { t, peak: 0.5 * vol, decay: 0.28, to: 42 }); // chest thump
    for (let i = 0; i < 5; i++) noise({ t: t + 0.07 + Math.random() * 0.4, peak: 0.07, decay: 0.03, freq: 5000 + Math.random() * 4000, type: 'highpass' }); // crackle
    const f = ladder(Math.min(order - 1, 24));
    tone(f, { t, type: 'triangle', peak: 0.16, decay: 0.5, wet: 0.5 });
    tone(f * 2, { t, type: 'sine', peak: 0.06, decay: 0.3, wet: 0.5 });
  },
  note(label: 'harmony' | 'star' | 'charm') {
    const base = label === 'harmony' ? 76 : label === 'star' ? 88 : 81;
    tone(midi(base), { type: 'sine', peak: 0.07, decay: 0.25, wet: 0.6 });
    tone(midi(base + 7), { type: 'sine', peak: 0.05, decay: 0.3, wet: 0.6, t: ensure()!.currentTime + 0.05 });
  },
  mult(i: number) {
    const c = ensure(); if (!c) return;
    [0, 4, 7, 12].forEach((s, k) => tone(midi(69 + i * 2 + s), { t: c.currentTime + k * 0.03, type: 'sawtooth', peak: 0.07, decay: 0.45, wet: 0.5 }));
    noise({ peak: 0.1, decay: 0.3, type: 'highpass', freq: 6000 });
  },
  count() { tone(1800 + Math.random() * 300, { type: 'square', peak: 0.025, decay: 0.03 }); },
  /** Crowd reaction. intensity 0..1 */
  cheer(intensity: number) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime, n = 6 + Math.floor(intensity * 14);
    for (let i = 0; i < n; i++) noise({ t: t + Math.random() * (0.5 + intensity), peak: 0.05 + intensity * 0.06, attack: 0.08, decay: 0.5 + intensity * 0.9, type: 'bandpass', freq: 900 + Math.random() * 1800, q: 0.8, wet: 0.3 });
    if (intensity > 0.6) for (let i = 0; i < 4; i++) tone(midi(84 + PENTA[i]), { t: t + 0.15 + i * 0.08, type: 'triangle', peak: 0.04, decay: 0.5, wet: 0.7 });
  },
  clear() { const c = ensure(); if (!c) return; [0, 4, 7, 12, 16].forEach((s, k) => tone(midi(72 + s), { t: c.currentTime + k * 0.09, type: 'triangle', peak: 0.13, decay: 0.6, wet: 0.6 })); },
  fail() { const c = ensure(); if (!c) return; [0, -1, -3, -7].forEach((s, k) => tone(midi(60 + s), { t: c.currentTime + k * 0.18, type: 'triangle', peak: 0.12, decay: 0.5, wet: 0.5 })); },
  coin() { const c = ensure(); if (!c) return; tone(midi(88), { type: 'square', peak: 0.05, decay: 0.08 }); tone(midi(93), { t: c.currentTime + 0.06, type: 'square', peak: 0.05, decay: 0.2 }); },
  buy() { const c = ensure(); if (!c) return; tone(midi(76), { type: 'triangle', peak: 0.12, decay: 0.12 }); tone(midi(83), { t: c.currentTime + 0.07, type: 'triangle', peak: 0.12, decay: 0.3, wet: 0.4 }); },
  unlock() { const c = ensure(); if (!c) return; [0, 5, 9, 12, 17].forEach((s, k) => tone(midi(67 + s), { t: c.currentTime + k * 0.07, type: 'triangle', peak: 0.12, decay: 0.7, wet: 0.7 })); },
};

// ---------------------------------------------------------------- music
const PROG = [ // A minor-ish, warm and slow: [root midi, chord degrees]
  [45, [0, 7, 12, 16, 19]], // A  (A E A C# E → kept open)
  [41, [0, 7, 12, 16, 21]], // F
  [48, [0, 7, 12, 16, 19]], // C
  [43, [0, 7, 12, 14, 19]], // G
] as const;
const BAR = 6.4; // seconds per chord

function scheduleBar(t: number) {
  const c = ctx!;
  const [root, degs] = PROG[bar % PROG.length];
  // pad: detuned triangles through a slow lowpass swell
  for (const d of degs.slice(0, 4)) {
    for (const det of [-5, 5]) {
      const osc = c.createOscillator(); osc.type = 'triangle';
      osc.frequency.value = midi(root + d + 12); osc.detune.value = det;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.035, t + BAR * 0.45);
      g.gain.linearRampToValueAtTime(0.0001, t + BAR * 1.15);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      osc.connect(f); f.connect(g); g.connect(musicBus); g.connect(verb);
      osc.start(t); osc.stop(t + BAR * 1.2);
    }
  }
  // bass
  tone(midi(root), { t, type: 'sine', peak: 0.12, attack: 0.4, decay: BAR * 0.8, bus: musicBus });
  // sparse plucks on a pentatonic of the chord
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    if (Math.random() < 0.42) {
      const d = degs[Math.floor(Math.random() * degs.length)];
      const oct = Math.random() < 0.3 ? 36 : 24;
      tone(midi(root + d + oct), { t: t + (i / steps) * BAR + Math.random() * 0.03, type: 'sine', peak: 0.05, attack: 0.01, decay: 1.4, bus: musicBus, wet: 0.9 });
    }
  }
  bar++;
}

function pump() {
  if (!ctx || !musicOn) return;
  while (nextBar < ctx.currentTime + 1.5) {
    scheduleBar(Math.max(nextBar, ctx.currentTime + 0.05));
    nextBar = Math.max(nextBar, ctx.currentTime) + BAR;
  }
}

export const Audio = {
  /** Must be called from a user gesture (browsers and WebViews block audio until then). */
  unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    if (c && musicOn && musicTimer === null) { nextBar = c.currentTime + 0.1; pump(); musicTimer = window.setInterval(pump, 500); }
  },
  setSfx(on: boolean) { sfxOn = on; if (ctx) sfxBus.gain.value = on ? 1 : 0; },
  setMusic(on: boolean) {
    musicOn = on;
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.3);
    if (on && musicTimer === null) { nextBar = ctx.currentTime + 0.1; pump(); musicTimer = window.setInterval(pump, 500); }
    if (!on && musicTimer !== null) { clearInterval(musicTimer); musicTimer = null; }
  },
  /** Silence everything when the app goes to the background. */
  suspend(paused: boolean) {
    if (!ctx) return;
    if (paused) ctx.suspend().catch(() => {});
    else { ctx.resume().catch(() => {}); if (musicOn) nextBar = Math.max(nextBar, ctx.currentTime + 0.1); }
  },
};
