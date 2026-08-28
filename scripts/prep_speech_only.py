#!/usr/bin/env python3
"""Speech-only splice for transcribing a mostly-silent long file — SKILL.md
Шаг 6 п.1. Whisper (local and, per reports, possibly hosted engines too) can
loop on long silent stretches: on one real 9:43 clip that was 81% silence,
local `medium` repeated one sentence ~70 times from the 7-minute mark on.

Splices only the speech-active stretches (VAD-style energy detection, same
family as scripts/vad.py) into one short temp file for transcription, with
GENEROUS padding around each — NOT this skill's tight final-cut padding.
That distinction matters: transcribing the tightly-cut FINAL edit is a
DIFFERENT, worse idea (documented failure on real material: "Жирненько я
сказал" instead of "Жирненькая, сказал" — Whisper is autoregressive and
needs natural run-up/decay around a phrase, which a tight final cut removes).
Generous padding here is what keeps that context intact while still skipping
the genuinely dead air.

Only engage this at all when silence is dominant (--ratio-threshold, default
0.55) — below that, transcribing the original directly is both simpler and
not meaningfully slower.

Usage:
    prep_speech_only.py <video> <out_audio.wav> <out_map.json>
                        [--ratio-threshold 0.55] [--min-silence 6.0] [--pad 1.5]

Exit code 2 (no output files written) means "not needed, transcribe the
original directly" — the ratio was under threshold. Exit 0 means out_audio
and out_map were written; transcribe out_audio, then run remap_words.py with
out_map to get word timestamps back on the ORIGINAL file's timeline before
handing off to find_repeat_candidates.py / vad.py / refine_cuts.mjs, which
all expect original-timeline coordinates.

STATUS: this script (unlike vad.py/refine_cuts.mjs/plan_cut.mjs) was NOT
provided pre-built and live-tested — it implements the technique described
in SKILL_PATCH_NOTES.md point 4 from scratch. Treat the first real run as a
live test, not as already-validated.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from cut_silence import detect_silences, probe_duration  # noqa: E402 — reuse, no dupe logic


def extract_audio(src: str, out_wav: str) -> None:
    cmd = ["ffmpeg", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000",
           out_wav, "-loglevel", "error"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"ffmpeg audio extract failed: {r.stderr[-400:]}", file=sys.stderr)
        sys.exit(1)


def plan_speech_spans(audio_wav: str, dur: float, min_silence: float, pad: float) -> list:
    """[[orig_start, orig_end], ...] spans worth transcribing: the complement
    of long silences, each padded generously (capped so neighboring spans
    never overlap) to preserve Whisper's run-up/decay context."""
    sils = detect_silences(audio_wav, noise_db=-30.0, min_sil=min_silence)
    if not sils:
        return [[0.0, dur]]
    spans, cursor = [], 0.0
    for s, e in sils:
        if s > cursor:
            spans.append([cursor, s])
        cursor = e
    if dur > cursor:
        spans.append([cursor, dur])
    # pad, then clamp to not eat into the (removed) silence beyond what's fair —
    # halfway into each adjacent silence at most, so two padded spans never overlap
    padded = []
    for i, (s, e) in enumerate(spans):
        lo_gap = s - (spans[i - 1][1] if i > 0 else 0.0)
        hi_gap = (spans[i + 1][0] if i < len(spans) - 1 else dur) - e
        padded.append([max(0.0, s - min(pad, lo_gap / 2)),
                       min(dur, e + min(pad, hi_gap / 2))])
    return padded


def splice_audio(audio_wav: str, spans: list, out_wav: str, tmp_dir: Path) -> None:
    seg_files = []
    for i, (s, e) in enumerate(spans):
        seg = tmp_dir / f"speech_{i:03d}.wav"
        cmd = ["ffmpeg", "-y", "-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-i", audio_wav,
               "-ac", "1", "-ar", "16000", str(seg), "-loglevel", "error"]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0 or not seg.exists():
            print(f"ffmpeg splice segment {i} failed: {r.stderr[-400:]}", file=sys.stderr)
            sys.exit(1)
        seg_files.append(seg)
    listf = tmp_dir / "concat.txt"
    listf.write_text("".join(f"file '{f.name}'\n" for f in seg_files))
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listf),
           "-c", "copy", out_wav, "-loglevel", "error"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"concat failed: {r.stderr[-400:]}", file=sys.stderr)
        sys.exit(1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("out_audio")
    ap.add_argument("out_map")
    ap.add_argument("--ratio-threshold", type=float, default=0.55,
                    help="skip splicing (exit 2) unless silence exceeds this fraction of duration")
    ap.add_argument("--min-silence", type=float, default=6.0,
                    help="only stretches at least this long (sec) count toward the ratio "
                         "and get cut out — short natural pauses stay untouched")
    ap.add_argument("--pad", type=float, default=1.5,
                    help="run-up/decay context (sec) kept around each speech span — "
                         "deliberately generous, NOT this skill's tight final --pad")
    args = ap.parse_args()

    tmp_dir = Path(args.out_audio).parent
    tmp_dir.mkdir(parents=True, exist_ok=True)
    raw_wav = str(tmp_dir / f"_prep_raw_{Path(args.video).stem}.wav")
    extract_audio(args.video, raw_wav)
    dur = probe_duration(raw_wav)

    sils = detect_silences(raw_wav, noise_db=-30.0, min_sil=args.min_silence)
    silent_total = sum(e - s for s, e in sils)
    ratio = silent_total / dur if dur > 0 else 0.0
    print(f"[prep_speech_only] silence ratio {ratio:.2f} ({silent_total:.0f}s of {dur:.0f}s, "
          f"stretches >= {args.min_silence}s)", file=sys.stderr)
    if ratio < args.ratio_threshold:
        print("[prep_speech_only] under threshold — transcribe the original directly, "
              "no splice needed", file=sys.stderr)
        Path(raw_wav).unlink(missing_ok=True)
        return 2

    spans = plan_speech_spans(raw_wav, dur, args.min_silence, args.pad)
    splice_tmp = tmp_dir / f"_prep_splice_{Path(args.video).stem}"
    splice_tmp.mkdir(exist_ok=True)
    splice_audio(raw_wav, spans, args.out_audio, splice_tmp)

    # map: parallel to spans, spliced-timeline offset for each original span
    acc, map_entries = 0.0, []
    for s, e in spans:
        map_entries.append({"orig_start": round(s, 3), "orig_end": round(e, 3),
                            "splice_start": round(acc, 3)})
        acc += e - s
    Path(args.out_map).write_text(json.dumps({"spans": map_entries}, ensure_ascii=False, indent=2))

    for f in splice_tmp.glob("*"):
        f.unlink(missing_ok=True)
    splice_tmp.rmdir()
    Path(raw_wav).unlink(missing_ok=True)

    spliced_dur = sum(e - s for s, e in spans)
    print(f"[prep_speech_only] spliced {len(spans)} span(s), {spliced_dur:.0f}s "
          f"(was {dur:.0f}s) -> {args.out_audio}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
