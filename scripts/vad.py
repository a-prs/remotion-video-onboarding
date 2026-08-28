#!/usr/bin/env python3
"""Speech-activity map for cut planning — the single source of truth every
consumer in the pipeline reads (pause removal, retake-boundary refinement,
speech-only transcription splicing). Two engines:

  - `silero` (default when available) — a real speech classifier (Silero VAD,
    via a vendored ONNX model + onnxruntime, see scripts/vad_model.py), the
    same detector this skill's author's production pipeline uses for pause
    removal. Answers "is anyone speaking", not "is this quieter than a fixed
    dB threshold" — robust to noise, breath, and quiet speech that a raw
    amplitude/energy threshold misses (the class of bug that lost a whole
    punchline word on real material — see references/audio-pipeline.md).
  - `energy` — the original local-percentile energy detector (no ML,
    numpy/scipy only). Used as a loud, visible fallback if onnxruntime isn't
    installed or the vendored model fails to load — never silently, and
    never a hard stop for a public skill installed on unfamiliar machines.

Both engines produce the SAME schema (schemaVersion 2), with two maps at two
different bars:
  - `fine`/`regions` — high bar (Silero: threshold 0.5 + hysteresis + 80ms
    min-silence; energy: the existing on/off hysteresis + duration filters).
    This is "confidently speech" — what plan_cut.mjs uses to decide where
    the real pauses are.
  - `support` — low bar, no duration filtering at all (Silero: any window
    with speech probability >= neg_threshold 0.35; energy: any window above
    the local noise floor by the hysteresis "exit" margin). This is "any
    acoustic evidence of speech at all" — what plan_cut.mjs uses to decide
    whether a word ASR claims exists should be protected from a pause-cut
    even if Silero's higher `fine` bar missed it (a quiet punchline, a word
    shorter than the duration filters). See references/audio-pipeline.md
    for why this two-tier design exists and what class of bug it closes.

Usage: vad.py <audio16k.wav> <out.json> [--engine silero|energy|auto]
                                        [--on 7] [--off 4]
"""
import argparse
import json
import os
import sys

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import percentile_filter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vad_model import SileroVAD, MODEL_SHA256, speech_regions as silero_speech_regions, mask_to_regions  # noqa: E402

SCHEMA_VERSION = 2
HOP = 0.010          # 10 ms — energy engine step, ALWAYS present regardless of engine
                     # (refine_cuts.mjs relies on this for its energy tie-break/fallback)
WIN = 0.025          # 25 ms
MIN_SPEECH = 0.060
MIN_GAP = 0.060

SILERO_THRESHOLD = 0.5
SILERO_NEG_THRESHOLD = 0.35
SILERO_MIN_SILENCE_S = 0.08
PROB_HOP = 512 / 16000  # 32 ms — Silero's fixed window size at 16kHz


def energy_db(x: np.ndarray, sr: int) -> np.ndarray:
    hop = int(round(HOP * sr))
    win = int(round(WIN * sr))
    n = 1 + max(0, (len(x) - win) // hop)
    idx = np.arange(win)[None, :] + hop * np.arange(n)[:, None]
    frames = x[idx].astype(np.float64)
    rms = np.sqrt(np.mean(frames * frames, axis=1) + 1e-12)
    return 20.0 * np.log10(rms + 1e-12)


def energy_regions(db: np.ndarray, on_margin: float, off_margin: float):
    """Returns (fine_regions, support_regions) — fine has hysteresis +
    duration filters (the existing behavior), support is the raw
    'above the exit threshold' mask with no filtering at all."""
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

    merged = []
    for s, e in regions:
        if merged and (s - merged[-1][1]) * HOP < MIN_GAP:
            merged[-1][1] = e
        else:
            merged.append([s, e])
    fine = [[round(s * HOP, 3), round(e * HOP, 3)]
            for s, e in merged if (e - s) * HOP >= MIN_SPEECH]

    support = mask_to_regions(~off, HOP)  # db >= floor+off_margin, no duration filter
    return fine, support


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("out")
    ap.add_argument("--engine", choices=["silero", "energy", "auto"], default="auto",
                    help="auto = Silero if onnxruntime/model available, else energy "
                         "fallback with a loud warning (never a silent downgrade)")
    ap.add_argument("--on", type=float, default=7.0,
                    help="energy engine: dB above local floor to enter speech")
    ap.add_argument("--off", type=float, default=4.0,
                    help="energy engine: dB above local floor to leave speech "
                         "(also the support-map threshold)")
    a = ap.parse_args()

    sr, x = wavfile.read(a.audio)
    if x.ndim > 1:
        x = x.mean(axis=1)
    x = x.astype(np.float64) / (np.iinfo(np.int16).max if x.dtype == np.int16 else 1.0)
    duration = len(x) / sr

    db = energy_db(x, sr)  # always computed: tie-break, fallback engine, debug comparability

    engine = a.engine
    probs = None
    if engine in ("silero", "auto"):
        try:
            vad = SileroVAD()
            probs = vad.score(x.astype(np.float32))
            engine = "silero"
        except Exception as exc:  # noqa: BLE001 — any failure here means "use the fallback"
            if a.engine == "silero":
                print(f"[vad] --engine silero requested but unavailable: {exc}", file=sys.stderr)
                return 1
            print(f"[vad] Silero unavailable ({exc}) — falling back to the energy detector. "
                  f"Install onnxruntime (`pip install onnxruntime`) for better accuracy in "
                  f"noise/on quiet speech.", file=sys.stderr)
            engine = "energy-fallback"

    out = {
        "schemaVersion": SCHEMA_VERSION,
        "engine": engine,
        "duration": round(duration, 3),
        "hop": HOP,
        "energyHop": HOP,
        "db": [round(float(v), 2) for v in db],
    }

    if probs is not None:
        fine = silero_speech_regions(probs, PROB_HOP, threshold=SILERO_THRESHOLD,
                                     neg_threshold=SILERO_NEG_THRESHOLD,
                                     min_silence_s=SILERO_MIN_SILENCE_S,
                                     min_speech_s=0.0, pad_s=0.0)
        support = mask_to_regions(probs >= SILERO_NEG_THRESHOLD, PROB_HOP)
        out["probHop"] = PROB_HOP
        out["probs"] = [round(float(p), 3) for p in probs]
        out["model"] = "silero_vad_v6.onnx"
        out["modelSha256"] = MODEL_SHA256
        out["params"] = {"threshold": SILERO_THRESHOLD, "negThreshold": SILERO_NEG_THRESHOLD,
                         "minSilenceS": SILERO_MIN_SILENCE_S}
    else:
        fine, support = energy_regions(db, a.on, a.off)
        out["params"] = {"onMargin": a.on, "offMargin": a.off}

    out["fine"] = fine
    out["regions"] = fine  # alias, kept for readability/compat
    out["support"] = support

    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f)

    fine_total = sum(e - s for s, e in fine)
    print(f"[vad] engine={engine} fine_regions={len(fine)} ({fine_total:.1f}s of {duration:.1f}s) "
          f"support_regions={len(support)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
