#!/usr/bin/env python3
"""Speech-activity map for cut planning.

`silencedetect` answers "is this quieter than -30dB", which is not the same
question as "is anyone speaking". It uses one fixed threshold for the whole file
and a coarse window, so it misses the short gaps between words entirely — which
is why cut boundaries kept landing inside a word and leaving its onset behind.

This computes a real speech/no-speech map:
  * 10 ms hop, 25 ms window short-time energy
  * noise floor estimated LOCALLY (rolling low percentile), so the threshold
    follows room tone instead of assuming a global level
  * hysteresis: a higher threshold to enter speech than to leave it, so the
    decay of a word does not chatter the detector on and off
  * minimum speech / gap durations to reject clicks and breaths

Usage: vad.py <audio16k.wav> <out.json> [--on 7] [--off 4]
"""
import argparse
import json
import sys

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import percentile_filter

HOP = 0.010          # 10 ms
WIN = 0.025          # 25 ms
MIN_SPEECH = 0.060
MIN_GAP = 0.060


def energy_db(x, sr):
    hop = int(round(HOP * sr))
    win = int(round(WIN * sr))
    n = 1 + max(0, (len(x) - win) // hop)
    idx = np.arange(win)[None, :] + hop * np.arange(n)[:, None]
    frames = x[idx].astype(np.float64)
    rms = np.sqrt(np.mean(frames * frames, axis=1) + 1e-12)
    return 20.0 * np.log10(rms + 1e-12)


def speech_regions(db, on_margin, off_margin):
    # local noise floor: 10th percentile over a ~3 s neighbourhood
    floor = percentile_filter(db, percentile=10, size=int(3.0 / HOP), mode="nearest")
    on = db > floor + on_margin
    off = db < floor + off_margin

    regions, start = [], None
    for i in range(len(db)):
        if start is None:
            if on[i]:
                start = i
        elif off[i]:
            regions.append((start, i))
            start = None
    if start is not None:
        regions.append((start, len(db)))

    # merge across short gaps, then drop short blips
    merged = []
    for s, e in regions:
        if merged and (s - merged[-1][1]) * HOP < MIN_GAP:
            merged[-1][1] = e
        else:
            merged.append([s, e])
    return [[round(s * HOP, 3), round(e * HOP, 3)]
            for s, e in merged if (e - s) * HOP >= MIN_SPEECH]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("out")
    ap.add_argument("--on", type=float, default=7.0, help="dB above local floor to enter speech")
    ap.add_argument("--off", type=float, default=4.0, help="dB above local floor to leave speech")
    a = ap.parse_args()

    sr, x = wavfile.read(a.audio)
    if x.ndim > 1:
        x = x.mean(axis=1)
    x = x.astype(np.float64) / (np.iinfo(np.int16).max if x.dtype == np.int16 else 1.0)

    db = energy_db(x, sr)
    regions = speech_regions(db, a.on, a.off)
    total = sum(e - s for s, e in regions)
    # The energy curve ships with the map: inside a continuous region (speaker
    # runs two takes together with no pause) there is no gap to snap to, and the
    # only usable clue for the word boundary is the local energy minimum.
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"hop": HOP, "duration": round(len(x) / sr, 3),
                   "regions": regions,
                   "db": [round(float(v), 2) for v in db]}, f)
    print(f"speech regions: {len(regions)}  ({total:.1f}s of {len(x)/sr:.1f}s)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
