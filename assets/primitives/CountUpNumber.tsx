import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../../stylekit";
import { SAFE_W } from "./safe";

/**
 * CountUpNumber — a big number that TICKS UP from 0 to `number` (Andrey/critic,
 * 2026-07-23). For «дважды / 30 тем / в N раз / 48 партий». The count motion
 * reads with sound off.
 *
 * Plan act {type:"countUp", props:{number, label?, sub?}}.
 */
type Props = { number?: number; label?: string; sub?: string; delaySec?: number };

export const CountUpNumber: React.FC<Props> = ({
  number = 30,
  label = "тем параллельно",
  sub,
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const rel = Math.max(0, frame - start);

  const enter = spring({ frame: rel, fps, config: style.animation.spring.enter });
  const t = interpolate(rel, [0, Math.round(1 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shown = Math.round(number * t);

  return (
    <div style={{ textAlign: "center", maxWidth: SAFE_W, opacity: enter, transform: `scale(${0.8 + enter * 0.2})` }}>
      {label && (
        <div style={{ fontFamily: style.fonts.mono, fontSize: 34, letterSpacing: 1, color: style.colors.textSecondary, marginBottom: 8, overflowWrap: "anywhere", lineHeight: 1.15 }}>
          {label}
        </div>
      )}
      <div style={{ fontFamily: style.fonts.heading, fontWeight: 900, fontSize: 220, lineHeight: 1, color: style.colors.accent, letterSpacing: -4 }}>
        {shown}
      </div>
      {sub && (
        <div style={{ fontFamily: style.fonts.body, fontSize: 40, color: style.colors.textSecondary, marginTop: 12, overflowWrap: "anywhere", lineHeight: 1.15 }}>
          {sub}
        </div>
      )}
    </div>
  );
};
