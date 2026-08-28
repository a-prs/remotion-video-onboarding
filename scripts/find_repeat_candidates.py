#!/usr/bin/env python3
"""Structural pre-filter for SKILL.md Шаг 6 п.2 (duplicate/false-start detection).

Production's retake_detector.py (video-montage) finds retakes via EXACT repeated
n-grams (3-8 words) before handing a candidate list to its LLM step. That method
catches "смысловой повтор" (two full sentences saying the same thing) but MISSES
stutters: a speaker who cuts off mid-sentence and restarts several times, saying
a DIFFERENT amount each time, never produces two IDENTICAL n-grams — the earlier
attempts are different-length PREFIXES of the final sentence, not repeats of it.
Example (real case): "чувак я" / "чувак я" / "чувак, я даже не..." — three
attempts, three different lengths, zero exact n-gram matches.

This script finds both:
  - exact repeats  — two phrase-chunks with the same word sequence
  - prefix matches — a shorter chunk's words == a prefix of a later chunk's
    words (the stutter/false-start case)

It does NOT decide what to cut. Шаг 6 п.2 still reads the full transcript
itself and applies the semantic rules there (intentional-repeat exception,
"сомневаешься — не режь", never cut punchlines, etc). This just hands it a
structured candidate list so short truncated fragments don't get lost when
reading a long transcript top-to-bottom.

Usage:
    find_repeat_candidates.py <words.json> [--out candidates.json]
                              [--phrase-gap 0.35] [--max-gap 30] [--min-words 2]
"""
import argparse
import json
import re
import sys
from pathlib import Path

MAX_GAP_SEC_DEFAULT = 30.0   # how far apart two chunks can be and still "relate"
PHRASE_GAP_DEFAULT = 0.35    # pause (sec) that splits words into phrase chunks
MIN_WORDS_DEFAULT = 2        # shortest match worth flagging ("чувак я" = 2 words)


def load_words(path: str) -> list:
    d = json.loads(Path(path).read_text())
    ws = d.get("words", d) if isinstance(d, dict) else d
    out = []
    for w in ws:
        if w.get("start") is None or w.get("end") is None:
            continue
        out.append({"word": w.get("word") or w.get("text") or "",
                    "start": float(w["start"]), "end": float(w["end"])})
    out.sort(key=lambda w: w["start"])
    return out


def normalize(word: str) -> str:
    return re.sub(r"[^\w]", "", word.lower())


def chunk_phrases(words: list, phrase_gap: float) -> list:
    """Split words into phrase-like chunks on pauses > phrase_gap seconds —
    a rough proxy for 'сmысловая единица' good enough for candidate-matching
    (the LLM step still judges actual sentence boundaries). Keeps each
    chunk's [start_idx, end_idx) into the original `words` list so callers
    can go straight to word-index pairs for scripts/refine_cuts.mjs without
    re-counting through the transcript by hand."""
    if not words:
        return []
    runs, cur = [], [(0, words[0])]
    for i in range(1, len(words)):
        gap = words[i]["start"] - words[i - 1]["end"]
        if gap > phrase_gap:
            runs.append(cur)
            cur = []
        cur.append((i, words[i]))
    if cur:
        runs.append(cur)
    out = []
    for run in runs:
        run_words = [w for _, w in run]
        norm = [normalize(w["word"]) for w in run_words if normalize(w["word"])]
        if not norm:
            continue
        out.append({"start": run_words[0]["start"], "end": run_words[-1]["end"],
                    "start_idx": run[0][0], "end_idx": run[-1][0],
                    "text": " ".join(w["word"] for w in run_words).strip(),
                    "norm": norm})
    return out


def find_candidates(chunks: list, max_gap: float, min_words: int) -> list:
    """Pairwise-compare chunks within max_gap seconds of each other; flag exact
    or prefix-overlap matches, chaining consecutive matches into one group
    (so "чувак я" x2 + full sentence lands in a single 3-occurrence group)."""
    groups, consumed = [], set()
    n = len(chunks)
    for i in range(n):
        if i in consumed:
            continue
        group, kinds, anchor = [i], [], i
        j = i + 1
        while j < n and chunks[j]["start"] - chunks[j - 1]["end"] <= max_gap:
            a, b = chunks[anchor], chunks[j]
            limit = min(len(a["norm"]), len(b["norm"]))
            common = 0
            while common < limit and a["norm"][common] == b["norm"][common]:
                common += 1
            if common >= min_words:
                kinds.append("exact" if common == len(a["norm"]) == len(b["norm"]) else "prefix")
                group.append(j)
                consumed.add(j)
                anchor = j
            j += 1
        if len(group) >= 2:
            consumed.add(i)
            groups.append({
                "kind": "prefix" if "prefix" in kinds else "exact",
                "occurrences": [
                    {"start": round(chunks[k]["start"], 3), "end": round(chunks[k]["end"], 3),
                     "start_idx": chunks[k]["start_idx"], "end_idx": chunks[k]["end_idx"],
                     "text": chunks[k]["text"]}
                    for k in group
                ],
            })
    groups.sort(key=lambda g: g["occurrences"][0]["start"])
    return groups


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("words_json")
    ap.add_argument("--out", default="", help="write JSON here too (default: stdout only)")
    ap.add_argument("--phrase-gap", type=float, default=PHRASE_GAP_DEFAULT,
                    help="pause (sec) that splits words.json into phrase chunks")
    ap.add_argument("--max-gap", type=float, default=MAX_GAP_SEC_DEFAULT,
                    help="max sec between chunks to still consider them related")
    ap.add_argument("--min-words", type=int, default=MIN_WORDS_DEFAULT,
                    help="shortest word-overlap worth flagging as a candidate")
    args = ap.parse_args()

    words = load_words(args.words_json)
    chunks = chunk_phrases(words, args.phrase_gap)
    candidates = find_candidates(chunks, args.max_gap, args.min_words)

    result = {"candidates": candidates}
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(text)
    print(text)
    exact = sum(1 for g in candidates if g["kind"] == "exact")
    prefix = sum(1 for g in candidates if g["kind"] == "prefix")
    print(f"[find_repeat_candidates] {len(candidates)} candidate groups "
          f"({exact} exact, {prefix} prefix/false-start)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
