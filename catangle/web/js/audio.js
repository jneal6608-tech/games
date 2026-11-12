// Catangle — all sound is synthesized at runtime (no audio assets to license).
let ctx = null, master = null, enabled = true;

export function setSound(on) { enabled = on; if (master) master.gain.value = on ? 0.5 : 0; }
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = enabled ? 0.5 : 0; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}
export function suspendAudio() { if (ctx && ctx.state === 'running') ctx.suspend(); }

function tone({ type = 'sine', f = [440], dur = 0.2, vol = 0.3, delay = 0, attack = 0.008 }) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f[0], t);
  for (let i = 1; i < f.length; i++) o.frequency.exponentialRampToValueAtTime(f[i], t + (dur * i) / (f.length - 1));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, delay = 0, freq = 900) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + delay;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(fl); fl.connect(g); g.connect(master); src.start(t);
}

let combo = 0, comboAt = 0;
export const Sfx = {
  mew() { // rising pitch on quick successive rescues
    const now = performance.now();
    combo = now - comboAt < 1400 ? Math.min(combo + 1, 9) : 0; comboAt = now;
    const k = Math.pow(2, combo / 12) * (0.97 + Math.random() * 0.06);
    tone({ type: 'triangle', f: [620 * k, 980 * k, 760 * k], dur: 0.2, vol: 0.28 });
    tone({ type: 'sine', f: [1240 * k, 1960 * k, 1520 * k], dur: 0.16, vol: 0.07 });
    noise(0.12, 0.05, 0.02, 2600);
  },
  bump() { tone({ type: 'sine', f: [170, 62], dur: 0.2, vol: 0.5 }); noise(0.09, 0.22, 0, 700); tone({ type: 'sawtooth', f: [420, 260], dur: 0.22, vol: 0.07, delay: 0.05 }); },
  snore() { tone({ type: 'sine', f: [150, 110], dur: 0.35, vol: 0.2 }); tone({ type: 'sine', f: [520, 700], dur: 0.25, vol: 0.05, delay: 0.3 }); },
  click() { tone({ type: 'triangle', f: [540, 760], dur: 0.07, vol: 0.16 }); },
  coin() { tone({ type: 'square', f: [1180, 1560], dur: 0.09, vol: 0.07 }); },
  hint() { tone({ type: 'sine', f: [880, 1320], dur: 0.18, vol: 0.18 }); tone({ type: 'sine', f: [1320, 1760], dur: 0.2, vol: 0.14, delay: 0.1 }); },
  star(i) { tone({ type: 'triangle', f: [[784, 988, 1175][i] || 1175], dur: 0.3, vol: 0.25 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f: [f], dur: 0.32, vol: 0.24, delay: i * 0.09 })); },
  fail() { [392, 330, 262].forEach((f, i) => tone({ type: 'triangle', f: [f, f * 0.94], dur: 0.32, vol: 0.22, delay: i * 0.14 })); },
  hiss() { noise(0.4, 0.3, 0, 5200); },
  buy() { [659, 988, 1319].forEach((f, i) => tone({ type: 'triangle', f: [f], dur: 0.2, vol: 0.2, delay: i * 0.07 })); },
};
