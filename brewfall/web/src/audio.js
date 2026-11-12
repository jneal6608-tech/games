// All sound is synthesised at runtime with WebAudio: no audio files, nothing to license.
let ctx = null, master = null, sfxGain = null, musGain = null, musicOn = false, musTimer = 0, nextT = 0, step = 0;
const opts = { sfx: true, music: true };
export function configure(o) { Object.assign(opts, o); if (sfxGain) sfxGain.gain.value = opts.sfx ? 0.9 : 0; if (opts.music) startMusic(); else stopMusic(); }
export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC();
    master = ctx.createDynamicsCompressor(); master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = opts.sfx ? 0.9 : 0; sfxGain.connect(master);
    musGain = ctx.createGain(); musGain.gain.value = 0.0; musGain.connect(master);
    if (opts.music) startMusic();
  } catch (e) { ctx = null; }
}
export function suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
export function resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
function tone(freq, t0, dur, type = 'sine', vol = 0.2, dest = sfxGain, slide = 0) {
  if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
}
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
const hz = semi => 220 * Math.pow(2, semi / 12);
export function sfx(name, a = 1, b = 1) {
  if (!ctx || !opts.sfx) return; const t = ctx.currentTime;
  switch (name) {
    case 'drop': tone(300, t, 0.12, 'sine', 0.18, sfxGain, 0.5); break;
    case 'merge': { const n = SCALE[Math.min(SCALE.length - 1, a + Math.min(4, b - 1))]; tone(hz(n + 3), t, 0.22, 'triangle', 0.26); tone(hz(n + 15), t + 0.03, 0.18, 'sine', 0.12); break; }
    case 'click': tone(660, t, 0.05, 'triangle', 0.1); break;
    case 'buy': tone(880, t, 0.08, 'square', 0.07); tone(1320, t + 0.07, 0.12, 'square', 0.07); break;
    case 'deny': tone(180, t, 0.16, 'sawtooth', 0.08, sfxGain, 0.7); break;
    case 'coin': tone(1200, t, 0.07, 'sine', 0.12); tone(1600, t + 0.06, 0.1, 'sine', 0.12); break;
    case 'win': [0, 4, 7, 12].forEach((s, i) => tone(hz(s + 12), t + i * 0.09, 0.3, 'triangle', 0.2)); break;
    case 'lose': [7, 4, 0].forEach((s, i) => tone(hz(s), t + i * 0.16, 0.4, 'sine', 0.2, sfxGain, 0.9)); break;
    case 'tonic': tone(500, t, 0.3, 'sine', 0.16, sfxGain, 2.2); break;
    case 'warn': tone(140, t, 0.2, 'square', 0.05); break;
  }
}
// Gentle generative loop: pad chords + sparse pentatonic melody.
const CHORDS = [[0, 7, 16], [-4, 3, 12], [-7, 0, 9], [-2, 5, 14]];
function schedule() {
  if (!ctx || !musicOn) return;
  while (nextT < ctx.currentTime + 0.6) {
    const beat = 0.42, bar = Math.floor(step / 8) % CHORDS.length, ch = CHORDS[bar], i = step % 8;
    if (i === 0) for (const s of ch) tone(hz(s - 12), nextT, beat * 8, 'sine', 0.05, musGain);
    if (i % 2 === 0) tone(hz(ch[(i / 2) % 3]), nextT, beat * 1.6, 'triangle', 0.035, musGain);
    const r = Math.sin(step * 12.9898) * 43758.5453; const f = r - Math.floor(r);
    if (f > 0.55) tone(hz(ch[0] + SCALE[Math.floor(f * 97) % 6] + 12), nextT, beat * 1.2, 'sine', 0.03, musGain);
    nextT += beat; step++;
  }
}
function startMusic() { if (!ctx || musicOn) return; musicOn = true; nextT = ctx.currentTime + 0.1; musGain.gain.setTargetAtTime(0.9, ctx.currentTime, 0.8); musTimer = setInterval(schedule, 200); schedule(); }
function stopMusic() { if (!ctx || !musicOn) return; musicOn = false; clearInterval(musTimer); musGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2); }
