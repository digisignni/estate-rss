"""Original soundtrack for the edit, synthesised from scratch (no samples, nothing to license).

usage: audio.py <out_dir>      -> soundtrack.wav (beat + sound design) and sfx_only.wav

120 BPM, 8 bars = 16 s, so every cut in the video lands on a beat. Bar 1 is a build under the
hook, the beat drops at 2.0 s ("MADE YOU LOOK."), and the last bar strips back to a riser that
slams into the downbeat when the video loops.
"""
import sys, os, wave
import numpy as np
from scipy import signal

SR = 48000
BPM = 120.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
DUR = 16.0
N = int(SR * DUR)
rng = np.random.default_rng(7)


# ---------- helpers ----------
def tt(dur):
    return np.arange(int(SR * dur)) / SR

def sos(kind, f, order=2):
    return signal.butter(order, np.asarray(f) / (SR / 2), kind, output="sos")

def lp(x, f, order=2): return signal.sosfilt(sos("low", f, order), x)
def hp(x, f, order=2): return signal.sosfilt(sos("high", f, order), x)
def bp(x, lo, hi, order=2): return signal.sosfilt(sos("band", [lo, hi], order), x)

def fade(x, a=0.002, r=0.01):
    x = x.copy()
    na, nr = max(1, int(SR * a)), max(1, int(SR * r))
    x[:na] *= np.linspace(0, 1, na)
    x[-nr:] *= np.linspace(1, 0, nr)
    return x

def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12.0)

def place(buf, sig, t0, gain=1.0, pan=0.0):
    """Mix a mono (or stereo) signal into the stereo buffer at time t0. pan: -1 left .. +1 right."""
    i = int(round(t0 * SR))
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a) * 1.414, sig * np.sin(a) * 1.414], 1)
    if i < 0:
        sig, i = sig[-i:], 0
    n = min(len(sig), len(buf) - i)
    if n > 0:
        buf[i:i + n] += sig[:n] * gain

def reverb(x, decay=0.9, bright=5000, pre=0.012):
    """Cheap, smooth room: convolve with exponentially decaying filtered noise (stereo, decorrelated)."""
    n = int(SR * decay * 2.2)
    t = np.arange(n) / SR
    out = []
    for seed in (11, 23):
        ir = np.random.default_rng(seed).standard_normal(n) * np.exp(-t / (decay / 3.0))
        ir = lp(hp(ir, 250), bright)
        ir = np.concatenate([np.zeros(int(SR * pre)), ir])
        ir /= np.sqrt((ir ** 2).sum())
        out.append(signal.fftconvolve(x, ir)[: len(x) + n])
    return np.stack(out, 1)


# ---------- drums ----------
def kick(punch=1.0):
    t = tt(0.34)
    f = 52 + 125 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.115)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.004) * 0.3
    return fade(np.tanh(1.7 * punch * (body + click)), 0.0005, 0.03)

def clap():
    t = tt(0.42)
    n = bp(rng.standard_normal(len(t)), 850, 4200)
    env = np.zeros(len(t))
    for d in (0.0, 0.011, 0.022):
        m = t >= d
        env[m] += np.exp(-(t[m] - d) / 0.007)
    m = t >= 0.03
    env[m] += 0.75 * np.exp(-(t[m] - 0.03) / 0.085)
    return fade(n * env * 0.9, 0.0005, 0.02)

def hat(tau=0.016, dur=0.07):
    t = tt(dur)
    return fade(hp(rng.standard_normal(len(t)), 7500, 4) * np.exp(-t / tau), 0.0003, 0.008)

def snare_roll_hit():
    t = tt(0.11)
    n = bp(rng.standard_normal(len(t)), 1200, 7000) * np.exp(-t / 0.03)
    tone = np.sin(2 * np.pi * 210 * t) * np.exp(-t / 0.035) * 0.5
    return fade(n * 0.8 + tone, 0.0005, 0.01)


# ---------- tonal ----------
def saw(f, t, detune_cents=0.0, phase=0.0):
    f = f * 2 ** (detune_cents / 1200.0)
    return 2.0 * ((f * t + phase) % 1.0) - 1.0

def bass(note, dur):
    t = tt(dur)
    f = midi(note)
    x = lp(saw(f, t), 650, 2) * 0.8 + np.sin(2 * np.pi * f * t) * 0.55 + np.sin(2 * np.pi * f / 2 * t) * 0.35
    env = np.minimum(1, t / 0.004) * np.exp(-t / (dur * 0.9))
    return fade(np.tanh(1.5 * x) * env, 0.001, 0.02)

def stab(notes, dur=0.42):
    """Bright plucked chord: detuned saws, a filter that closes quickly. Returns stereo."""
    t = tt(dur)
    L = np.zeros(len(t)); R = np.zeros(len(t))
    for i, n in enumerate(notes):
        f = midi(n)
        a = saw(f, t, -8, 0.13 * i) + saw(f, t, +3, 0.57 + 0.11 * i)
        b = saw(f, t, +8, 0.31 * i) + saw(f, t, -3, 0.83 + 0.07 * i)
        L += a; R += b
    out = []
    for ch in (L, R):
        ch = ch / (2 * len(notes))
        bright = lp(ch, 5200, 2) * np.exp(-t / 0.055)
        body = lp(ch, 1100, 2) * np.exp(-t / 0.2)
        out.append(fade((bright * 0.9 + body * 0.8) * np.minimum(1, t / 0.002), 0.0005, 0.03))
    return np.stack(out, 1)

def mallet(note, dur=0.5, tau=0.16):
    """Soft marimba-like pluck for the top-line."""
    t = tt(dur)
    f = midi(note)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / tau) + 0.32 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.028) \
        + 0.12 * np.sin(2 * np.pi * 10 * f * t) * np.exp(-t / 0.012)
    return fade(x * np.minimum(1, t / 0.0015), 0.0005, 0.03)

def pad(notes, dur):
    t = tt(dur)
    x = np.zeros(len(t))
    for i, n in enumerate(notes):
        f = midi(n)
        x += np.sin(2 * np.pi * f * t + i) + 0.4 * np.sin(2 * np.pi * 2 * f * t + 2 * i)
    env = np.minimum(1, t / (dur * 0.35)) * np.minimum(1, (dur - t) / (dur * 0.3))
    return x / len(notes) * env


# ---------- sound design ----------
def sweep_noise(dur, f_from, f_to, q=2.2, bands=28, shape="hann", hi=14000.0):
    """Noise whose colour travels from f_from to f_to (a filter-bank stands in for a swept filter)."""
    n = int(SR * dur)
    x = rng.standard_normal(n)
    centres = np.geomspace(120, hi, bands)
    p = np.linspace(0, 1, n)
    centre_t = np.exp(np.log(f_from) + (np.log(f_to) - np.log(f_from)) * p)
    out = np.zeros(n)
    for i, c in enumerate(centres):
        lo, hi_f = c / 2 ** (1 / 5), min(c * 2 ** (1 / 5), SR / 2 * 0.95)
        band = bp(x, lo, hi_f, 2)
        w = np.exp(-0.5 * ((np.log(centre_t) - np.log(c)) * q) ** 2)
        out += band * w
    if shape == "hann":
        env = np.sin(np.pi * p) ** 1.6
    elif shape == "rise":
        env = p ** 2.2
    else:
        env = (1 - p) ** 1.5
    return fade(out * env, 0.003, 0.012)

def whoosh(dur, f_from, f_to, pan_from=-0.6, pan_to=0.6):
    m = sweep_noise(dur, f_from, f_to)
    p = np.linspace(pan_from, pan_to, len(m))
    a = (p + 1) * np.pi / 4
    return np.stack([m * np.cos(a) * 1.414, m * np.sin(a) * 1.414], 1)

def boom(dur=1.1):
    t = tt(dur)
    f = 46 + 95 * np.exp(-t / 0.06)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.24)
    crack = lp(rng.standard_normal(len(t)), 2200) * np.exp(-t / 0.05) * 0.6
    air = bp(rng.standard_normal(len(t)), 250, 2600) * np.exp(-t / 0.22) * 0.22        # the part phone speakers play
    return fade(np.tanh(1.5 * (sub + crack)) + air, 0.0005, 0.08)

def thud(dur=0.3, f=62.0):
    t = tt(dur)
    x = np.sin(2 * np.pi * (f + 40 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.075)
    x += lp(rng.standard_normal(len(t)), 900) * np.exp(-t / 0.018) * 0.5
    return fade(np.tanh(1.4 * x), 0.0005, 0.03)

def pop(f=820.0, dur=0.09):
    t = tt(dur)
    fr = f * (0.42 + 0.58 * np.exp(-t / 0.018))
    return fade(np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.026), 0.0005, 0.01)

def tick(dur=0.045):
    """Dry little 'tk' for text slamming in."""
    t = tt(dur)
    x = bp(rng.standard_normal(len(t)), 1800, 6500) * np.exp(-t / 0.006)
    x += np.sin(2 * np.pi * 1450 * t) * np.exp(-t / 0.009) * 0.5
    return fade(x, 0.0003, 0.008)

def blip(f1=1320.0, f2=1980.0):
    """Two-tone 'screen on' chirp."""
    t = tt(0.05)
    a = np.sin(2 * np.pi * f1 * t) * np.exp(-t / 0.02)
    b = np.sin(2 * np.pi * f2 * t) * np.exp(-t / 0.024)
    return fade(np.concatenate([a, b]) * 0.8, 0.0005, 0.01)

def ding(f=1568.0, dur=1.1):
    t = tt(dur)
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d)
            for r, a, d in ((1, 1.0, 0.32), (2.0, 0.42, 0.2), (2.76, 0.3, 0.14), (5.4, 0.16, 0.07)))
    return fade(x * np.minimum(1, t / 0.001), 0.0005, 0.05)

def shutter():
    t = tt(0.07)
    a = bp(rng.standard_normal(len(t)), 2200, 9000) * np.exp(-t / 0.004)
    b = np.zeros(len(t)); k = int(0.028 * SR)
    b[k:] = (bp(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t / 0.006))[: len(t) - k] * 0.8
    c = np.sin(2 * np.pi * 760 * t) * np.exp(-t / 0.012) * 0.6
    return fade(a + b + c, 0.0003, 0.01)

def rumble(dur=0.5):
    """Plastic wheels on paving: low rattling noise that swells then cuts at the set-down."""
    t = tt(dur)
    n = lp(rng.standard_normal(len(t)), 420, 2) + bp(rng.standard_normal(len(t)), 900, 2600) * 0.12
    rattle = 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 31 * t)) * np.sin(2 * np.pi * 31 * t) ** 2
    env = np.minimum(1, t / 0.06) * (1 - 0.35 * t / dur)
    return fade(n * rattle * env, 0.004, 0.02)

def riser(dur, f_from=220.0, f_to=1760.0):
    t = tt(dur)
    p = t / dur
    tone = np.sin(2 * np.pi * np.cumsum(f_from * (f_to / f_from) ** p) / SR) * 0.5
    tone += saw(1, np.cumsum(f_from * 1.005 * (f_to / f_from) ** p) / SR) * 0.18
    air = sweep_noise(dur, 700, 9000, q=1.6, shape="rise") * 0.9
    return fade((lp(tone, 6000) * p ** 2.4 + air), 0.01, 0.004)

def sparkle():
    """Three quick rising bells: sunlight."""
    out = np.zeros(int(SR * 1.0))
    for i, n in enumerate((88, 93, 100)):
        d = ding(midi(n), 0.7) * (0.8 - 0.12 * i)
        k = int(SR * 0.075 * i)
        out[k:k + len(d)] += d[: len(out) - k]
    return out


# ---------- arrangement ----------
def build(with_music=True):
    drums = np.zeros((N, 2)); music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); wet = np.zeros((N + SR * 3, 2))

    def send(sig, t0, gain, decay=0.8, bright=5200):
        """Add reverb for a mono hit."""
        r = reverb(sig, decay, bright)
        i = int(round(t0 * SR))
        n = min(len(r), len(wet) - i)
        wet[i:i + n] += r[:n] * gain

    K, CL, H, HO = kick(), clap(), hat(), hat(0.07, 0.24)
    chords = {                     # (stab voicing, bass root, top-line notes)
        "Am": ([57, 60, 64, 69], 45, [76, 72, 69]),
        "F": ([57, 60, 65, 69], 41, [77, 72, 69]),
        "C": ([55, 60, 64, 67], 48, [76, 72, 67]),
        "G": ([55, 59, 62, 67], 43, [74, 71, 67]),
    }
    prog = ["Am", "Am", "F", "C", "G", "Am", "F", "G"]          # one per bar; bar 0 is the build, bar 7 the lead-out

    if with_music:
        # --- bar 0: build under the hook ---
        place(music, stab(chords["Am"][0], 1.3) * np.exp(-tt(1.3) / 0.5)[:, None], 0.0, 0.6)
        place(drums, K, 0.0, 0.8)
        for i in range(8):                                       # 8th-note hats creeping up
            place(drums, H, i * 0.25, 0.1 + 0.035 * i, pan=0.25 if i % 2 else -0.25)
        for i in range(8):                                       # snare roll through the last beat
            place(drums, snare_roll_hit(), 1.5 + i * 0.0625, 0.16 + 0.05 * i)
        # --- bars 1-6: the groove ---
        for bar in range(1, 7):
            t0 = bar * BAR
            name = prog[bar]
            notes, root, top = chords[name]
            busy = bar >= 4
            for b in range(4):
                place(drums, K, t0 + b * BEAT, 0.8)
                if b in (1, 3):
                    place(drums, CL, t0 + b * BEAT, 0.6)
                    send(CL, t0 + b * BEAT, 0.1, 0.5, 6500)
                place(drums, HO if (b == 3 and bar % 2 == 0) else H, t0 + b * BEAT + BEAT / 2, 0.34, pan=0.2)
                if busy:
                    place(drums, H, t0 + b * BEAT + BEAT / 4, 0.11, pan=-0.3)
                    place(drums, H, t0 + b * BEAT + 3 * BEAT / 4, 0.14, pan=-0.3)
                place(music, bass(root + 12, 0.21), t0 + b * BEAT + BEAT / 2, 0.44)       # off-beat bass
            place(music, bass(root + 12, 0.16), t0 + 3 * BEAT + 3 * BEAT / 4, 0.32)
            for step, g in ((0, 1.0), (3, 0.82), (6, 0.9)):                               # 3-3-2 stabs
                st = stab(notes)
                place(music, st, t0 + step * BEAT / 2, 0.42 * g)
                r = reverb(st.mean(1), 0.9, 4800)
                i = int((t0 + step * BEAT / 2) * SR)
                wet[i:i + len(r)] += r[: len(wet) - i] * 0.09 * g
            for step, n in zip((2, 5, 7), top):                                           # answering top-line
                m = mallet(n)
                place(music, m, t0 + step * BEAT / 2, 0.36, pan=0.15)
                send(m, t0 + step * BEAT / 2, 0.06, 0.9, 6000)
        # sunshine bar gets a soft pad underneath
        place(music, pad([69, 72, 76, 79], 2.0), 8.0, 0.11)
        # --- bar 7: strip back, then wind up into the loop ---
        t0 = 7 * BAR
        notes, root, top = chords["G"]
        for b in range(2):
            place(drums, K, t0 + b * BEAT, 0.8)
            place(music, bass(root + 12, 0.21), t0 + b * BEAT + BEAT / 2, 0.44)
            place(drums, H, t0 + b * BEAT + BEAT / 2, 0.34, pan=0.2)
        place(drums, CL, t0 + BEAT, 0.6)
        place(music, stab(notes), t0, 0.42)
        place(music, stab(notes), t0 + 1.5 * BEAT, 0.36)
        place(drums, K, t0 + 2 * BEAT, 0.8)
        hits = np.concatenate([np.arange(15.0, 15.5, 0.125), np.arange(15.5, 15.75, 0.0625), np.arange(15.75, 16.0, 0.03125)])
        for i, th in enumerate(hits):                            # accelerating roll into the downbeat
            place(drums, snare_roll_hit(), th, 0.14 + 0.36 * (i / len(hits)) ** 1.5)
        # duck the musical parts under each kick so the low end stays clean
        duck = np.ones(N)
        for bar in range(0, 8):
            for b in range(4):
                tk = bar * BAR + b * BEAT
                if bar == 0 and b > 0: continue
                if bar == 7 and b > 2: continue
                i = int(tk * SR); n = int(0.2 * SR)
                if i + n <= N:
                    duck[i:i + n] = np.minimum(duck[i:i + n], 0.38 + 0.62 * np.linspace(0, 1, n) ** 1.6)
        music *= duck[:, None]

    # --- sound design, locked to the picture ---
    place(sfx, boom(), 0.0, 0.8)                                          # frame 0 impact (also where the loop lands)
    place(sfx, pop(900), 0.34, 0.38, pan=0.1)                             # "YES, YOU."
    place(sfx, whoosh(0.75, 5200, 380, 0.0, 0.0), 0.8, 0.5)               # camera pulls back
    place(sfx, thud(0.28, 70), 1.52, 0.42)
    for t0 in (2.0, 3.0, 14.0):                                           # three-line posters slamming in
        for i in range(3):
            place(sfx, tick(), t0 + i * 0.085, 0.42 - 0.06 * i, pan=-0.2 + 0.2 * i)
    place(sfx, pop(700), 2.3, 0.3, pan=-0.1)                              # the eyes
    place(sfx, whoosh(0.34, 500, 3600, -0.5, 0.2), 3.97, 0.38)            # board jumps into frame
    place(sfx, thud(0.24, 78), 4.25, 0.3)
    place(sfx, blip(), 4.06, 0.34)                                        # its screen wakes up
    for i in range(3):
        place(sfx, tick(), 4.08 + i * 0.085, 0.36 - 0.06 * i)
    place(sfx, whoosh(0.3, 900, 5200, -0.7, 0.7), 5.1, 0.46)              # spins round
    d = ding()
    place(sfx, d, 5.4, 0.36, pan=0.1); send(d, 5.4, 0.12, 1.1, 8000)      # battery light
    place(sfx, pop(620), 5.48, 0.3)
    place(sfx, rumble(0.52), 6.0, 0.62, pan=0.25)                         # rolls in on its wheels
    place(sfx, whoosh(0.5, 2600, 600, 0.8, -0.2), 6.0, 0.3)
    place(sfx, thud(0.3, 58), 6.5, 0.6)                                   # sets down
    place(sfx, blip(), 6.6, 0.34)
    for i in range(3):
        place(sfx, tick(), 6.6 + i * 0.085, 0.36 - 0.06 * i)
    sp = sparkle()
    place(sfx, sp, 8.0, 0.3, pan=0.3); send(sp, 8.0, 0.1, 1.2, 9000)      # sunshine
    for i in range(2):
        place(sfx, tick(), 8.0 + i * 0.085, 0.36)
    place(sfx, pop(980), 8.78, 0.36); place(sfx, blip(1568, 2093), 8.75, 0.26)
    for i, t0 in enumerate((10.0, 10.5, 11.0)):                           # artwork swaps
        place(sfx, shutter(), t0, 0.5, pan=(-0.3, 0.0, 0.3)[i])
        place(sfx, pop(640 + 120 * i), t0 + 0.02, 0.3)
    place(sfx, thud(0.22, 82), 11.5, 0.36)
    for i in range(3):
        place(sfx, tick(), 11.5 + i * 0.06, 0.42 - 0.06 * i)
    for i, t0 in enumerate((12.5, 13.0, 13.5)):                           # three quick cuts
        place(sfx, whoosh(0.2, 1200, 6000, -0.5, 0.5), t0 - 0.1, 0.3)
        place(sfx, shutter(), t0, 0.44, pan=(0.3, -0.3, 0.0)[i])
    place(sfx, pop(760), 14.42, 0.34)                                     # "COMMENT IT"
    place(sfx, riser(0.8), 15.2, 0.4)                                     # wind-up into the loop
    place(sfx, blip(), 15.43, 0.3)                                        # STOP artwork flips in
    wz = whoosh(0.56, 500, 7000, 0.0, 0.0)
    place(sfx, wz, 15.44, 0.44)                                           # dive into the screen

    mix = drums * 0.9 + music + sfx + wet[:N]
    return mix


def master(x, target_peak=0.89):
    x = hp(x.T, 36, 2).T
    x = np.tanh(x * 1.2) / np.tanh(1.2)                     # gentle glue / soft clip
    x = x / np.abs(x).max() * target_peak
    n = int(0.004 * SR)
    x[:n] *= np.linspace(0, 1, n)[:, None] ** 0.5
    x[-n:] *= np.linspace(1, 0, n)[:, None] ** 0.5
    return x


def write(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    write(os.path.join(out, "soundtrack.wav"), master(build(True)))
    rng = np.random.default_rng(7)
    write(os.path.join(out, "sfx_only.wav"), master(build(False), 0.6))
    print("wrote soundtrack.wav and sfx_only.wav")
