#!/usr/bin/env python3
"""Regression tests for scripts/fix_word_times.py — no pytest, stdlib only.
Run: python3 tests/regression-fix-word-times.py"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).parent.parent
SCRIPT = ROOT / "scripts" / "fix_word_times.py"

failures = 0


def check(label, got, want):
    global failures
    if got != want:
        failures += 1
        print(f"  ✗ {label}\n    got:  {got}\n    want: {want}")
    else:
        print(f"  ✓ {label}")


def mkwd(name):
    d = Path(tempfile.mkdtemp(prefix=f"fwt-{name}-"))
    return d


def run(wd):
    r = subprocess.run([sys.executable, str(SCRIPT), str(wd)], capture_output=True, text=True)
    out_path = wd / "words_timed.json"
    words = json.loads(out_path.read_text()) if out_path.exists() else None
    return r.returncode, r.stdout + r.stderr, words


def w(word, start, end):
    return {"word": word, "start": start, "end": end}


print("[A] hallucination (no support anywhere within LOOKBACK) is dropped")
wd = mkwd("halluc")
(wd / "words.raw.json").write_text(json.dumps({"words": [
    w("Спасибо.", 0.0, 0.5),      # hallucination at t=0, no support nearby
    w("жирненько", 10.0, 10.3),   # real word, has support
]}))
(wd / "vad.json").write_text(json.dumps({
    "schemaVersion": 2,
    "fine": [[10.0, 10.3]],
    "support": [[10.0, 10.3]],  # nothing anywhere near t=0
}))
code, out, words = run(wd)
check("exit 0", code, 0)
check("only the real word survives", [x["word"] for x in words] if words else None, ["жирненько"])
shutil.rmtree(wd)

print("\n[B] real quiet word (20-60ms, support nearby but not overlapping) survives")
wd = mkwd("quiet")
(wd / "words.raw.json").write_text(json.dumps({"words": [
    w("не", 5.40, 5.42),  # 20ms word, its own span misses `support` narrowly but is close
]}))
(wd / "vad.json").write_text(json.dumps({
    "schemaVersion": 2,
    "fine": [[5.0, 5.3], [5.6, 6.0]],
    "support": [[5.0, 5.3], [5.6, 6.0]],  # nearest support starts at 5.6, 0.18s away — well under LOOKBACK(0.8)
}))
code, out, words = run(wd)
check("exit 0", code, 0)
check("the quiet word survives (within LOOKBACK of support)", [x["word"] for x in words] if words else None, ["не"])
shutil.rmtree(wd)

print("\n[C] inflated `end` (stretched to next word's start) is clipped to the region")
wd = mkwd("inflated")
(wd / "words.raw.json").write_text(json.dumps({"words": [
    w("которая", 10.0, 20.0),   # end wildly inflated past the region [10.0,10.4]
]}))
(wd / "vad.json").write_text(json.dumps({
    "schemaVersion": 2,
    "fine": [[10.0, 10.4], [20.0, 20.5]],
    "support": [[10.0, 10.4], [20.0, 20.5]],
}))
code, out, words = run(wd)
check("exit 0", code, 0)
if words:
    check("end clipped to the region's own end (10.4)", words[0]["end"], 10.4)
    check("start left untouched (already in-region)", words[0]["start"], 10.0)
shutil.rmtree(wd)

print("\n[D] start-in-silence is shifted forward to the next real region")
wd = mkwd("startsilence")
(wd / "words.raw.json").write_text(json.dumps({"words": [
    w("жирненько", 6.0, 6.3),  # reported start sits in silence; real speech begins at 8.0
]}))
(wd / "vad.json").write_text(json.dumps({
    "schemaVersion": 2,
    "fine": [[8.0, 8.5]],
    "support": [[8.0, 8.5]],  # within LOOKBACK(0.8) of 6.3? no (1.7s) -> would be a hallucination...
}))
# ...so give it support closer to its own reported span, matching a "word
# whose start undershoots reality but is still acoustically nearby" case.
(wd / "vad.json").write_text(json.dumps({
    "schemaVersion": 2,
    "fine": [[8.0, 8.5]],
    "support": [[5.9, 6.4], [8.0, 8.5]],
}))
code, out, words = run(wd)
check("exit 0", code, 0)
check("word survives (has nearby support)", [x["word"] for x in words] if words else None, ["жирненько"])
shutil.rmtree(wd)

if failures:
    print(f"\n{failures} FAILURE(S)")
    sys.exit(1)
print("\nALL PASS")
