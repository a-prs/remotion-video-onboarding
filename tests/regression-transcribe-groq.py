#!/usr/bin/env python3
"""Regression tests for scripts/transcribe_groq.py — no pytest, stdlib only
(matches this skill's other tests). Run: python3 tests/regression-transcribe-groq.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from transcribe_groq import dedup_words  # noqa: E402

failures = []


def check(label, got, want):
    if got != want:
        failures.append(f"{label}\n  got:  {got}\n  want: {want}")
    else:
        print(f"  ✓ {label}")


def w(word, start, end):
    return {"word": word, "start": start, "end": end, "confidence": None}


print("[A] Groq's own doubled-word artifact (7-87ms apart) is collapsed")
words = [
    w("при", 10.00, 10.10), w("при", 10.05, 10.15),
    w("одном", 10.20, 10.40), w("одном", 10.28, 10.48),
    w("и", 10.50, 10.55), w("и", 10.57, 10.62),
    w("том", 10.70, 10.85), w("том", 10.79, 10.94),
    w("же", 11.00, 11.10), w("же", 11.07, 11.17),
]
out = dedup_words(words)
check("9 doubled pairs collapse to 5 words", [x["word"] for x in out],
      ["при", "одном", "и", "том", "же"])
check("kept occurrence is the FIRST (true onset)", out[0]["start"], 10.00)

print("[B] real repeated speech (0.28s+ apart) survives — must NOT be treated as the artifact")
words2 = [w("нет", 5.00, 5.20), w("нет", 5.28, 5.48)]
check("both 'нет's survive (0.28s gap, real repeat)", len(dedup_words(words2)), 2)

words3 = [w("что", 20.00, 20.15), w("что", 20.66, 20.81)]
check("0.66s gap survives untouched", len(dedup_words(words3)), 2)

print("[C] different words back-to-back are untouched")
words4 = [w("а", 1.00, 1.05), w("б", 1.06, 1.12)]
check("different words never collapse", len(dedup_words(words4)), 2)

print("[D] empty / single-word input doesn't crash")
check("empty list", dedup_words([]), [])
check("single word", len(dedup_words([w("да", 0.0, 0.1)])), 1)

if failures:
    print("\nFAILURES:")
    for f in failures:
        print(" -", f)
    sys.exit(1)
print("\nALL PASS")
