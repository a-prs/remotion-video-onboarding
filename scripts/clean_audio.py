#!/usr/bin/env python3
"""Audio diagnose + repair for a talking-head clip.

    clean_audio.py <video> [--lufs -14] [--like <ref>] [--no-denoise] [--render <out>]

Measures noise floor, clipping, loudness (EBU R128) first. Without --render it
only prints the diagnosis — repairs only what is actually broken (denoising a
clean take just eats the air out of the voice). With --render <out> it writes
the repaired file.

No neural denoiser on purpose: the models good enough to be worth using
(DeepFilterNet-class) are GPL-3.0 and pull in torch or a separate compiled
runtime — heavier and more license-fraught than this skill should default to
for a stranger's machine. Two-pass loudness on purpose too: a single loudnorm
pass is dynamic (acts like a compressor) and pulls up the noise floor along
with quiet speech; static gain + limiter (computed here) leaves the floor
where it was.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from scipy.io import wavfile

BANDS = [(60, 120), (120, 250), (250, 500), (500, 1000), (1000, 2000),
         (2000, 4000), (4000, 6000), (6000, 8000), (8000, 12000),
         (12000, 16000)]
MAX_EQ = 6.0        # больше не двигаем: это уже не подгонка, а искажение
CLIP_LEVEL = 0.985


def run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"command failed: {' '.join(cmd)}\n{r.stderr[-800:]}", file=sys.stderr)
        sys.exit(1)


def has_video(src: Path) -> bool:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v",
                        "-show_entries", "stream=index", "-of", "csv=p=0", str(src)],
                       capture_output=True, text=True)
    return bool(r.stdout.strip())


def to_wav(src: Path, dst: Path, rate: int = 48000) -> None:
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src),
         "-vn", "-ac", "1", "-ar", str(rate), str(dst)])


def load(path: Path):
    sr, data = wavfile.read(str(path))
    if data.ndim > 1:
        data = data.mean(axis=1)
    if np.issubdtype(data.dtype, np.integer):
        data = data.astype(np.float64) / float(np.iinfo(data.dtype).max)
    return data.astype(np.float64), sr


def band_levels(data: np.ndarray, sr: int) -> dict:
    """Форма спектра по полосам, в дБ относительно общего RMS (не после
    loudnorm/компрессора — те подтягивают тихие места и врут по форме)."""
    from scipy.signal import welch
    freqs, power = welch(data, sr, nperseg=min(8192, len(data)))
    total = np.sqrt(np.mean(data ** 2)) + 1e-12
    out = {}
    for lo, hi in BANDS:
        sel = (freqs >= lo) & (freqs < hi)
        if not sel.any():
            continue
        energy = np.trapezoid(power[sel], freqs[sel]) if hasattr(np, "trapezoid") \
            else np.trapz(power[sel], freqs[sel])
        out[(lo, hi)] = 10 * np.log10(energy / total ** 2 + 1e-20)
    return out


def measure(path: Path) -> dict:
    data, sr = load(path)
    win = int(sr * 0.02)
    frames = len(data) // win
    rms = np.sqrt((data[:frames * win].reshape(frames, win) ** 2).mean(axis=1) + 1e-12)
    level = 20 * np.log10(rms)
    return {
        "sr": sr,
        "floor": float(np.percentile(level, 10)),
        "speech": float(np.percentile(level, 90)),
        "peak": float(20 * np.log10(np.abs(data).max() + 1e-12)),
        "clipped": float((np.abs(data) > CLIP_LEVEL).mean()),
        "bands": band_levels(data, sr),
    }


def loudness(path: Path) -> dict:
    res = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af",
         "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace")
    text = res.stderr or ""
    start, end = text.rfind("{"), text.rfind("}")
    if start == -1 or end == -1:
        return {}
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return {}


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2

    src = Path(args[0]).expanduser().resolve()
    if not src.exists():
        print(f"нет файла: {src}")
        return 2

    def val(name: str, default: str | None) -> str | None:
        if name not in args:
            return default
        i = args.index(name)
        if i + 1 >= len(args):
            print(f"{name} требует значение")
            sys.exit(2)
        return args[i + 1]

    target_lufs = float(val("--lufs", -14))
    like = val("--like", None)
    render_to = val("--render", None)

    tmp = Path(tempfile.mkdtemp(prefix="clean-audio-"))
    try:
        probe = tmp / "probe.wav"
        to_wav(src, probe)
        m = measure(probe)
        snr = m["speech"] - m["floor"]
        lg = loudness(src)  # на исходнике, не моно-копии — моно занижает LUFS ~3dB

        print(f"файл: {src.name}\n")
        print(f"речь        {m['speech']:6.1f} дБ")
        print(f"шум         {m['floor']:6.1f} дБ")
        print(f"запас       {snr:6.1f} дБ", end="  ")
        print("— тихий шум" if snr > 40 else "— шум слышно" if snr > 25 else "— ШУМА МНОГО")
        print(f"пик         {m['peak']:6.1f} дБ")
        if m["clipped"] > 0:
            print(f"клиппинг    {m['clipped'] * 100:6.3f}% отсчётов срезано")
        if lg:
            print(f"громкость   {float(lg.get('input_i', 0)):6.1f} LUFS (цель {target_lufs})")

        chain, notes = ["highpass=f=70"], ["срез гула ниже 70 Гц"]

        if m["clipped"] > 0.0001:
            chain.append("adeclip")
            notes.append("восстановление срезанных пиков")

        if "--no-denoise" not in args:
            if snr < 45:
                nf = int(round(min(max(m["floor"], -80), -20)))
                nr = 12 if snr > 30 else 20
                chain.append(f"afftdn=nr={nr}:nf={nf}:tn=1")
                notes.append(f"подавление шума на {nr} дБ (порог {nf} дБ)")
            else:
                notes.append("шум не трогаем — его и так почти нет")

        ref = None
        if like:
            ref_path = Path(like).expanduser().resolve()
            if not ref_path.exists():
                print(f"\nнет эталона: {ref_path}")
                return 2
            ref_wav = tmp / "ref.wav"
            to_wav(ref_path, ref_wav)
            ref = measure(ref_wav)
            print(f"\nподгоняю тембр под {ref_path.name}:")
            biggest = 0.0
            for band in BANDS:
                if band not in m["bands"] or band not in ref["bands"]:
                    continue
                diff = ref["bands"][band] - m["bands"][band]
                biggest = max(biggest, abs(diff))
                if abs(diff) < 1.0:
                    continue
                gain = max(-MAX_EQ, min(MAX_EQ, diff))
                lo, hi = band
                centre, width = int((lo * hi) ** 0.5), hi - lo
                chain.append(f"equalizer=f={centre}:t=h:w={width}:g={gain:.1f}")
                print(f"  {lo}-{hi} Гц: {gain:+.1f} дБ")
            notes.append("подгонка тембра под эталон")
            if biggest > 4:
                print(f"\n  Правка крупная (до {biggest:.1f} дБ) — записи сильно разные.")

        notes.append(f"громкость к {target_lufs} LUFS")

        print("\nчто делаем:")
        for n in notes:
            print(f"  - {n}")

        if not render_to:
            print("\nфайл не трогал. Устраивает — запусти ещё раз с --render <out>")
            return 0

        dst = Path(render_to).expanduser().resolve()
        dst.parent.mkdir(parents=True, exist_ok=True)

        print("\nчиню звук...", flush=True)
        repaired = tmp / "repaired.wav"
        run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vn",
             "-af", ",".join(chain), "-ar", "48000", "-c:a", "pcm_s24le", str(repaired)])

        mr = measure(repaired)
        lr = loudness(repaired)
        print("меряю громкость и выравниваю...", flush=True)

        # Статическое усиление + лимитер, подобранные итеративно (лимитер сам
        # съедает часть прибавки — "цель минус замер" промахивается с первого раза).
        gain = target_lufs - float(lr["input_i"]) if lr else 0.0
        if gain > 6:
            print(f"  внимание: не хватает {gain:.1f} дБ, лимитеру придётся много "
                  f"срезать — звук может стать плоским")
        probe_gain = tmp / "gain.wav"
        for _ in range(3):
            run(["ffmpeg", "-y", "-v", "error", "-i", str(repaired), "-af",
                 f"volume={gain:.2f}dB,alimiter=limit=-1.5dB:level=false",
                 "-c:a", "pcm_s24le", str(probe_gain)])
            got = loudness(probe_gain)
            if not got:
                break
            err = target_lufs - float(got["input_i"])
            if abs(err) < 0.3:
                break
            gain += err
        norm = f"volume={gain:.2f}dB,alimiter=limit=-1.5dB:level=false"

        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-i", str(repaired),
               "-map", "1:a:0", "-af", norm]
        if has_video(src):
            cmd += ["-map", "0:v:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k"]
        else:
            cmd += ["-c:a", "pcm_s16le"]
        cmd.append(str(dst))
        run(cmd)

        after = tmp / "after.wav"
        to_wav(dst, after)
        ma = measure(after)
        la = loudness(dst)
        print(f"готово: {dst}\n")
        print("было -> стало:")
        print(f"  шум       {m['floor']:6.1f} -> {ma['floor']:6.1f} дБ")
        print(f"  запас     {snr:6.1f} -> {ma['speech'] - ma['floor']:6.1f} дБ")
        if lg and la:
            print(f"  громкость {float(lg.get('input_i', 0)):6.1f} -> "
                  f"{float(la.get('input_i', 0)):6.1f} LUFS")
        if ref:
            before_gap = max(abs(ref["bands"][b] - m["bands"][b])
                             for b in BANDS if b in m["bands"] and b in ref["bands"])
            after_gap = max(abs(ref["bands"][b] - ma["bands"][b])
                            for b in BANDS if b in ma["bands"] and b in ref["bands"])
            print(f"  тембр     расхождение с эталоном {before_gap:.1f} -> {after_gap:.1f} дБ")

        cost = (mr["speech"] - mr["floor"]) - (ma["speech"] - ma["floor"])
        if cost > 2:
            print(f"\n  Запас съеден на {cost:.1f} дБ при подтягивании громкости — "
                  f"материал горячий. Если на слух плоско: --lufs {target_lufs - 2:.0f}")
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
