import { useCurrentFrame, useVideoConfig, interpolate, HtmlInCanvas } from "remotion";
import { glow } from "@remotion/effects/glow";
import { style } from "../stylekit";
import { SAFE_W } from "./safe";

/**
 * FxGlowText — REFERENCE implementation of the "wow" layer (bank v2, 2026-07-27,
 * item #4). Renders a headline through <HtmlInCanvas> so a WebGL2 glow effect can
 * bloom around the accent word. This is the pattern for the whole @remotion/effects
 * family (dropShadow, chromaticAberration, scanlines, tvSignalOff, …).
 *
 * ⚠️ GATED: WebGL2 effects only render when the render service enables ANGLE:
 *     import {Config} from '@remotion/cli/config';
 *     Config.setChromiumOpenGlRenderer('angle');
 * Until that is set in the boot render (Andrey's sudo), this primitive is NOT
 * wired into VerticalFromPlan — it stays a standalone reference to avoid a bundle
 * failure in prod. Test via PreviewPrim once WebGL is on.
 *
 * Plan act (future) {type:"glowText", props:{ text, accentWord?, color? }}.
 */
type Props = {
  text?: string;
  accentWord?: string;
  color?: string;
  delaySec?: number;
};

export const FxGlowText: React.FC<Props> = ({
  text = "Это меняет всё",
  accentWord,
  color,
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const f = Math.max(0, frame - start);
  const enter = interpolate(f, [0, Math.round(0.5 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Glow pulses in, then settles — a breathing bloom, not a flat halo.
  const bloom = interpolate(
    f,
    [0, Math.round(0.6 * fps), Math.round(1.4 * fps)],
    [0, 1, 0.55],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const accent = color ?? style.colors.accent;

  const words = accentWord ? text.split(accentWord) : [text];

  return (
    <HtmlInCanvas
      width={SAFE_W}
      height={400}
      style={{ width: SAFE_W, height: 400 }}
      effects={[glow({ opacity: bloom, color: accent })]}
    >
      <div
        style={{
          width: SAFE_W,
          height: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          opacity: enter,
        }}
      >
        <span
          style={{
            fontFamily: style.fonts.heading,
            fontWeight: 900,
            fontSize: 88,
            color: style.colors.textPrimary,
            lineHeight: 1.05,
          }}
        >
          {accentWord ? (
            <>
              {words[0]}
              <span style={{ color: accent }}>{accentWord}</span>
              {words[1] ?? ""}
            </>
          ) : (
            text
          )}
        </span>
      </div>
    </HtmlInCanvas>
  );
};
