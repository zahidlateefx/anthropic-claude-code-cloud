"""Procedural sound design for 'What if the Sun disappeared?'.
Cue times mirror the timeline T and CAM keys in scene.js. Writes out/<ep>/audio.wav."""
import os, sys
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR, DUR = 44100, 88.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(3)
L = np.zeros(N); R = np.zeros(N)

SUN_OUT, MOON_OUT, CITY_ON, PLANTS, SNOW = 22.0, 24.0, 33.5, 40.6, 44.0
GRID, FREEZE, AIR = (47.5, 56), (53, 61), 67.0
DIVE, UNDER, BLACK, END = 72.6, 76.2, (79.6, 81), 81.4
CRACKS = [55.4, 58.1, 62.7, 69.3]          # same as scene.js (camera shakes)
PAN_UP, PAN_DOWN, CRANE = (23.2, 29), (31.4, 36.4), (53, 61)

def sm(a, b, x):
    y = np.clip((x - a) / (b - a), 0, 1); return y * y * (3 - 2 * y)
def env(a, b, c, d): return sm(a, b, t) * (1 - sm(c, d, t))
def filt(x, kind, f, order=2): return sosfilt(butter(order, f, kind, fs=SR, output='sos'), x)
def add(sig, pan=0.0, at=0.0, bus=None):
    i = int(at * SR); n = min(len(sig), N - i)
    if n <= 0: return
    a, b = (bus if bus else (L, R))
    a[i:i + n] += sig[:n] * np.sqrt((1 - pan) / 2) * 1.414
    b[i:i + n] += sig[:n] * np.sqrt((1 + pan) / 2) * 1.414
def tone(freqs, amp=1.0): return sum(np.sin(2 * np.pi * f * t + rng.random() * 6) for f in freqs) * amp / len(freqs)
def seg(d): n = int(d * SR); return n, np.arange(n) / SR
noise = lambda: rng.standard_normal(N)
day = env(0, 1.2, SUN_OUT - 0.02, SUN_OUT)    # everything "alive" cuts dead at SUN_OUT

# ===== DAY: city air, crowd on the dock, birds, warm pad ======================
add(filt(noise(), 'low', 280) * 0.10 * day)                                     # distant traffic bed
for _ in range(9):                                                               # passing cars on far road
    at = rng.uniform(0.5, SUN_OUT - 3); n, tt = seg(3.0)
    add(filt(rng.standard_normal(n), 'band', [150, 1400]) * np.sin(np.pi * tt / 3) ** 3 * 0.05, pan=rng.uniform(-.9, .9), at=at)
murmur = filt(noise(), 'band', [250, 2500]) * (0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 3.7 * t) * np.sin(2 * np.pi * 1.3 * t + 1)))
add(murmur * 0.035 * day, pan=0.35)
for _ in range(80):                                                              # birds
    at = rng.uniform(0.3, SUN_OUT - 0.3); d = rng.uniform(0.05, 0.14); n, tt = seg(d)
    f = rng.uniform(2800, 5200) + np.sin(2 * np.pi * rng.uniform(15, 40) * tt) * 500 + tt / d * rng.uniform(-900, 900)
    add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / d) ** 2 * rng.uniform(0.02, 0.05), pan=rng.uniform(-.8, .8), at=at)
pad = tone([110, 164.8, 220.2, 261.6, 329.4]) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.11 * t))
add(filt(pad, 'low', 1400) * 0.14 * day)

# ===== COUNTDOWN: accelerating ticks + riser =================================
tk, at = 0.5, 4.5
while at < SUN_OUT - 0.05:
    n, tt = seg(0.03); add(filt(rng.standard_normal(n), 'band', [2500, 6000]) * np.exp(-tt * 180) * (0.10 + 0.12 * (at - 4.5) / 17.5), at=at)
    at += tk; tk = max(0.16, tk * 0.984)
rise = sm(12, SUN_OUT, t) * (1 - sm(SUN_OUT - 0.01, SUN_OUT, t))
add(np.sin(2 * np.pi * np.cumsum(170 + 560 * sm(12, SUN_OUT, t) ** 2) / SR) * 0.06 * rise ** 2 + filt(noise(), 'band', [800, 5000]) * 0.06 * rise ** 3)
add(np.sin(2 * np.pi * 55 * t) * 0.10 * rise ** 2)                                # sub swell under the riser

# ===== THE CUT: dead air, then sub drop + tinnitus ring =========================
n, tt = seg(5)
drop = np.sin(2 * np.pi * np.cumsum(60 * np.exp(-tt * 0.5) + 24) / SR) * np.exp(-tt * 0.8)
add((drop * 0.6 + filt(rng.standard_normal(n), 'low', 160) * np.exp(-tt * 2) * 0.4) * np.minimum(1, tt / 0.01), at=SUN_OUT + 0.25)
n, tt = seg(5); add(np.sin(2 * np.pi * 4700 * tt) * np.minimum(1, tt / 0.3) * np.exp(-tt * 0.7) * 0.022, at=SUN_OUT + 0.3)
n, tt = seg(4)                                                                   # crowd gasp, then panic
gasp = filt(rng.standard_normal(n), 'band', [400, 3000]) * (sm(0.6, 1.0, tt) * (1 - sm(1.2, 2.2, tt)))
add(gasp * 0.07, pan=0.35, at=SUN_OUT + 0.5)
panic = filt(noise(), 'band', [300, 3200]) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 5.3 * t)))
add(panic * 0.06 * env(SUN_OUT + 3, SUN_OUT + 4, 29, 33), pan=0.4)
for at in np.sort(rng.uniform(SUN_OUT + 3, 30, 40)):                              # running footsteps on wood
    n, tt = seg(0.08); add(filt(rng.standard_normal(n), 'band', [120, 900]) * np.exp(-tt * 60) * 0.06, pan=0.4, at=at)

# ===== DARK BED: sinking drone + heartbeat =====================================
dark = env(SUN_OUT + 0.4, SUN_OUT + 6, UNDER - 0.05, UNDER)
sink = 1 - 0.12 * sm(SUN_OUT, UNDER, t)
for f, a in [(41.2, 0.16), (61.7, 0.09), (82.4, 0.06), (123.5, 0.025)]:
    add(np.sin(2 * np.pi * np.cumsum(f * sink + 0.15 * np.sin(2 * np.pi * 0.05 * t)) / SR) * a * dark * (0.75 + 0.25 * np.sin(2 * np.pi * 0.09 * t + f)))
for at in np.arange(SUN_OUT + 3, UNDER - 0.3, 1.25):
    n, tt = seg(0.35); beat = np.sin(2 * np.pi * 52 * tt) * np.exp(-tt * 14); g = 0.10 + 0.15 * sm(SUN_OUT, AIR + 4, at)
    add(beat * g, at=at); add(beat * g * 0.6, at=at + 0.28)
n, tt = seg(1.6); add(filt(rng.standard_normal(n), 'low', 900) * np.sin(np.pi * tt / 1.6) * 0.06, at=MOON_OUT - 0.2)
# camera moves get air: soft whooshes on the big pans/crane
for a, b in (PAN_UP, PAN_DOWN, CRANE):
    n, tt = seg(b - a); d = b - a
    add(filt(rng.standard_normal(n), 'band', [200, 1600]) * np.sin(np.pi * tt / d) ** 2 * 0.045, at=a)

# ===== SIRENS + HORNS while the city panics ====================================
for (a, b, pan, base) in [(25.5, 41, -0.6, 700), (28, 44, 0.7, 640)]:
    e = env(a, a + 3, b - 4, b)
    f = base + 380 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.23 * t + pan))
    siren = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR)
    add(filt(siren, 'low', 2200) * 0.03 * e, pan=pan)
for at in np.sort(rng.uniform(24.5, 38, 7)):
    n, tt = seg(rng.uniform(0.3, 0.8))
    horn = np.sign(np.sin(2 * np.pi * 410 * tt)) * 0.5 + np.sign(np.sin(2 * np.pi * 516 * tt)) * 0.5
    add(filt(horn, 'low', 1800) * np.minimum(1, tt / 0.02) * 0.018, pan=rng.uniform(-.9, .9), at=at)

# ===== CITY LIGHTS: switch clicks, mains hum, breakers tripping ================
hum_env = sm(CITY_ON, CITY_ON + 3.5, t) * (1 - sm(*GRID, t))
add(sum(np.sin(2 * np.pi * 60 * k * t * (1 - 0.06 * sm(*GRID, t))) / k for k in (1, 2, 3, 5)) * 0.035 * hum_env)
for at in np.sort(rng.uniform(CITY_ON - 0.5, CITY_ON + 3.5, 22)):
    n, tt = seg(0.02); add(filt(rng.standard_normal(n), 'band', [1500, 4000]) * np.exp(-tt * 300) * 0.06, pan=rng.uniform(-.7, .7), at=at)
for at in np.sort(rng.uniform(*GRID, 26)):
    n, tt = seg(0.25)
    add(np.sin(2 * np.pi * 70 * tt) * np.exp(-tt * 18) * 0.12 + filt(rng.standard_normal(n), 'band', [400, 2000]) * np.exp(-tt * 40) * 0.05, pan=rng.uniform(-.8, .8), at=at)

# ===== WIND: howl that grows with the cold ======================================
wenv = (0.02 + 0.07 * sm(PLANTS, AIR, t) + 0.06 * sm(AIR, 75, t)) * dark
gust = 0.6 + 0.4 * np.sin(2 * np.pi * 0.13 * t) * np.sin(2 * np.pi * 0.047 * t + 1)
add(filt(noise(), 'band', [150, 1200]) * wenv * gust, pan=-0.3); add(filt(noise(), 'band', [200, 1500]) * wenv * 0.8, pan=0.3)
for fc, ph in ((420, 0), (640, 2), (910, 4)):                                    # whistling howl bands
    add(filt(noise(), 'band', [fc * 0.97, fc * 1.03], 3) * wenv * 0.9 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.09 * t + ph)) ** 2, pan=np.sin(ph))
add(filt(noise(), 'high', 5000) * 0.011 * sm(AIR, 75, t) * dark)

# ===== ICE: cracks (with camera shakes), groans ==================================
for at in CRACKS + list(np.sort(rng.uniform(FREEZE[0], AIR + 6, 10))):
    big = at in CRACKS; n, tt = seg(1.0)
    crack = filt(rng.standard_normal(n), 'band', [rng.uniform(500, 1100), 7500]) * np.exp(-tt * (10 if big else 24))
    boom = np.sin(2 * np.pi * 45 * tt) * np.exp(-tt * 6) * big
    add(crack * (0.28 if big else 0.13) + boom * 0.25, pan=rng.uniform(-.7, .7), at=at)
for at in (FREEZE[0] + 1.5, FREEZE[0] + 5.5, AIR + 2):
    n, tt = seg(2.5)
    g = np.sin(2 * np.pi * np.cumsum(90 - 30 * tt / 2.5 + 6 * np.sin(2 * np.pi * 3 * tt)) / SR) * np.sin(np.pi * tt / 2.5) ** 2
    add(filt(g, 'low', 400) * 0.10, at=at)

# ===== STARS: glassy sparkles ====================================================
for at in np.sort(rng.uniform(58, UNDER - 1, 40)):
    f = rng.choice([1318.5, 1567.98, 1760, 2093, 2349.3, 2637]); n, tt = seg(1.8)
    add(np.sin(2 * np.pi * f * tt) * np.exp(-tt * 3) * 0.022 * (1 + sm(AIR, 75, at)), pan=rng.uniform(-.9, .9), at=at)

# ===== THE DIVE: rushing air, hope chord, ice smash, then underwater ==============
n, tt = seg(UNDER - DIVE)
add(filt(rng.standard_normal(n), 'band', [300, 6000]) * (tt / (UNDER - DIVE)) ** 2.5 * 0.22, at=DIVE)
hope = env(DIVE, DIVE + 3, BLACK[0], BLACK[1] + 0.5)
hope_bus = (np.zeros(N), np.zeros(N))
add(filt(tone([130.8, 196, 261.6, 329.6, 392]), 'low', 1600) * 0.13 * hope, bus=hope_bus)
n, tt = seg(2.5)
smash = filt(rng.standard_normal(n), 'band', [700, 9000]) * np.exp(-tt * 7) * 0.5
for _ in range(25):                                                             # ice shards
    j = int(rng.uniform(0, 0.6) * SR); m = int(0.05 * SR)
    smash[j:j + m] += np.sin(2 * np.pi * rng.uniform(2500, 6000) * np.arange(m) / SR) * np.exp(-np.arange(m) / SR * 60) * 0.15
plunge = np.sin(2 * np.pi * np.cumsum(70 * np.exp(-tt * 1.5) + 30) / SR) * np.exp(-tt * 1.2) * 0.6
add(smash + plunge, at=UNDER - 0.05)

# underwater bed: muffled rumble, bubbles, warm vent hum
uw = env(UNDER, UNDER + 0.4, BLACK[0], BLACK[1] + 0.3)
add(filt(noise(), 'low', 180) * 0.18 * uw + np.sin(2 * np.pi * 38 * t) * 0.10 * uw)
for at in np.sort(rng.uniform(UNDER + 0.2, BLACK[1], 70)):
    n, tt = seg(0.06); f = rng.uniform(350, 900) * (1 + tt * 12)
    add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / 0.06) * 0.03, pan=rng.uniform(-.8, .8), at=at)

# ===== END CARD: one soft low chord, nothing else =================================
add(filt(tone([65.4, 98, 130.8]), 'low', 500) * 0.10 * env(END, END + 1.2, DUR - 1.8, DUR))

# ===== MIX: muffle everything once we're under the ice, add space ================
wet = sm(UNDER - 0.02, UNDER + 0.25, t)
L = L * (1 - wet) + filt(L, 'low', 450, 4) * wet
R = R * (1 - wet) + filt(R, 'low', 450, 4) * wet
L += hope_bus[0]; R += hope_bus[1]
ir_n = int(2.2 * SR); ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / SR * 2.8); ir = filt(ir, 'low', 5000); ir /= np.abs(ir).sum() / 6
L = L + fftconvolve(L, ir)[:N] * 0.35; R = R + fftconvolve(R, np.roll(ir, 37))[:N] * 0.35
mix = np.stack([L, R], 1); mix /= np.abs(mix).max() / 0.9

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../out/01-sun-disappeared/audio.wav')
os.makedirs(os.path.dirname(out), exist_ok=True)
sf.write(out, mix, SR); print('audio ->', out)
