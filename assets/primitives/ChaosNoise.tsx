import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { noise2D } from "@remotion/noise";
import { style } from "../stylekit";

/**
 * ChaosNoise — cards jitter and overlap into a «каша» via smooth Perlin noise, not
 * jerky random (critic, 2026-07-23): for «хаос / каша / путается / бардак». Best
 * paired with a resolving beat right after (connector → «развести»).
 *
 * Plan act {type:"chaos", props:{labels:[..]}}.
 */
type Props = { labels?: string[]; delaySec?: number };

const DEFAULT_LABELS = ["реклама", "клиенты", "проект", "дела", "личное"];
const W = 620;
const H = 620;

export const ChaosNoise: React.FC<Props> = ({ labels = DEFAULT_LABELS, delaySec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const t = Math.max(0, frame - start) / fps;
  // Chaos intensity ramps up in the first ~0.6s.
  const amp = interpolate(t, [0, 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ position: "relative", width: W, height: H }}>
      {labels.map((label, i) => {
        const seed = `chaos-${i}`;
        const baseX = W / 2 + (noise2D(seed + "bx", i, 0)) * 150;
        const baseY = H / 2 + (noise2D(seed + "by", i, 1)) * 150;
        const jx = noise2D(seed + "x", t * 1.3, 0) * 34 * amp;
        const jy = noise2D(seed + "y", 0, t * 1.3) * 34 * amp;
        const rot = noise2D(seed + "r", t * 0.9, 0) * 12 * amp;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: baseX - 110,
              top: baseY - 40,
              width: 220,
              padding: "18px 22px",
              borderRadius: style.radius,
              background: style.colors.bgElevated,
              border: `1px solid ${style.colors.cardBorder}`,
              transform: `translate(${jx}px, ${jy}px) rotate(${rot}deg)`,
              boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontFamily: style.fonts.mono, fontSize: 30, color: style.colors.textPrimary, textAlign: "center", overflowWrap: "anywhere" }}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
