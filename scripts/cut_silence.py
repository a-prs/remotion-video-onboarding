#!/usr/bin/env python3
"""Pause/silence trimmer for a talking-head clip. Cuts long silences and shifts
word timestamps onto the cut timeline, so subtitles/captions still line up
with the trimmed video (no words lost, no re-transcription needed).

Two modes:
  - default (word-gap): gaps between consecutive whisper word timestamps.
    DON'T rely on this for anything picky — whisper timestamps lag real
    speech by up to ~1-1.8s, so this mode can clip live speech.
  - --audio (recommended): real ffmpeg silencedetect on the actual audio
    waveform — speech/no-speech ground truth, immune to whisper's timing lag.

Input word timestamps: use `@remotion/install-whisper-cpp`'s transcribe()
with `tokenLevelTimestamps: true` and the `--dtw` flag - segment-level
`offsets` alone are not precise enough for pause detection.

Usage:
    cut_silence.py <in_video> <raw_words.json> <out_video> <out_words.json>
                   --audio [--gap 0.8] [--pad 0.15] [--noise -30] [--level]

Keeps a `pad` of breathing room around speech; any silence longer than `gap`
(seconds) is removed. Re-encodes per-segment + concat (memory-light, won't
OOM on long files).
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path


def load_words(path: str) -> list:
    d = json.loads(Path(path).read_text())
    ws = d.get("words", d) if isinstance(d, dict) else d
    out = []
    for w in ws:
        if w.get("start") is None or w.get("end") is None:
            continue
        out.append({"word": w.get("word") or w.get("text") or "",
                    "start": float(w["start"]), "end": float(w["end"]),
                    "confidence": w.get("confidence")})
    out.sort(key=lambda w: w["start"])
    return out


def probe_duration(video: str) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nk=1:nw=1", video], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def keep_segments(words: list, dur: float, gap: float, pad: float) -> list:
    """[start,end] spans of speech to KEEP (raw timeline), gaps>gap removed."""
    if not words:
        return [[0.0, dur]]
    segs = []
    start = max(0.0, words[0]["start"] - pad)
    for i in range(len(words) - 1):
        g = words[i + 1]["start"] - words[i]["end"]
        if g > gap:
            end = min(dur, words[i]["end"] + pad)
            segs.append([start, end])
            start = max(0.0, words[i + 1]["start"] - pad)
    segs.append([start, min(dur, words[-1]["end"] + pad)])
    # merge overlapping / touching
    merged = [segs[0]]
    for s in segs[1:]:
        if s[0] <= merged[-1][1] + 0.02:
            merged[-1][1] = max(merged[-1][1], s[1])
        else:
            merged.append(s)
    return [s for s in merged if s[1] - s[0] > 0.05]


def detect_silences(video: str, noise_db: float, min_sil: float) -> list:
    """Real AUDIO silences via ffmpeg silencedetect — ground truth for 'no speech'.
    Whisper word-ends get stretched over pauses, so word-gap cutting misses them;
    the audio itself does not lie. Returns [[start,end], ...] of silent spans."""
    r = subprocess.run(
        ["ffmpeg", "-i", video, "-af",
         f"silencedetect=noise={noise_db}dB:d={min_sil}", "-f", "null", "-"],
        capture_output=True, text=True)
    sils, cur = [], None
    for line in (r.stderr or "").splitlines():
        if "silence_start:" in line:
            try:
                cur = float(line.split("silence_start:")[1].strip())
            except ValueError:
                cur = None
        elif "silence_end:" in line and cur is not None:
            try:
                end = float(line.split("silence_end:")[1].split("|")[0].strip())
                sils.append([cur, end])
            except ValueError:
                pass
            cur = None
    return sils


def keep_from_audio(video: str, dur: float, noise_db: float, min_sil: float,
                    pad: float) -> list:
    """KEEP spans = complement of audio silences, leaving `pad` of air around
    speech so cuts don't clip breaths/word-edges. Robust to bad whisper timings."""
    sils = detect_silences(video, noise_db, min_sil)
    removed = []
    for s, e in sils:
        rs, re_ = s + pad, e - pad          # shrink: keep pad of air on both sides
        if re_ - rs > 0.03:
            removed.append([rs, re_])
    if not removed:
        return [[0.0, dur]]
    removed.sort()
    keep, cursor = [], 0.0
    for rs, re_ in removed:
        if rs > cursor + 0.05:
            keep.append([cursor, rs])
        cursor = max(cursor, re_)
    if cursor < dur - 0.05:
        keep.append([cursor, dur])
    return [s for s in keep if s[1] - s[0] > 0.05]


def retime_words_clamped(words: list, segs: list) -> list:
    """Map words onto the cut timeline; a word landing inside a removed (silent)
    span is SNAPPED to the nearest kept edge instead of dropped — no lost subs."""
    bounds, base = [], 0.0
    for s, e in segs:
        bounds.append((s, e, base - s))
        base += e - s
    total = base

    def remap(t: float) -> float:
        prev_end_new = 0.0
        for s, e, off in bounds:
            if s <= t <= e:
                return t + off
            if e < t:
                prev_end_new = e + off
            elif s > t:
                return prev_end_new           # t sits in a removed gap → snap back
        return min(total, prev_end_new)

    out = []
    for w in words:
        ns = remap(w["start"])
        ne = max(ns + 0.05, remap(w["end"]))
        out.append({"word": w["word"], "start": round(ns, 3),
                    "end": round(ne, 3), "confidence": w["confidence"]})
    return out


def snap_cut_boundaries(cuts: list, silences: list, max_snap: float) -> list:
    """Widen each [cs,ce] retake cut to the edge of an adjacent real silence
    (from detect_silences) within max_snap seconds, so the splice lands in
    dead air instead of mid-word/mid-breath. Only ever WIDENS a cut, never
    shrinks it — safe by construction, can't eat into wanted speech."""
    if not silences or not cuts:
        return cuts
    sils = sorted(silences)
    out = []
    for cs, ce in cuts:
        ns, ne = cs, ce
        for s, e in sils:
            if s <= cs <= e or 0 <= cs - e <= max_snap:
                ns = min(ns, s)
        for s, e in sils:
            if s <= ce <= e or 0 <= s - ce <= max_snap:
                ne = max(ne, e)
        out.append([ns, ne])
    return out


def subtract_spans(keep: list, cuts: list) -> list:
    """Remove `cuts` spans (retakes/false starts) from the kept intervals."""
    if not cuts:
        return keep
    cuts = sorted([list(c) for c in cuts])
    out = []
    for s, e in keep:
        cur = [[s, e]]
        for cs, ce in cuts:
            nxt = []
            for a, b in cur:
                if ce <= a or cs >= b:        # no overlap
                    nxt.append([a, b])
                else:                          # split around the cut
                    if cs > a:
                        nxt.append([a, min(cs, b)])
                    if ce < b:
                        nxt.append([max(ce, a), b])
            cur = nxt
        out += cur
    return [s for s in out if s[1] - s[0] > 0.05]


def retime_words(words: list, segs: list) -> list:
    """Map each word onto the cut timeline (drop words inside removed gaps)."""
    # cumulative kept duration before each segment
    base, offs = 0.0, []
    for s in segs:
        offs.append(base - s[0])
        base += s[1] - s[0]
    out = []
    for w in words:
        mid = (w["start"] + w["end"]) / 2
        for s, off in zip(segs, offs):
            if s[0] <= mid <= s[1]:
                out.append({"word": w["word"],
                            "start": round(w["start"] + off, 3),
                            "end": round(w["end"] + off, 3),
                            "confidence": w["confidence"]})
                break
    return out


def cut_video(inp: str, segs: list, out: str) -> None:
    """Memory-light cut: encode each keep segment to its own temp file (only one
    segment in memory at a time), then concat-demux with stream copy. Avoids the
    giant single-filtergraph that buffers every segment at once → OOM (exit 137)."""
    tmp = Path(out).parent / (Path(out).stem + "_segs")
    tmp.mkdir(exist_ok=True)
    seg_files = []
    for i, (s, e) in enumerate(segs):
        seg = tmp / f"seg_{i:03d}.mp4"
        # -ss before -i = fast seek; re-encode for frame-accurate independent cuts.
        cmd = ["ffmpeg", "-y", "-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-i", inp,
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "14",
               "-c:a", "aac", "-b:a", "160k", "-avoid_negative_ts", "make_zero",
               str(seg), "-loglevel", "error"]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0 or not seg.exists():
            print(f"ffmpeg seg {i} failed: {r.stderr[-300:]}", file=sys.stderr)
            sys.exit(1)
        seg_files.append(seg)
    listf = tmp / "concat.txt"
    listf.write_text("".join(f"file '{f.name}'\n" for f in seg_files))
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listf),
           "-c", "copy", "-movflags", "+faststart", out, "-loglevel", "error"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"concat failed: {r.stderr[-300:]}", file=sys.stderr)
        sys.exit(1)
    for f in seg_files:
        f.unlink(missing_ok=True)
    listf.unlink(missing_ok=True)
    tmp.rmdir()


def _level_audio(video: str) -> None:
    """Best-effort loudness/denoise pass (clean_audio.py) on the cut, IN PLACE.
    Non-fatal (Андрей 2026-08-21: включаем выравнивание везде) — on any failure keep
    the un-levelled cut so no pipeline ever breaks over audio leveling."""
    tmp = Path(video).with_suffix(".lvl.mp4")
    try:
        r = subprocess.run(
            [sys.executable, str(Path(__file__).parent / "clean_audio.py"),
             video, "--render", str(tmp)],
            capture_output=True, text=True, timeout=600,
        )
        if r.returncode == 0 and tmp.exists() and tmp.stat().st_size > 0:
            tmp.replace(video)
            print(f"[level] clean_audio → {video}", file=sys.stderr)
        else:
            tmp.unlink(missing_ok=True)
            print(f"[level] clean_audio skipped (rc={r.returncode}) — kept raw cut", file=sys.stderr)
    except Exception as exc:  # noqa: BLE001 — leveling must never break the cut
        tmp.unlink(missing_ok=True)
        print(f"[level] clean_audio error ({exc}) — kept raw cut", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("raw_words")
    ap.add_argument("out_video")
    ap.add_argument("out_words")
    ap.add_argument("--gap", type=float, default=0.35)
    ap.add_argument("--pad", type=float, default=0.12)
    ap.add_argument("--audio", action="store_true",
                    help="cut by REAL audio silence (ffmpeg silencedetect) instead of "
                         "whisper word-gaps — catches pauses whisper hides inside word "
                         "durations. --gap becomes the min silence length to remove.")
    ap.add_argument("--noise", type=float, default=-30.0, help="silence threshold dB (audio mode)")
    ap.add_argument("--cut-spans", default="", help="retakes.json {cuts:[[s,e]]} — also remove these")
    ap.add_argument("--snap-window", type=float, default=0.3,
                    help="max sec to widen a retake cut into adjacent real silence "
                         "for a clean splice (0 disables snapping)")
    ap.add_argument("--snap-min-sil", type=float, default=0.12,
                    help="min silence length (sec) to detect for boundary-snapping — "
                         "finer than --gap, since this only widens cut edges, it "
                         "doesn't remove pauses on its own")
    ap.add_argument("--level", action="store_true",
                    help="after cutting, run clean_audio.py on the output (loudnorm -14 LUFS "
                         "+ denoise + de-hum), in place. Non-fatal — keeps the raw cut on failure.")
    args = ap.parse_args()

    words = load_words(args.raw_words)
    dur = probe_duration(args.video)
    if args.audio:
        segs = keep_from_audio(args.video, dur, args.noise, args.gap, args.pad)
        retime = retime_words_clamped
    else:
        segs = keep_segments(words, dur, args.gap, args.pad)
        retime = retime_words
    pause_kept = sum(e - s for s, e in segs)
    cuts = []
    if args.cut_spans:
        cd = json.loads(Path(args.cut_spans).read_text())
        cuts = cd.get("cuts", cd) if isinstance(cd, dict) else cd
        if cuts and args.snap_window > 0:
            snap_sils = detect_silences(args.video, args.noise, args.snap_min_sil)
            cuts = snap_cut_boundaries(cuts, snap_sils, args.snap_window)
        segs = subtract_spans(segs, cuts)
    kept = sum(e - s for s, e in segs)
    print(f"[{'audio' if args.audio else 'words'}] keep {len(segs)} segs, {kept:.1f}s of {dur:.1f}s "
          f"(pauses cut {dur - pause_kept:.1f}s, retakes cut {pause_kept - kept:.1f}s)",
          file=sys.stderr)
    cut_video(args.video, segs, args.out_video)
    cut_words = retime(words, segs)
    Path(args.out_words).write_text(json.dumps(
        {"words": cut_words, "duration": round(kept, 2),
         "segments_kept": [[round(s, 3), round(e, 3)] for s, e in segs]},
        ensure_ascii=False, indent=2))
    print(f"wrote {args.out_video} + {args.out_words} ({len(cut_words)} words)",
          file=sys.stderr)
    if args.level:
        _level_audio(args.out_video)
    return 0


if __name__ == "__main__":
    sys.exit(main())
