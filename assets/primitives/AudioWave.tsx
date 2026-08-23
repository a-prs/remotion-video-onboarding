import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import {
  useWindowedAudioData,
  visualizeAudioWaveform,
  createSmoothSvgPath,
} from "@remotion/media-utils";
import { style } from "../stylekit";
import { SAFE_W } from "./safe";

/**
 * AudioWave — an oscilloscope-style smooth waveform reacting to the audio (bank
 * v2, 2026-07-27). The calmer sibling of AudioSpectrum: a single flowing teal
 * line for the faceless "podcast" path. Reads the frame directly and centres the
 * data window on it (see the Remotion audio-visualization rule — never nest in a
 * frame-remapping <Sequence>).
 *
 * Plan act {type:"audioWave", props:{ src, label?, color? }}.
 * `src` is injected from the plan's footageSrc by the engine when omitted.
 */
type Props = {
  src?: string;
  label?: string;
  color?: string;
  delaySec?: number;
};

const W = SAFE_W;
const H = 240;
const SAMPLES = 256;

export const AudioWave: React.FC<Props> = ({ src, label, color, delaySec = 0 }) => {
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

  const waveform = visualizeAudioWaveform({
    fps,
    frame,
    audioData,
    numberOfSamples: 128,
    windowInSeconds: 0.12,
    channel: 0,
    dataOffsetInSeconds,
  });

  // Amplify: raw waveform values are small; a gain makes the oscilloscope read.
  const GAIN = 4.5;
  const p = createSmoothSvgPath({
    points: waveform.map((y, i) => ({
      x: (i / (waveform.length - 1)) * W,
      y: H / 2 + Math.max(-H / 2, Math.min(H / 2, y * (H / 2) * GAIN)),
    })),
  });

  const accent = color ?? style.colors.accent;

  return (
    <div
      style={{
        width: W,
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
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        {/* faint centre line */}
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <path d={p} stroke={accent} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};
