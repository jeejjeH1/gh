"""Synthesised soundtrack + sound design for the KAST LATAM 0% FX spot.

Reads out/cues.json (exported by the renderer from src/main.js) so every hit lands on the picture.
Writes out/soundtrack.wav (48 kHz, stereo, 24-bit).
"""
import json
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = Path(__file__).resolve().parent.parent
CUES = json.loads((ROOT / "out/cues.json").read_text())
SR = 48000
DUR = float(CUES["duration"])
N = int(SR * DUR)
BEAT = 60.0 / CUES["bpm"]
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)
send = np.zeros((2, N))  # reverb send


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def place(sig, t, gain=1.0, pan=0.0, rev=0.0):
    i = int(round(t * SR))
    if i >= N:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    sig = sig[: N - i]
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i : i + len(sig)] += sig * gain * gl * 1.414
    R[i : i + len(sig)] += sig * gain * gr * 1.414
    if rev:
        send[0, i : i + len(sig)] += sig * gain * gl * rev
        send[1, i : i + len(sig)] += sig * gain * gr * rev


def tt(d):
    return np.arange(int(d * SR)) / SR


def noise(d):
    return rng.standard_normal(int(d * SR))


# ---------------------------------------------------------------- instruments
def kick(level=1.0):
    t = tt(0.55)
    f = 44 + 120 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 6.5)
    click = hp(noise(0.006), 2500) * np.exp(-tt(0.006) * 900) * 0.5
    body[: len(click)] += click
    return np.tanh(body * 1.8 * level) * 0.9


def hat(open_=False):
    d = 0.22 if open_ else 0.05
    t = tt(d)
    return hp(noise(d), 7500, 4) * np.exp(-t * (14 if open_ else 75)) * 0.35


def clap():
    t = tt(0.25)
    env = sum(np.exp(-np.clip(t - o, 0, None) * 45) * (t >= o) for o in (0, 0.011, 0.022))
    return bp(noise(0.25), 900, 4500) * env * 0.4


def saw(f, d, harmonics=24):
    t = tt(d)
    out = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        if f * k > 14000:
            break
        out += np.sin(2 * np.pi * f * k * t) / k
    return out * 0.55


def pluck(f, d=0.24):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 30)
    return x * np.exp(-t * 16) * (1 - np.exp(-t * 900))


def bell(f, d=3.0):
    t = tt(d)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.2 * np.exp(-t * 3)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.6) * (1 - np.exp(-t * 400))


def boom(d=2.2):
    t = tt(d)
    f = 34 + 70 * np.exp(-t * 9)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4)
    crack = lp(noise(d), 2600) * np.exp(-t * 14) * 0.7
    air = hp(noise(d), 4000) * np.exp(-t * 7) * 0.12
    return np.tanh((sub * 1.2 + crack + air) * 1.4) * 0.9


def whoosh(d=0.6, rise=0.65):
    n = int(d * SR)
    t = tt(d)
    env = np.where(t < d * rise, (t / (d * rise)) ** 2.2, np.exp(-(t - d * rise) * 10))
    x = noise(d)
    # sweeping band-pass approximated by crossfading three bands
    k = np.clip(t / d, 0, 1)
    lo, mid, hi = bp(x, 200, 900), bp(x, 900, 3200), bp(x, 3200, 9000)
    y = lo * (1 - k) + mid * np.sin(np.pi * k) + hi * k
    return y * env * 0.9


def riser(d):
    t = tt(d)
    k = t / d
    f = 180 * 2 ** (k * 3.2)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.18
    x = noise(d)
    nz = bp(x, 500, 8000) * (0.15 + 0.85 * k)
    return (tone + nz * 0.5) * (k ** 2.4) * 0.8


def tick():
    t = tt(0.03)
    return (np.sin(2 * np.pi * 3100 * t) * 0.6 + hp(noise(0.03), 5000) * 0.5) * np.exp(-t * 260)


def blip(f=1320):
    t = tt(0.11)
    fr = f * (1 + 0.33 * np.clip(t / 0.03, 0, 1))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 38) * (1 - np.exp(-t * 2000)) * 0.5


def swish():
    d = 0.24
    t = tt(d)
    env = np.where(t < 0.03, t / 0.03, np.exp(-(t - 0.03) * 22))
    return (bp(noise(d), 2500, 11000) * 0.9 + np.sin(2 * np.pi * 90 * t) * np.exp(-t * 20) * 0.8) * env


def nfc_beep():
    t = tt(0.16)
    return np.sin(2 * np.pi * 1975 * t) * (np.minimum(1, t / 0.004)) * np.exp(-t * 14) * 0.45


# ---------------------------------------------------------------- arrangement
A1, F1, C2, G1 = 55.0, 43.65, 65.41, 49.0
prog = [  # (start, end, bass root, chord tones Hz)
    (2.0, 4.0, A1, [220.0, 261.63, 329.63]),
    (4.0, 6.0, F1, [174.61, 220.0, 261.63]),
    (6.0, 8.0, C2, [196.0, 261.63, 329.63]),
    (8.0, 10.0, G1, [196.0, 246.94, 293.66]),
    (10.0, 12.0, A1, [220.0, 261.63, 329.63]),
    (12.0, 14.0, F1, [174.61, 220.0, 261.63]),
    (14.0, 16.0, C2, [196.0, 261.63, 329.63]),
    (16.0, 17.0, G1, [196.0, 246.94, 293.66]),
    (17.0, 22.0, A1, [220.0, 329.63, 493.88]),
]

# kick pattern & sidechain envelope
kicks = [1.0]
kicks += [t for t in np.arange(2.0, 8.5, BEAT)]
kicks += [8.5] + CUES["strikes"]
kicks += [t for t in np.arange(10.5, 16.0, BEAT)]
kicks += [t for t in np.arange(17.0, 19.6, BEAT)]
kicks = sorted(set(round(k, 3) for k in kicks))
duck = np.ones(N)
tN = np.arange(N) / SR
for k in kicks:
    i = int(k * SR)
    seg = tN[i:] - k
    duck[i:] = np.minimum(duck[i:], 1 - 0.8 * np.exp(-seg * 9))
for k in kicks:
    place(kick(1.15 if k in CUES["impacts"] else 1.0), k, 0.95)

# hats and claps
for t in np.arange(3.0, 16.0, BEAT):
    if 8.4 < t < 10.4:
        continue
    place(hat(), t + BEAT / 2, 0.55, pan=0.25)
    if 11.5 <= t < 16.0:
        place(hat(), t + BEAT / 4, 0.25, pan=-0.3)
        place(hat(), t + 3 * BEAT / 4, 0.25, pan=-0.3)
for t in np.arange(4.0, 16.0, 2 * BEAT):
    if 8.4 < t < 10.4:
        continue
    place(clap(), t + BEAT, 0.5, rev=0.25)
for t in (6.5, 12.5, 14.5):
    place(hat(True), t + BEAT / 2, 0.35, pan=0.4)

# bass: pumping 8ths, sub + octave layer, sidechained
bass = np.zeros(N)
for s, e, root, _ in prog:
    if s >= 19.5:
        continue
    for t0 in np.arange(s, min(e, 19.5), BEAT / 2):
        d = BEAT / 2 * 0.92
        t = tt(d)
        env = np.minimum(1, t / 0.006) * np.exp(-t * 3.5) * np.minimum(1, (d - t) / 0.012)
        f = root * (2 if (t0 - s) % BEAT > 0.01 else 1)
        note = np.sin(2 * np.pi * f * t) * 0.9 + np.tanh(np.sin(2 * np.pi * f * 2 * t) * 2.5) * 0.25
        i = int(t0 * SR)
        bass[i : i + len(note)] += (note * env)[: N - i]
bass = lp(bass, 900) * duck
L += bass * 0.42
R += bass * 0.42

# pad: detuned saws, filtered, sidechained
padL, padR = np.zeros(N), np.zeros(N)
for s, e, _, chord in prog:
    d = e - s + 0.6
    env_t = tt(d)
    env = np.minimum(1, env_t / 0.35) * np.minimum(1, np.clip(d - env_t, 0, None) / 0.5)
    for f in chord:
        a = saw(f * 0.997, d) * env
        b = saw(f * 1.003, d) * env
        i = int(s * SR)
        padL[i : i + len(a)] += a[: N - i]
        padR[i : i + len(b)] += b[: N - i]
cut = 1400
padL, padR = lp(padL, cut) * duck, lp(padR, cut) * duck
pad_fade = np.clip((tN - 1.6) / 0.6, 0, 1)
L += padL * 0.14 * pad_fade
R += padR * 0.14 * pad_fade
send[0] += padL * 0.06
send[1] += padR * 0.06

# arps: 16th plucks in the energetic sections
arp_steps = [0, 2, 1, 2, 0, 2, 1, 3]
for s, e, _, chord in prog:
    if s >= 16.0 or 8.0 <= s < 10.0:
        continue
    tones = [chord[0] * 2, chord[1] * 2, chord[2] * 2, chord[0] * 4]
    for j, t0 in enumerate(np.arange(max(s, 2.5), e, BEAT / 4)):
        place(pluck(tones[arp_steps[j % 8]]), t0, 0.2, pan=0.35 * np.sin(j * 0.9), rev=0.18)

# ---------------------------------------------------------------- sound design
for t in CUES["impacts"]:
    place(boom(), t, 0.95 if t in (1.0, 17.0) else 0.7, rev=0.35)
for i, t in enumerate(CUES["whooshes"]):
    d = 0.5
    place(whoosh(d), t - d * 0.65, 0.55, pan=-0.6 if i % 2 else 0.6, rev=0.2)
for s, e in CUES["risers"]:
    place(riser(e - s), s, 0.6, rev=0.25)
for t in CUES["strikes"]:
    place(swish(), t - 0.02, 0.6, pan=0.3, rev=0.15)
for t in CUES["blips"]:
    place(blip(1320 if t < 15 else 1760), t, 0.32, pan=-0.2, rev=0.25)
for t in CUES["taps"][:1]:
    place(nfc_beep(), t + 0.05, 0.5, rev=0.2)


def out_back(x, c=0.9):
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


for t0, t1, last in CUES["ticks"]:
    ts = np.arange(t0, t1 + 0.15, 1 / 1000)
    pos = last * out_back(np.clip((ts - t0) / (t1 - t0), 0, 1))
    crossings = ts[1:][np.floor(pos[1:]) != np.floor(pos[:-1])]
    for c in crossings:
        place(tick(), c, 0.22, pan=float(rng.uniform(-0.3, 0.3)))

# final bells on the end card
for f, dt in ((440.0, 0.0), (659.25, 0.06), (987.77, 0.12), (1318.5, 0.2)):
    place(bell(f, 4.5), 17.0 + dt, 0.16, pan=0.2 * np.sin(f), rev=0.5)
place(bell(880.0, 3.0), 1.0, 0.12, rev=0.5)

# ---------------------------------------------------------------- reverb + master
ir_t = tt(1.8)
ir = noise(1.8) * np.exp(-ir_t * 3.2)
ir = lp(ir, 5000)
ir /= np.sqrt(np.sum(ir ** 2))
wetL = fftconvolve(send[0], ir)[:N]
wetR = fftconvolve(send[1], np.roll(ir, 37))[:N]
L += wetL * 0.5
R += wetR * 0.5

fade = np.clip((DUR - tN) / 1.8, 0, 1) ** 1.5
mix = np.stack([L, R]) * fade
mix = hp(mix, 30)
mix = np.tanh(mix * 0.9) / np.tanh(0.9)
mix /= np.max(np.abs(mix)) / 0.89

pcm = (np.clip(mix.T, -1, 1) * (2 ** 23 - 1)).astype(np.int32)
raw = np.zeros((pcm.shape[0], 2, 3), dtype=np.uint8)
for b in range(3):
    raw[:, :, b] = (pcm >> (8 * b)) & 0xFF
with wave.open(str(ROOT / "out/soundtrack.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(3)
    w.setframerate(SR)
    w.writeframes(raw.tobytes())
print("wrote out/soundtrack.wav", f"{DUR:.1f}s", "kicks:", len(kicks))
