#!/usr/bin/env python3
"""Optional Whisper transcription via Groq's hosted API — alternative to the
local whisper.cpp path in SKILL.md Шаг 6 п.1. Groq runs whisper-large-v3 on
their own hardware: much faster than a local CPU run, and noticeably better
on Russian than the local `medium` model this skill defaults to. Trade-off:
needs a $GROQ_API_KEY, sends the project's audio to Groq's cloud, and costs
API credits (not free like the local model) — opt-in only, never the silent
default (see `transcription-engine:` flag in assets/stylekit.ts).

No extra Python deps: does the multipart upload by hand with stdlib
urllib.request, so a public skill install doesn't need `pip install requests`
on top of the numpy/scipy already required for cut_silence.py/clean_audio.py.

Output is the same {"words": [{word,start,end,confidence}]} shape that
cut_silence.py / find_repeat_candidates.py already read — drop-in replacement
for the local whisper.cpp words.json.

Long files are split into chunks (Groq caps upload size around 25MB) at real
silence boundaries near the target chunk length — reuses cut_silence.py's
detect_silences()/probe_duration() so a chunk edge never lands mid-word. Each
chunk's word timestamps are offset back onto the full-file timeline before
merging.

Usage:
    transcribe_groq.py <video_or_audio> <out_words.json> --language ru
                       [--model whisper-large-v3] [--chunk-minutes 12]

Reads the key from $GROQ_API_KEY. Never pass it as a CLI argument — it would
land in shell history and `ps` output. Never print the key value.
"""
import argparse
import io
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from cut_silence import detect_silences, probe_duration  # noqa: E402 — reuse, no dupe logic

GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
DEFAULT_MODEL = "whisper-large-v3"
AUDIO_BITRATE_KBPS = 64  # mono, plenty for ASR, keeps chunk files small


def extract_audio(src: str, out_mp3: str) -> None:
    cmd = ["ffmpeg", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000",
           "-b:a", f"{AUDIO_BITRATE_KBPS}k", out_mp3, "-loglevel", "error"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"ffmpeg audio extract failed: {r.stderr[-400:]}", file=sys.stderr)
        sys.exit(1)


def cut_chunk(audio_path: str, s: float, e: float, out_path: str) -> None:
    cmd = ["ffmpeg", "-y", "-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-i", audio_path,
           "-ac", "1", "-ar", "16000", "-b:a", f"{AUDIO_BITRATE_KBPS}k",
           out_path, "-loglevel", "error"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not Path(out_path).exists():
        print(f"ffmpeg chunk cut failed: {r.stderr[-400:]}", file=sys.stderr)
        sys.exit(1)


def plan_chunks(audio_path: str, target_minutes: float) -> list:
    """[[start,end], ...] chunk boundaries. Snapped to the midpoint of a real
    detected silence near each target cut point (within 20s) so a chunk edge
    doesn't split a word — falls back to a hard cut at the target if no
    silence is nearby."""
    dur = probe_duration(audio_path)
    target = target_minutes * 60
    if dur <= target * 1.15:  # small enough for one shot, don't bother chunking
        return [[0.0, dur]]
    sils = detect_silences(audio_path, noise_db=-30.0, min_sil=0.2)
    bounds, cursor = [0.0], target
    while cursor < dur:
        best = min(sils, key=lambda s: abs((s[0] + s[1]) / 2 - cursor), default=None)
        mid = (best[0] + best[1]) / 2 if best else None
        cut = mid if (mid is not None and abs(mid - cursor) < 20) else cursor
        if cut > bounds[-1] + 5:  # avoid a degenerate near-zero-length chunk
            bounds.append(cut)
        cursor = bounds[-1] + target
    bounds.append(dur)
    return [[bounds[i], bounds[i + 1]] for i in range(len(bounds) - 1)]


DEDUP_WINDOW_S = 0.20  # real repeated speech on our material sat 0.28s+ apart —
                       # Groq's own doubled-word artifact sits 7-87ms apart, so
                       # this window separates the two cleanly without eating
                       # a genuine stutter/repeat.


def dedup_words(all_words: list) -> list:
    """Groq occasionally emits the same word twice in a row with a tiny start
    offset (7-87ms seen live, e.g. "при при одном одном и и том том же же") —
    an artifact of its own decoding, not real repeated speech. Found live
    2026-08-29 (9 doubled words in one chunk, visible in the raw response
    JSON). Collapse a same-normalized-text word that starts within
    DEDUP_WINDOW_S of the previous one; keep the first occurrence (its start
    is the true onset)."""
    out = []
    for w in all_words:
        if out:
            prev = out[-1]
            norm_prev = prev["word"].strip().lower()
            norm_cur = w["word"].strip().lower()
            if norm_prev == norm_cur and norm_cur and (w["start"] - prev["start"]) <= DEDUP_WINDOW_S:
                continue
        out.append(w)
    return out


def call_groq(chunk_path: str, api_key: str, model: str, language: str) -> dict:
    boundary = uuid.uuid4().hex
    body = io.BytesIO()

    def field(name: str, value: str) -> None:
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.write(f"{value}\r\n".encode())

    field("model", model)
    if language:
        field("language", language)
    field("response_format", "verbose_json")
    field("timestamp_granularities[]", "word")

    filename = Path(chunk_path).name
    body.write(f"--{boundary}\r\n".encode())
    body.write(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode())
    body.write(b"Content-Type: audio/mpeg\r\n\r\n")
    body.write(Path(chunk_path).read_bytes())
    body.write(b"\r\n")
    body.write(f"--{boundary}--\r\n".encode())

    # Cloudflare sits in front of api.groq.com and blocks requests with no
    # User-Agent (urllib's default identifies itself as "Python-urllib/x.y",
    # which gets a bare 403/1010 before the request ever reaches Groq — the
    # API key is never even checked). Found live 2026-08-29: a confirmed-valid
    # key (verified via curl to /v1/models, HTTP 200) still got 403 through
    # this script. A real User-Agent is all Cloudflare needs to pass it through.
    req = urllib.request.Request(
        GROQ_URL, data=body.getvalue(), method="POST",
        headers={"Authorization": f"Bearer {api_key}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "User-Agent": "remotion-video-onboarding-skill/1.0 (+https://github.com/a-prs/remotion-video-onboarding)",
                "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:500]
        if e.code == 401:
            print("Groq API key отклонён (401) — проверь $GROQ_API_KEY.", file=sys.stderr)
        elif e.code == 403:
            # NOT a key problem (a 401 covers that) — this is Cloudflare/WAF
            # rejecting the request before Groq sees it (missing/blocked
            # User-Agent, geo-block, or a transient edge rule). Telling the
            # user to re-check their key here wastes their time on a red herring.
            print("Groq API вернул 403 — это НЕ проблема ключа (ту ловит 401). Похоже на "
                  "блокировку на уровне Cloudflare перед Groq (например, отсутствующий/"
                  "заблокированный User-Agent). Проверь ключ отдельно curl'ом к "
                  "https://api.groq.com/openai/v1/models — если там 200, ключ рабочий, "
                  "дело не в нём.", file=sys.stderr)
        elif e.code == 413:
            print("Чанк всё ещё слишком большой для Groq (413) — уменьши --chunk-minutes.",
                  file=sys.stderr)
        else:
            print(f"Groq API error {e.code}: {detail}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Не достучались до Groq API: {e.reason}", file=sys.stderr)
        sys.exit(1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("out_words")
    ap.add_argument("--language", default="", help="ISO код (ru, en, ...) — пусто = автоопределение")
    ap.add_argument("--model", default=DEFAULT_MODEL,
                    help="whisper-large-v3 (точнее) или whisper-large-v3-turbo (быстрее/дешевле)")
    ap.add_argument("--chunk-minutes", type=float, default=12.0,
                    help="целевая длина чанка перед разбиением длинного файла "
                         "(у Groq есть потолок на размер одного файла)")
    ap.add_argument("--api-key-env", default="GROQ_API_KEY")
    args = ap.parse_args()

    api_key = os.environ.get(args.api_key_env, "").strip()
    if not api_key:
        print(f"{args.api_key_env} не задан в окружении — Groq-транскрипция недоступна без ключа.",
              file=sys.stderr)
        return 1

    tmp_dir = Path(args.out_words).parent / f"_groq_tmp_{uuid.uuid4().hex[:8]}"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    try:
        full_audio = str(tmp_dir / "full.mp3")
        extract_audio(args.input, full_audio)
        chunks = plan_chunks(full_audio, args.chunk_minutes)
        print(f"[transcribe_groq] {len(chunks)} chunk(s), model={args.model}", file=sys.stderr)

        all_words = []
        for i, (s, e) in enumerate(chunks):
            if len(chunks) == 1:
                chunk_path = full_audio
            else:
                chunk_path = str(tmp_dir / f"chunk_{i:03d}.mp3")
                cut_chunk(full_audio, s, e, chunk_path)
            size_mb = Path(chunk_path).stat().st_size / 1024 / 1024
            print(f"[transcribe_groq] chunk {i + 1}/{len(chunks)} "
                  f"({e - s:.0f}s, {size_mb:.1f}MB) -> Groq...", file=sys.stderr)
            result = call_groq(chunk_path, api_key, args.model, args.language)
            chunk_words = result.get("words", [])
            if not chunk_words:
                print(f"[transcribe_groq] chunk {i + 1}: пустой список слов в ответе — "
                      f"проверь, что модель/response_format реально вернули word-level "
                      f"таймкоды (сырой ответ: {json.dumps(result, ensure_ascii=False)[:300]})",
                      file=sys.stderr)
            for w in chunk_words:
                all_words.append({
                    "word": w.get("word", ""),
                    "start": round(float(w["start"]) + s, 3),
                    "end": round(float(w["end"]) + s, 3),
                    "confidence": None,
                })
        all_words.sort(key=lambda w: w["start"])
        all_words = dedup_words(all_words)
        # Windows-hosted runs write this with the platform default encoding
        # (cp1251 on a RU-locale Windows box) unless told otherwise, and Node's
        # JSON.parse on the consumer side then throws UnicodeDecodeError on the
        # first non-ASCII byte (0xd1 etc.) — found live 2026-08-29. Force utf-8
        # explicitly; don't rely on the platform default.
        Path(args.out_words).write_text(
            json.dumps({"words": all_words}, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[transcribe_groq] wrote {args.out_words} ({len(all_words)} words)",
              file=sys.stderr)
    finally:
        for f in tmp_dir.glob("*"):
            f.unlink(missing_ok=True)
        tmp_dir.rmdir()
    return 0


if __name__ == "__main__":
    sys.exit(main())
