import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../stylekit";

/**
 * TimeSpeed — «за 5 минут вместо 3 часов» (critic, 2026-07-23): the value-prop
 * form of the niche. A long time-bar COMPRESSES to a short one, a clock ring
 * fills, the number ticks down. Reads instantly muted.
 *
 * Plan act {type:"timeSpeed", props:{fromLabel, toLabel}}.
 */
type Props = { fromLabel?: string; toLabel?: string; delaySec?: number };

const W = 720;
const H = 520;

export const TimeSpeed: React.FC<Props> = ({
  fromLabel = "3 часа",
  toLabel = "5 минут",
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  // Bar compresses from full to ~18% over ~1s after a beat.
  const t = interpolate(frame, [start + fps * 0.5, start + fps * 1.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const barX = 60;
  const barY = 300;
  const fullW = W - 120;
  const w = interpolate(t, [0, 1], [fullW, fullW * 0.18]);

  // Clock ring fills with the same easing (progress ring via dashoffset).
  const R = 90;
  const cxc = W / 2;
  const cyc = 150;
  const circ = 2 * Math.PI * R;
  const fillP = interpolate(t, [0, 1], [1, 0.18]);
  const enter = spring({ frame: Math.max(0, frame - start), fps, config: style.animation.spring.gentle });

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      {/* clock ring */}
      <g opacity={enter} transform={`rotate(-90 ${cxc} ${cyc})`}>
        <circle cx={cxc} cy={cyc} r={R} fill="none" stroke={style.colors.cardBorder} strokeWidth={12} />
        <circle
          cx={cxc}
          cy={cyc}
          r={R}
          fill="none"
          stroke={style.colors.accent}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - fillP)}
        />
      </g>
      {/* from → to labels */}
      <text x={barX} y={barY - 30} fontFamily={style.fonts.mono} fontSize={30} fill={style.colors.textSecondary} opacity={interpolate(t, [0, 0.5], [1, 0.4])}>
        {fromLabel}
      </text>
      {/* the compressing bar */}
      <rect x={barX} y={barY} width={fullW} height={26} rx={13} fill={style.colors.cardBg} stroke={style.colors.cardBorder} />
      <rect x={barX} y={barY} width={w} height={26} rx={13} fill={style.colors.accent} />
      {/* speed lines trailing the bar's new end */}
      {t > 0.4 &&
        [0, 1, 2].map((i) => (
          <line
            key={i}
            x1={barX + w + 16 + i * 22}
            y1={barY + 4 + i * 7}
            x2={barX + w + 52 + i * 22}
            y2={barY + 4 + i * 7}
            stroke={style.colors.accent}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.5 - i * 0.12}
          />
        ))}
      {/* to label (the payoff) */}
      <text x={barX} y={barY + 90} fontFamily={style.fonts.heading} fontWeight={900} fontSize={54} fill={style.colors.accent} opacity={t}>
        {toLabel}
      </text>
    </svg>
  );
};
