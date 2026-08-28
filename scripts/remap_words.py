#!/usr/bin/env python3
"""Companion to prep_speech_only.py: maps word timestamps from the SPLICED
transcription-only audio's timeline back onto the ORIGINAL file's timeline,
using the map prep_speech_only.py wrote. Run this right after transcribing
the spliced audio — everything downstream (find_repeat_candidates.py,
vad.py, refine_cuts.mjs, plan_cut.mjs) expects original-timeline words.json.

Usage:
    remap_words.py <words_spliced.json> <map.json> <out_words.json>
"""
import json
import sys
from pathlib import Path


def load_words(path: str) -> list:
    d = json.loads(Path(path).read_text())
    return d.get("words", d) if isinstance(d, dict) else d


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: remap_words.py <words_spliced.json> <map.json> <out_words.json>",
              file=sys.stderr)
        return 1
    words_spliced_path, map_path, out_path = sys.argv[1:4]

    words = load_words(words_spliced_path)
    spans = json.loads(Path(map_path).read_text())["spans"]

    def to_original(t: float) -> float:
        # find the span whose spliced-timeline range contains t
        for sp in spans:
            splice_start = sp["splice_start"]
            splice_end = splice_start + (sp["orig_end"] - sp["orig_start"])
            if splice_start <= t <= splice_end:
                return sp["orig_start"] + (t - splice_start)
        # past the last span (rounding at the tail) — clamp to the last span's end
        last = spans[-1]
        return last["orig_end"]

    out = []
    for w in words:
        start, end = float(w["start"]), float(w["end"])
        ns, ne = to_original(start), max(to_original(start) + 0.05, to_original(end))
        out.append({"word": w.get("word", ""), "start": round(ns, 3),
                    "end": round(ne, 3), "confidence": w.get("confidence")})
    out.sort(key=lambda w: w["start"])
    Path(out_path).write_text(json.dumps({"words": out}, ensure_ascii=False, indent=2))
    print(f"[remap_words] {len(out)} words remapped to original timeline -> {out_path}",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
