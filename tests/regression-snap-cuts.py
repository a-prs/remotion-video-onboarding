#!/usr/bin/env python3
"""Regression tests for scripts/snap_cuts.py — no pytest, stdlib only.
Test A reproduces the EXACT crash reported live 2026-09-02: refine_cuts.mjs's
word-edge boundary landed inside the wrong (dropped-take) vad.json region
because the keep word's own raw ASR timestamp also happened to overlap that
region (pair [29,41], "чувак" 193.31-194.53, region [192.19, 193.63]) — the
old point-test-based classifier couldn't tell the regions apart; snap_cuts.py
decides ownership by summed acoustic overlap across every word on each side
instead of one word's raw timestamp, and gets it right.
Run: python3 tests/regression-snap-cuts.py"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).parent.parent
SCRIPT = ROOT / "scripts" / "snap_cuts.py"

failures = 0


def check(label, got, want):
    global failures
    if got != want:
        failures += 1
        print(f"  ✗ {label}\n    got:  {got}\n    want: {want}")
    else:
        print(f"  ✓ {label}")


def approx(label, got, want, tol=0.02):
    global failures
    if got is None or abs(got - want) > tol:
        failures += 1
        print(f"  ✗ {label}\n    got:  {got}\n    want: ~{want}")
    else:
        print(f"  ✓ {label}")


def mkwd(name):
    return Path(tempfile.mkdtemp(prefix=f"snapcuts-{name}-"))


def run(wd):
    r = subprocess.run([sys.executable, str(SCRIPT), str(wd)], capture_output=True, text=True)
    retakes_path, words_path = wd / "retakes.json", wd / "words_cut.json"
    retakes = json.loads(retakes_path.read_text()) if retakes_path.exists() else None
    words = json.loads(words_path.read_text()) if words_path.exists() else None
    return r.returncode, r.stdout + r.stderr, retakes, words


def w(word, start, end):
    return {"word": word, "start": start, "end": end}


print("[A] the reported crash: boundary lands in the DROPPED take's own region -> snap forward")
wd = mkwd("crash")
(wd / "vad.json").write_text(json.dumps({
    "fine": [[188.80, 191.26], [192.19, 193.63], [194.18, 198.14]],
}))
(wd / "words_timed.json").write_text(json.dumps([
    w("штука", 187.0, 187.3),      # 0 — before the drop
    w("чувак1", 189.0, 189.5),     # 1 — dropIdx, region 1 (188.80-191.26)
    w("ну", 192.3, 193.5),         # 2 — lastDropped, mostly in region 2 (the dropped take's own)
    w("чувак2", 193.31, 194.53),   # 3 — keepIdx, raw ASR start ALSO overlaps region 2 (the bug trigger)
]))
(wd / "pairs.json").write_text(json.dumps({"pairs": [[1, 3]]}))
(wd / "retakes.raw.json").write_text(json.dumps({
    "cuts": [[190.0, 193.535]], "source": "refine_cuts", "schemaVersion": 2,
}))
code, out, retakes, words = run(wd)
check("exit 0 (no crash)", code, 0)
if retakes:
    approx("end snapped FORWARD to the real next region, not left inside the dropped region",
           retakes["cuts"][0][1], 194.12)
check("log mentions the snap", "область" in out or "снап" in out.lower() or "снят" in out, True)
shutil.rmtree(wd)

print("\n[B] boundary lands in the KEPT take's own region -> snap back")
wd = mkwd("back")
(wd / "vad.json").write_text(json.dumps({
    "fine": [[100.0, 102.0], [102.5, 106.0]],
}))
(wd / "words_timed.json").write_text(json.dumps([
    w("х", 100.0, 100.4),        # 0 — dropIdx
    w("поразному", 100.5, 100.9),  # 1 — lastDropped, region 1 (drop-side)
    w("При", 102.6, 102.9),      # 2 — keepIdx, region 2 (kept-side)
    w("делаем", 103.0, 103.4),   # 3
]))
(wd / "pairs.json").write_text(json.dumps({"pairs": [[0, 2]]}))
(wd / "retakes.raw.json").write_text(json.dumps({
    "cuts": [[99.0, 103.2]],  # inflated end (103.2) lands inside the KEPT region
    "source": "refine_cuts", "schemaVersion": 2,
}))
code, out, retakes, words = run(wd)
check("exit 0", code, 0)
if retakes:
    approx("end snapped BACK to the kept region's own start minus PREROLL", retakes["cuts"][0][1], 102.44)
shutil.rmtree(wd)

print("\n[C] ambiguous region (neither side has meaningful overlap) -> left untouched, not guessed")
wd = mkwd("unclear")
(wd / "vad.json").write_text(json.dumps({"fine": [[50.0, 55.0]]}))
(wd / "words_timed.json").write_text(json.dumps([
    w("a", 10.0, 10.3),
    w("b", 60.0, 60.3),
]))
(wd / "pairs.json").write_text(json.dumps({"pairs": [[0, 1]]}))
(wd / "retakes.raw.json").write_text(json.dumps({
    "cuts": [[9.0, 52.0]],  # end lands in a region neither word is anywhere near
    "source": "refine_cuts", "schemaVersion": 2,
}))
code, out, retakes, words = run(wd)
check("exit 0", code, 0)
if retakes:
    check("end left unchanged (52.0) — no confident owner to snap to", retakes["cuts"][0][1], 52.0)
check("stdout says it's unclear", "неясно" in out, True)
shutil.rmtree(wd)

print("\n[D] words pulled across a moved boundary are redistributed into real speech, not into a pause")
wd = mkwd("pull")
(wd / "vad.json").write_text(json.dumps({
    "fine": [[10.0, 12.0], [12.5, 14.0], [15.0, 20.0]],
}))
(wd / "words_timed.json").write_text(json.dumps([
    w("drop1", 10.5, 11.0),     # 0 — dropIdx
    w("drop2", 11.5, 11.9),     # 1 — lastDropped, region [10.0,12.0]
    w("keep1", 12.55, 12.8),    # 2 — keepIdx, stale timestamp — will be BEFORE the new boundary
    w("keep2", 12.85, 13.1),    # 3 — also stale
    w("keep3", 16.0, 16.3),     # 4 — first word already past the new boundary (anchor)
]))
(wd / "pairs.json").write_text(json.dumps({"pairs": [[0, 2]]}))
(wd / "retakes.raw.json").write_text(json.dumps({
    # end (11.7) sits inside the dropped region [10.0,12.0] -> snaps forward
    # to the next region [12.5,14.0]'s start minus PREROLL... but words 2/3
    # ("keep1"/"keep2") are stale relative to THAT too — real content is
    # actually in the region after (per this fixture, [15.0,20.0]) — exercise
    # the multi-region "room" accumulation, not just the very next region.
    "cuts": [[9.0, 11.7]], "source": "refine_cuts", "schemaVersion": 2,
}))
code, out, retakes, words = run(wd)
check("exit 0", code, 0)
if words:
    keep1 = next(x for x in words if x["word"] == "keep1")
    keep2 = next(x for x in words if x["word"] == "keep2")
    keep3 = next(x for x in words if x["word"] == "keep3")
    check("pulled words stay ordered (keep1 before keep2)", keep1["start"] < keep2["start"], True)
    check("pulled words end before the anchor (keep3) starts", keep2["end"] <= keep3["start"] + 1e-6, True)
    if retakes:
        check("no pulled word starts inside the final cut", keep1["start"] >= retakes["cuts"][0][1] - 1e-6, True)
shutil.rmtree(wd)

print("\n[E] spans + wordMoves — a hidden take with no textual duplicate")
wd = mkwd("spans")
(wd / "vad.json").write_text(json.dumps({"fine": [[0.0, 300.0]]}))
(wd / "words_timed.json").write_text(json.dumps([
    w("a", 0.0, 0.3),
    w("которая", 228.5, 240.0),  # index 1 — the word whose timestamp hid the second take
]))
(wd / "pairs.json").write_text(json.dumps({
    "pairs": [],
    "spans": [[228.48, 237.90, "скрытый заход, слит Whisper'ом в 'которая'"]],
    "wordMoves": [[1, 237.95, 238.28]],
}))
(wd / "retakes.raw.json").write_text(json.dumps({"cuts": [], "source": "refine_cuts", "schemaVersion": 2}))
code, out, retakes, words = run(wd)
check("exit 0", code, 0)
if retakes:
    check("span became a cut", retakes["cuts"], [[228.48, 237.90]])
if words:
    moved = next(x for x in words if x["word"] == "которая")
    check("wordMove applied", (moved["start"], moved["end"]), (237.95, 238.28))
shutil.rmtree(wd)

if failures:
    print(f"\n{failures} FAILURE(S)")
    sys.exit(1)
print("\nALL PASS")
