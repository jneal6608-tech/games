#!/usr/bin/env python3
"""Generate every sound in Lurelight from scratch (no samples, no third-party audio).

Usage:  python3 tools/gen_audio.py            (run from games/lurelight)
Writes: assets/audio/*.wav (effects, mono 16-bit) and assets/audio/*.ogg (music, stereo)
Needs:  numpy, ffmpeg on PATH (for the .ogg encode)
"""
import os
import subprocess
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "audio")
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- helpers
def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def env_exp(dur, decay, attack=0.004):
    t = t_axis(dur)
    return np.minimum(t / attack, 1.0) * np.exp(-t / decay)


def sweep(f0, f1, dur, curve=1.0):
    t = t_axis(dur)
    k = (t / dur) ** curve
    f = f0 + (f1 - f0) * k
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def fft_filter(x, lo=None, hi=None, order=2):
    """Zero-phase band shaping in the frequency domain (periodic, so loops stay seamless)."""
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    g = np.ones_like(f)
    if hi is not None:
        g *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo is not None:
        g *= 1 - 1 / np.sqrt(1 + (f / lo) ** (2 * order))
    if x.ndim == 2:
        g = g[:, None]
    return np.fft.irfft(X * g, n=x.shape[0], axis=0)


def noise(dur):
    return rng.uniform(-1, 1, int(SR * dur))


def norm(x, peak=0.9):
    m = np.max(np.abs(x))
    return x if m == 0 else x * (peak / m)


def fade_out(x, dur=0.01):
    n = min(len(x), int(SR * dur))
    x = x.copy()
    x[-n:] *= np.linspace(1, 0, n)
    return x


def save_wav(name, x, peak=0.9):
    x = fade_out(norm(np.asarray(x, dtype=np.float64), peak))
    data = (x * 32767).astype(np.int16)
    path = os.path.join(OUT, name + ".wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print("sfx  ", name, f"{len(x) / SR:.2f}s")


def save_ogg(name, stereo, peak=0.89):
    stereo = norm(stereo, peak)
    tmp = os.path.join(OUT, name + "_tmp.wav")
    data = (stereo * 32767).astype(np.int16)
    with wave.open(tmp, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    out = os.path.join(OUT, name + ".ogg")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-c:a", "libvorbis", "-q:a", "4", out], check=True)
    os.remove(tmp)
    print("music", name, f"{stereo.shape[0] / SR:.2f}s")


def bell(freq, dur, decay, fm_ratio=3.5, fm_index=2.0, attack=0.003):
    t = t_axis(dur)
    idx = fm_index * np.exp(-t / (decay * 0.4))
    return np.sin(2 * np.pi * freq * t + idx * np.sin(2 * np.pi * freq * fm_ratio * t)) * env_exp(dur, decay, attack)


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def at(offset, x):
    return np.concatenate([np.zeros(int(SR * offset)), x])


# ---------------------------------------------------------------- effects
def gen_sfx():
    # lure hits
    save_wav("hit", mix(sweep(260, 90, 0.10) * env_exp(0.10, 0.03), fft_filter(noise(0.05), hi=2500) * env_exp(0.05, 0.012) * 0.6), 0.8)
    save_wav("hit_heavy", mix(sweep(170, 46, 0.22) * env_exp(0.22, 0.07), fft_filter(noise(0.12), hi=1400) * env_exp(0.12, 0.03) * 0.8), 0.95)
    save_wav("clink", mix(np.sin(2 * np.pi * 1870 * t_axis(0.16)) * env_exp(0.16, 0.035), np.sin(2 * np.pi * 2790 * t_axis(0.16)) * env_exp(0.16, 0.02) * 0.6,
                          np.sin(2 * np.pi * 4130 * t_axis(0.16)) * env_exp(0.16, 0.012) * 0.3), 0.55)
    # kill pop: bubbly rising blip
    save_wav("pop", mix(sweep(420, 980, 0.085, 0.6) * env_exp(0.085, 0.03), fft_filter(noise(0.03), lo=3000) * env_exp(0.03, 0.006) * 0.25), 0.7)
    save_wav("xp", mix(bell(1318.5, 0.14, 0.04, 2.0, 0.6), bell(1976, 0.10, 0.025, 2.0, 0.3) * 0.4), 0.42)
    save_wav("pearl", mix(bell(1760, 0.35, 0.10, 2.76, 1.2), at(0.05, bell(2637, 0.3, 0.09, 2.76, 0.8)) * 0.7), 0.6)
    save_wav("heart", mix(bell(523.25, 0.35, 0.12, 1.0, 0.8), at(0.09, bell(783.99, 0.4, 0.15, 1.0, 0.8))), 0.6)
    # level-up fanfare and pick
    notes = [587.33, 698.46, 880.0, 1174.66]
    save_wav("levelup", mix(*[at(i * 0.075, bell(f, 0.6, 0.18, 3.0, 1.6)) for i, f in enumerate(notes)],
                            at(0.22, fft_filter(noise(0.5), lo=5000) * env_exp(0.5, 0.15, 0.05) * 0.12)), 0.75)
    save_wav("pick", mix(*[bell(f, 0.7, 0.22, 2.0, 1.0) for f in (293.66, 440.0, 587.33, 880.0)],
                         sweep(200, 60, 0.2) * env_exp(0.2, 0.06) * 0.8), 0.8)
    # player hurt
    t = t_axis(0.38)
    saw = 2 * ((np.cumsum(330 - 520 * t) / SR) % 1.0) - 1
    save_wav("hurt", mix(fft_filter(saw, hi=1800) * env_exp(0.38, 0.11), fft_filter(noise(0.2), hi=900) * env_exp(0.2, 0.05) * 0.9), 0.9)
    # whip crack
    save_wav("crack", mix(fft_filter(noise(0.09), lo=2200) * env_exp(0.09, 0.014, 0.001), sweep(1900, 300, 0.07) * env_exp(0.07, 0.015) * 0.5,
                          at(0.01, fft_filter(noise(0.25), lo=700, hi=4000) * env_exp(0.25, 0.07, 0.02) * 0.25)), 0.85)
    # shock pulse
    t = t_axis(0.5)
    save_wav("pulse", mix(sweep(520, 70, 0.5, 0.5) * env_exp(0.5, 0.14) * (0.75 + 0.25 * np.sin(2 * np.pi * 38 * t)),
                          fft_filter(noise(0.3), lo=1500) * env_exp(0.3, 0.05) * 0.2), 0.8)
    # chain zap
    t = t_axis(0.16)
    save_wav("zap", np.sin(2 * np.pi * 900 * t + 9 * np.sin(2 * np.pi * 137 * t) + 3 * noise(0.16)) * env_exp(0.16, 0.04), 0.5)
    # toxic fizz
    save_wav("fizz", fft_filter(noise(0.3), lo=2500, hi=7000) * env_exp(0.3, 0.09, 0.03) * (0.6 + 0.4 * np.sin(2 * np.pi * 55 * t_axis(0.3))), 0.35)
    # enemy shot, dash, telegraph
    save_wav("spit", mix(sweep(340, 130, 0.13) * env_exp(0.13, 0.04), fft_filter(noise(0.05), hi=1200) * env_exp(0.05, 0.015) * 0.5), 0.55)
    save_wav("dash", fft_filter(noise(0.26), lo=500, hi=3200) * np.sin(np.pi * t_axis(0.26) / 0.26) ** 2, 0.5)
    save_wav("warn", mix(*[at(i * 0.45, fft_filter(2 * ((110 * t_axis(0.4)) % 1.0) - 1, hi=700) * np.sin(np.pi * t_axis(0.4) / 0.4) ** 0.5) for i in range(2)],
                         *[at(i * 0.45, np.sin(2 * np.pi * 55 * t_axis(0.4)) * np.sin(np.pi * t_axis(0.4) / 0.4)) for i in range(2)]), 0.85)
    # boss death
    save_wav("boss_die", mix(fft_filter(noise(1.6), hi=600) * env_exp(1.6, 0.45, 0.002), sweep(110, 28, 1.4, 0.5) * env_exp(1.4, 0.5),
                             at(0.12, fft_filter(noise(1.2), lo=3000) * env_exp(1.2, 0.3, 0.05) * 0.2),
                             *[at(0.15 + i * 0.09, bell(f, 0.9, 0.3, 2.0, 1.0)) * 0.35 for i, f in enumerate((587.33, 880.0, 1174.66, 1760.0))]), 0.98)
    # zone transition swell
    t = t_axis(1.3)
    sw = noise(1.3)
    chunks = [fft_filter(sw, lo=200 + 150 * i, hi=500 + 900 * i) * np.exp(-((t - 0.16 * i - 0.2) / 0.22) ** 2) for i in range(6)]
    save_wav("zone", mix(sum(chunks), at(0.75, bell(880, 0.55, 0.2, 2.0, 1.2)) * 0.5, at(0.85, bell(1318.5, 0.45, 0.18, 2.0, 1.0)) * 0.4), 0.8)
    # ui
    save_wav("tap", mix(bell(880, 0.07, 0.018, 1.5, 0.5), fft_filter(noise(0.015), lo=4000) * 0.2), 0.45)
    save_wav("start", mix(sweep(140, 520, 0.35, 2.0) * np.sin(np.pi * t_axis(0.35) / 0.35), at(0.2, bell(880, 0.5, 0.18, 2.0, 1.2)),
                          at(0.27, bell(1318.5, 0.5, 0.18, 2.0, 1.0)) * 0.8, fft_filter(noise(0.45), lo=1500) * np.sin(np.pi * t_axis(0.45) / 0.45) ** 2 * 0.2), 0.75)
    save_wav("gameover", mix(*[at(i * 0.24, bell(f, 1.0, 0.3, 2.0, 1.4)) for i, f in enumerate((587.33, 466.16, 349.23, 293.66))],
                             sweep(160, 40, 1.2, 0.6) * env_exp(1.2, 0.5, 0.05) * 0.7), 0.8)
    save_wav("combo", mix(*[at(i * 0.045, bell(f, 0.3, 0.07, 2.0, 0.8)) for i, f in enumerate((1174.66, 1567.98, 2349.32))]), 0.5)
    save_wav("record", mix(*[at(i * 0.09, bell(f, 0.8, 0.25, 3.0, 1.4)) for i, f in enumerate((587.33, 739.99, 880.0, 1174.66, 1479.98, 1760.0))]), 0.75)


# ---------------------------------------------------------------- music
BPM = 92
BEAT = 60 / BPM
BARS = 16
N = int(round(SR * BEAT * 4 * BARS))


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def put(buf, start_s, sig, pan=0.5, gain=1.0):
    """Add a mono signal into the stereo loop buffer, wrapping past the end so the loop is seamless."""
    i0 = int(round(start_s * SR)) % N
    idx = (i0 + np.arange(len(sig))) % N
    np.add.at(buf[:, 0], idx, sig * gain * np.cos(pan * np.pi / 2))
    np.add.at(buf[:, 1], idx, sig * gain * np.sin(pan * np.pi / 2))


# D minor colours: Dm9 | Bbmaj7 | Fmaj9 | Csus/Am7
CHORDS = [
    (38, [62, 65, 69, 72, 76]),
    (34, [58, 62, 65, 69, 72]),
    (41, [60, 65, 69, 72, 76]),
    (36, [60, 64, 67, 71, 74]),
]


def pad_note(freq, dur):
    t = t_axis(dur)
    out = np.zeros(len(t))
    for det in (-0.006, 0.0, 0.007):
        f = freq * (1 + det)
        for k in range(1, 9):
            out += np.sin(2 * np.pi * f * k * t + rng.uniform(0, 6.28)) / k ** 1.6
    a = np.minimum(t / 1.6, 1.0) * np.minimum((dur - t) / 2.2, 1.0)
    return out * np.clip(a, 0, 1)


def base_layers():
    buf = np.zeros((N, 2))
    bar = BEAT * 4
    for rep in range(BARS // 4):
        for ci, (root, tones) in enumerate(CHORDS):
            start = (rep * 4 + ci) * bar
            for j, n in enumerate(tones):
                put(buf, start - 0.3, pad_note(midi(n), bar + 2.6), pan=0.2 + 0.15 * j, gain=0.05)
            # sub
            t = t_axis(bar + 0.5)
            sub = np.sin(2 * np.pi * midi(root) * t) * np.minimum(t / 0.3, 1) * np.minimum((bar + 0.5 - t) / 0.6, 1)
            put(buf, start, sub, 0.5, 0.26)
    buf = fft_filter(buf, hi=1500)
    # bell arpeggio with ping-pong echo
    pattern = [0, 2, 4, 1, 3, 4, 2, None, 0, 3, 4, 2, 1, None, 4, 3]
    for bar_i in range(BARS):
        tones = CHORDS[bar_i % 4][1]
        for s, p in enumerate(pattern):
            if p is None or (bar_i % 4 == 3 and s > 11):
                continue
            n = tones[p] + (12 if (s + bar_i) % 3 == 0 else 0)
            sig = bell(midi(n), 0.9, 0.22, 2.0, 0.9)
            st = bar_i * bar + s * BEAT / 4
            vel = 0.085 if s % 4 == 0 else 0.055
            put(buf, st, sig, 0.35 if s % 2 else 0.65, vel)
            for e in range(1, 4):
                put(buf, st + e * BEAT * 0.75, sig, 0.9 if e % 2 else 0.1, vel * 0.45 ** e)
    # water texture
    tex = fft_filter(rng.uniform(-1, 1, (N, 2)), lo=250, hi=1800)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * np.arange(N) / N * 6)[:, None]
    buf += tex * lfo * 0.012
    # distant whale-like calls
    for st, f0, f1 in ((bar * 3.5, 220, 330), (bar * 11.5, 262, 196)):
        d = 2.4
        call = sweep(f0, f1, d, 0.7) * np.sin(np.pi * t_axis(d) / d) ** 2
        put(buf, st, call, 0.25, 0.03)
        put(buf, st + 0.33, call, 0.8, 0.014)
    return buf


def kick():
    return sweep(125, 42, 0.28, 0.4) * env_exp(0.28, 0.09, 0.002)


def hat(d=0.05):
    return fft_filter(noise(d), lo=7000) * env_exp(d, 0.012, 0.001)


def gen_music():
    base = base_layers()
    bar = BEAT * 4
    # dive: base + soft heartbeat pulse
    dive = base.copy()
    for b in range(BARS * 4):
        if b % 4 in (0,):
            put(dive, b * BEAT, kick(), 0.5, 0.20)
            put(dive, b * BEAT + BEAT * 0.5, kick(), 0.5, 0.09)
        if b % 2 == 1:
            put(dive, b * BEAT, hat(0.04), 0.6, 0.02)
    save_ogg("music_dive", dive)

    # boss: base + drive
    boss = base * 0.8
    for b in range(BARS * 4):
        put(boss, b * BEAT, kick(), 0.5, 0.34)
        put(boss, b * BEAT + BEAT * 0.5, hat(), 0.62, 0.05)
        if b % 2 == 1:
            sn = fft_filter(noise(0.16), lo=900, hi=5000) * env_exp(0.16, 0.045, 0.001)
            put(boss, b * BEAT, sn, 0.45, 0.10)
        for s in range(4):
            if s in (1, 3):
                put(boss, b * BEAT + s * BEAT / 4, hat(0.03), 0.4, 0.022)
    bass_buf = np.zeros((N, 2))
    for bar_i in range(BARS):
        root = CHORDS[bar_i % 4][0]
        for s in range(8):
            n = root + (12 if s in (3, 6) else 0)
            d = BEAT / 2 * 0.9
            t = t_axis(d)
            saw = 2 * ((midi(n) * t) % 1.0) - 1
            put(bass_buf, bar_i * bar + s * BEAT / 2, saw * env_exp(d, 0.11, 0.004), 0.5, 0.16)
    boss += fft_filter(bass_buf, hi=420)
    # tense high line
    for bar_i in range(BARS):
        tones = CHORDS[bar_i % 4][1]
        for s in range(16):
            if s % 2 == 1 and (s + bar_i) % 5 != 0:
                put(boss, bar_i * bar + s * BEAT / 4, bell(midi(tones[(s * 3 + bar_i) % 5] + 12), 0.25, 0.06, 2.0, 1.4), 0.3 + 0.4 * ((s // 2) % 2), 0.04)
    save_ogg("music_boss", boss)

    # menu: base only, quieter and darker
    save_ogg("music_menu", fft_filter(base, hi=2600), 0.7)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    gen_sfx()
    gen_music()
