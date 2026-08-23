import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { useWindowedAudioData, visualizeAudio } from "@remotion/media-utils";
import { style } from "../stylekit";
import { SAFE_W } from "./safe";

/**
 * AudioSpectrum — frequency bars that pulse to the voice/music (bank v2,
 * 2026-07-27). Built for the FACELESS "podcast" path where there is no talking
 * head: the graphics were static to the audio; now a bar row breathes with the
 * speech so the frame feels alive. Bass on the left, highs on the right.
 *
 * Plan act {type:"audioSpectrum", props:{ src, bars?, label?, mirror? }}.
 * `src` is injected from the plan's footageSrc by the engine when omitted.
 *
 * NOTE (from Remotion audio-visualization rule): the frame is read here and the
 * data window is centred on it — do NOT nest this inside an offset <Sequence>
 * that also remaps the frame, or the visualization desyncs.
 */
type Props = {
  src?: string;
  bars?: number;
  label?: string;
  color?: string;
  mirror?: boolean;
  delaySec?: number;
};

// numberOfSamples must be a power of two; we render a subset for a clean look.
const SAMPLES = 256;

export const AudioSpectrum: React.FC<Props> = ({
  src,
  bars = 48,
  label,
  color,
  mirror = true,
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const enter = interpolate(frame, [start, start + Math.round(0.4 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const { audioData, dataOffsetInSeconds } = useWindowedAudioData({
    src: src ?? "",
    frame,
    fps,
    windowInSeconds: 20,
  });

  if (!src || !audioData) return null;

  const freqs = visualizeAudio({
    fps,
    frame,
    audioData,
    numberOfSamples: SAMPLES,
    optimizeFor: "speed",
    dataOffsetInSeconds,
  });

  // Voice energy concentrates in the low/low-mid band, so spread just that band
  // across the full width — otherwise most bars sit at zero and read as a flat
  // line. Symmetric (grow from centre) for the classic audiogram look.
  const usable = freqs.slice(0, Math.floor(SAMPLES * 0.28));
  const step = usable.length / bars;
  const accent = color ?? style.colors.accent;

  const barEls = Array.from({ length: bars }, (_, i) => {
    const v = usable[Math.floor(i * step)] ?? 0;
    // Perceptual boost: speech spectra are low-magnitude, so sqrt-shape + strong
    // gain make the bars actually read on screen instead of a flat line.
    const shaped = Math.min(1, Math.sqrt(v) * 3.4);
    const h = Math.max(10, shaped * 200); // floor + gain
    // subtle teal→purple shift across the band
    const mix = i / bars;
    const c = mix < 0.6 ? accent : style.colors.primaryLight;
    return (
      <div
        key={i}
        style={{
          flex: 1,
          height: h,
          background: c,
          borderRadius: 4,
          alignSelf: mirror ? "center" : "flex-end",
        }}
      />
    );
  });

  return (
    <div
      style={{
        width: SAFE_W,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 22,
        opacity: enter,
      }}
    >
      {label && (
        <div
          style={{
            fontFamily: style.fonts.mono,
            fontSize: 24,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: style.colors.textSecondary,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          width: "100%",
          height: 200,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        {barEls}
      </div>
    </div>
  );
};
