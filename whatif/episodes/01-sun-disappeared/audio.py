"""Procedural sound design for 'What if the Sun disappeared?'.
Cue times mirror the timeline T in scene.js. Writes out/<ep>/audio.wav."""
import os, sys
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR, DUR = 44100, 86.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(3)
L = np.zeros(N); R = np.zeros(N)

SUN_OUT, MOON_OUT, CITY_ON, PLANTS, SNOW = 22.0, 24.0, 33.5, 40.6, 44.0
GRID, FREEZE, AIR, TILT, BLACK, END = (47.5, 56), (53, 61), 67.0, 72.6, (78.4, 80), 80.4

def sm(a, b, x):
    y = np.clip((x - a) / (b - a), 0, 1); return y * y * (3 - 2 * y)
def env(a, b, c, d):  # fade in a..b, hold, fade out c..d
    return sm(a, b, t) * (1 - sm(c, d, t))
def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, kind, fs=SR, output='sos'), x)
def add(sig, pan=0.0, at=0.0):
    i = int(at * SR); n = min(len(sig), N - i)
    if n <= 0: return
    L[i:i + n] += sig[:n] * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i + n] += sig[:n] * np.sqrt((1 + pan) / 2) * 1.414
def tone(freqs, amp):
    return sum(np.sin(2 * np.pi * f * t + rng.random() * 6) for f in freqs) * amp / len(freqs)
noise = lambda: rng.standard_normal(N)

# --- day: warm pad, birds, light breeze -------------------------------------
day = env(0, 1.5, SUN_OUT - 0.02, SUN_OUT)
pad = tone([110, 164.8, 220.2, 261.6, 329.4], 1) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.11 * t))
add(filt(pad, 'low', 1400) * 0.16 * day)
add(filt(noise(), 'band', [300, 1800]) * 0.03 * day * (0.7 + 0.3 * np.sin(2 * np.pi * 0.07 * t)))
for _ in range(70):  # bird chirps
    at = rng.uniform(0.3, SUN_OUT - 0.4); d = rng.uniform(0.05, 0.14); n = int(d * SR); tt = np.arange(n) / SR
    f0 = rng.uniform(2800, 5200); f = f0 + np.sin(2 * np.pi * rng.uniform(15, 40) * tt) * 500 + tt / d * rng.uniform(-900, 900)
    ch = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / d) ** 2
    add(ch * rng.uniform(0.02, 0.05) * (1 - sm(14, 21, at)), pan=rng.uniform(-0.8, 0.8), at=at)

# --- countdown: ticks that speed up, riser into the cut ----------------------
tk, at = 0.5, 4.5
while at < SUN_OUT - 0.05:
    n = int(0.03 * SR); click = filt(rng.standard_normal(n), 'band', [2500, 6000]) * np.exp(-np.arange(n) / SR * 180)
    add(click * (0.10 + 0.10 * (at - 4.5) / 17.5), at=at)
    at += tk; tk = max(0.18, tk * 0.985)
rise = sm(13, SUN_OUT, t) * (1 - sm(SUN_OUT - 0.01, SUN_OUT, t))
sweep = np.sin(2 * np.pi * np.cumsum(180 + 520 * sm(13, SUN_OUT, t) ** 2) / SR)
add(sweep * 0.05 * rise ** 2 + filt(noise(), 'band', [800, 5000]) * 0.05 * rise ** 3)

# --- the cut: silence, then a sub drop -------------------------------------
n = int(4.5 * SR); tt = np.arange(n) / SR
drop = np.sin(2 * np.pi * np.cumsum(58 * np.exp(-tt * 0.5) + 26) / SR) * np.exp(-tt * 0.9)
boom = filt(rng.standard_normal(n), 'low', 160) * np.exp(-tt * 2.2)
add((drop * 0.55 + boom * 0.35) * np.minimum(1, tt / 0.01), at=SUN_OUT + 0.25)

# --- dark drone for the rest, slowly sinking ---------------------------------
dark = env(SUN_OUT + 0.4, SUN_OUT + 6, BLACK[0], BLACK[1])
sink = 1 - 0.12 * sm(SUN_OUT, BLACK[0], t)
for f, a in [(41.2, 0.16), (61.7, 0.09), (82.4, 0.06), (123.5, 0.025)]:
    add(np.sin(2 * np.pi * np.cumsum(f * sink + 0.15 * np.sin(2 * np.pi * 0.05 * t)) / SR) * a * dark * (0.75 + 0.25 * np.sin(2 * np.pi * 0.09 * t + f)))
# heartbeat pulse, louder as it gets colder
for i, at in enumerate(np.arange(SUN_OUT + 3, BLACK[0], 1.25)):
    n = int(0.35 * SR); tt = np.arange(n) / SR
    beat = np.sin(2 * np.pi * 52 * tt) * np.exp(-tt * 14)
    g = 0.10 + 0.14 * sm(SUN_OUT, AIR + 4, at)
    add(beat * g, at=at); add(beat * g * 0.6, at=at + 0.28)
# moon dims: soft downward whoosh
n = int(1.6 * SR); tt = np.arange(n) / SR
add(filt(rng.standard_normal(n), 'low', 900) * np.sin(np.pi * tt / 1.6) * 0.06, at=MOON_OUT - 0.2)

# --- city lights: switch clicks + mains hum, then failing ---------------------
hum_env = sm(CITY_ON, CITY_ON + 3.5, t) * (1 - sm(*GRID, t))
hum = sum(np.sin(2 * np.pi * 60 * k * t * (1 - 0.05 * sm(*GRID, t))) / k for k in (1, 2, 3, 5))
add(hum * 0.035 * hum_env)
for at in np.sort(rng.uniform(CITY_ON - 0.5, CITY_ON + 3.5, 22)):
    n = int(0.02 * SR); add(filt(rng.standard_normal(n), 'band', [1500, 4000]) * np.exp(-np.arange(n) / SR * 300) * 0.06, pan=rng.uniform(-.7, .7), at=at)
for at in np.sort(rng.uniform(GRID[0], GRID[1], 26)):  # breakers tripping
    n = int(0.25 * SR); tt = np.arange(n) / SR
    add((np.sin(2 * np.pi * 70 * tt) * np.exp(-tt * 18) * 0.12 + filt(rng.standard_normal(n), 'band', [400, 2000]) * np.exp(-tt * 40) * 0.05), pan=rng.uniform(-.8, .8), at=at)

# --- wind: grows with the cold ------------------------------------------------
w = filt(noise(), 'band', [150, 1200]) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.13 * t) * np.sin(2 * np.pi * 0.047 * t + 1))
wenv = (0.02 + 0.07 * sm(PLANTS, AIR, t) + 0.06 * sm(AIR, 75, t)) * dark
add(w * wenv, pan=-0.3); add(filt(noise(), 'band', [200, 1500]) * wenv * 0.8, pan=0.3)
add(filt(noise(), 'high', 5000) * 0.011 * sm(AIR, 75, t) * dark)  # freezing-air hiss

# --- ice: cracks and groans ---------------------------------------------------
for at in np.sort(rng.uniform(FREEZE[0], AIR + 6, 16)):
    n = int(0.6 * SR); tt = np.arange(n) / SR
    crack = filt(rng.standard_normal(n), 'band', [rng.uniform(600, 1200), 7000]) * np.exp(-tt * rng.uniform(14, 30))
    add(crack * rng.uniform(0.10, 0.2), pan=rng.uniform(-.9, .9), at=at)
for at in (FREEZE[0] + 1.5, FREEZE[0] + 5.5, AIR + 2):
    n = int(2.5 * SR); tt = np.arange(n) / SR
    g = np.sin(2 * np.pi * np.cumsum(90 - 30 * tt / 2.5 + 6 * np.sin(2 * np.pi * 3 * tt)) / SR) * np.sin(np.pi * tt / 2.5) ** 2
    add(filt(g, 'low', 400) * 0.10, at=at)

# --- stars: glassy sparkles ---------------------------------------------------
for at in np.sort(rng.uniform(58, BLACK[0] - 1, 40)):
    f = rng.choice([1318.5, 1567.98, 1760, 2093, 2349.3, 2637]); n = int(1.8 * SR); tt = np.arange(n) / SR
    add(np.sin(2 * np.pi * f * tt) * np.exp(-tt * 3) * 0.022 * (1 + sm(AIR, 75, at)), pan=rng.uniform(-.9, .9), at=at)

# --- the ending: a warm chord under the ice, then quiet ------------------------
hope = env(TILT, TILT + 4, BLACK[0], BLACK[1] + 0.5)
add(filt(tone([130.8, 196, 261.6, 329.6, 392], 1), 'low', 1600) * 0.11 * hope)
endc = env(END, END + 1.2, DUR - 1.8, DUR)
add(filt(tone([65.4, 98, 130.8], 1), 'low', 500) * 0.10 * endc)

# --- space: short convolution reverb ------------------------------------------
ir_n = int(2.2 * SR); ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / SR * 2.8); ir = filt(ir, 'low', 5000); ir /= np.abs(ir).sum() / 6
L = L + fftconvolve(L, ir)[:N] * 0.35; R = R + fftconvolve(R, np.roll(ir, 37))[:N] * 0.35
mix = np.stack([L, R], 1); mix /= np.abs(mix).max() / 0.9

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../out/01-sun-disappeared/audio.wav')
os.makedirs(os.path.dirname(out), exist_ok=True)
sf.write(out, mix, SR); print('audio ->', out)
