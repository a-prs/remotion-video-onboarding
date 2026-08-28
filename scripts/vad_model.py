#!/usr/bin/env python3
"""Silero VAD (v6, via the ONNX export bundled with faster-whisper) — a thin
onnxruntime wrapper, deliberately NOT depending on faster-whisper itself
(which pulls in ctranslate2 for Whisper inference — ~115MB, none of it
needed just for VAD) or the `silero-vad` PyPI package (which has torch/
torchaudio as hard dependencies). See assets/vad/NOTICE for full attribution
— MIT licensed, faster-whisper (SYSTRAN) + Silero VAD (Silero Team).

Model: assets/vad/silero_vad_v6.onnx. This is NOT the same file as the
"official" snakers4/silero-vad release ONNX export — different interface
(this one is batched: input[seq_len,576] + h[1,1,128] + c[1,1,128] -> probs/
hn/cn; upstream's own export is streaming: input/state/sr) and a different
hash. Do not swap the vendored file for the upstream one without rewriting
this wrapper to match its interface.

Ported from faster_whisper/vad.py's SileroVADModel (MIT), with two fixes
found while integrating it here:
  - the audio array is copied before scoring. Upstream's __call__ mutates
    the last `context_size_samples` of the INPUT array in place (it takes a
    reshape/slice view, not a copy) — silently corrupts the caller's buffer
    otherwise, which matters here because scripts/vad.py computes an energy
    curve from the same raw samples.
  - the model file's sha256 is verified at load time, so a corrupted or
    swapped-out vendored file fails loudly instead of producing silently
    wrong VAD output — a version pin that's only printed in the output,
    never checked, isn't actually a pin.
"""
import hashlib
import os

import numpy as np

MODEL_SHA256 = "4cbf549b8326f60f80f2536d9eefeb450a9abe83365a098031c89719f1be17d2"
NUM_SAMPLES = 512          # window size the model expects, in samples (32ms @ 16kHz)
CONTEXT_SAMPLES = 64       # look-back context the model prepends per window


def default_model_path() -> str:
    return os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "..", "assets", "vad", "silero_vad_v6.onnx")


def verify_model(path: str) -> None:
    """Raises RuntimeError if the file at `path` doesn't match the pinned
    hash — catches both corruption and an accidental swap for a different
    (interface-incompatible) Silero VAD export."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    got = h.hexdigest()
    if got != MODEL_SHA256:
        raise RuntimeError(
            f"VAD model hash mismatch at {path}: expected {MODEL_SHA256}, got {got}. "
            "assets/vad/silero_vad_v6.onnx is corrupted or was replaced with a "
            "different file (e.g. the upstream snakers4/silero-vad export, which has "
            "a different interface and will not work with this wrapper) — re-fetch "
            "the file from the skill repository, don't hand-patch it."
        )


class SileroVAD:
    """Loads assets/vad/silero_vad_v6.onnx and scores fixed 512-sample
    (32ms @ 16kHz) windows. Raises ImportError if onnxruntime isn't
    installed; RuntimeError if the model file is missing or its hash
    doesn't match."""

    def __init__(self, model_path: str = None):
        import onnxruntime  # local import — this is the optional dependency

        self.path = model_path or default_model_path()
        if not os.path.exists(self.path):
            raise RuntimeError(f"VAD model not found at {self.path}")
        verify_model(self.path)

        opts = onnxruntime.SessionOptions()
        opts.inter_op_num_threads = 1
        opts.intra_op_num_threads = 1
        opts.enable_cpu_mem_arena = False
        opts.log_severity_level = 4
        self.session = onnxruntime.InferenceSession(
            self.path, providers=["CPUExecutionProvider"], sess_options=opts)

    def score(self, audio: np.ndarray) -> np.ndarray:
        """audio: 1D array (any float dtype), values roughly in [-1, 1], any
        length. Returns one speech-probability float32 per 512-sample
        (32ms) window, zero-padding the tail to a multiple of 512 first."""
        assert audio.ndim == 1, "expected a 1D mono audio array"
        audio = audio.astype(np.float32, copy=True)  # never mutate the caller's buffer
        pad = (-len(audio)) % NUM_SAMPLES
        if pad:
            audio = np.concatenate([audio, np.zeros(pad, dtype=np.float32)])
        if len(audio) == 0:
            return np.zeros(0, dtype=np.float32)

        h = np.zeros((1, 1, 128), dtype="float32")
        c = np.zeros((1, 1, 128), dtype="float32")

        batched = audio.reshape(-1, NUM_SAMPLES)
        context = batched[..., -CONTEXT_SAMPLES:].copy()  # defensive copy, see module docstring
        context[-1] = 0
        context = np.roll(context, 1, 0)
        batched = np.concatenate([context, batched], axis=1)

        outputs = []
        batch_size = 10000
        for i in range(0, batched.shape[0], batch_size):
            out, h, c = self.session.run(
                None, {"input": batched[i:i + batch_size], "h": h, "c": c})
            outputs.append(out)
        return np.concatenate(outputs, axis=0).reshape(-1).astype(np.float32)


def speech_regions(probs: np.ndarray, hop: float, threshold: float = 0.5,
                   neg_threshold: float = 0.35, min_silence_s: float = 0.08,
                   min_speech_s: float = 0.0, pad_s: float = 0.0) -> list:
    """Silero's streaming speech/silence segmentation, ported from
    faster_whisper.vad.get_speech_timestamps and simplified for this
    project's config (no max-speech-duration splitting — we never hit it at
    speech_pad_ms=0 with no cap). Operates on a probability array instead of
    raw audio so callers only run inference once and reuse it for both the
    coarse ("fine") and fine ("support") maps."""
    n = len(probs)
    min_silence_win = min_silence_s / hop
    min_speech_win = min_speech_s / hop
    triggered = False
    start = 0
    temp_end = 0
    regions = []
    for i, p in enumerate(probs):
        if p >= threshold and temp_end:
            temp_end = 0
        if p >= threshold and not triggered:
            triggered = True
            start = i
            continue
        if p < neg_threshold and triggered:
            if not temp_end:
                temp_end = i
            if i - temp_end < min_silence_win:
                continue
            end = temp_end
            if end - start > min_speech_win:
                regions.append([start, end])
            triggered = False
            temp_end = 0
    if triggered and n - start > min_speech_win:
        regions.append([start, n])

    pad_win = pad_s / hop
    out = []
    for s, e in regions:
        s2 = max(0, s - pad_win)
        e2 = min(n, e + pad_win)
        out.append([round(s2 * hop, 3), round(e2 * hop, 3)])
    return out


def mask_to_regions(mask: np.ndarray, hop: float) -> list:
    """Contiguous True-runs of a boolean mask -> [[start,end],...] seconds.
    No duration/hysteresis filtering — this is the low-bar "support" map,
    deliberately more permissive than speech_regions()'s "fine" map."""
    regions, start = [], None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            regions.append([round(start * hop, 3), round(i * hop, 3)])
            start = None
    if start is not None:
        regions.append([round(start * hop, 3), round(len(mask) * hop, 3)])
    return regions
