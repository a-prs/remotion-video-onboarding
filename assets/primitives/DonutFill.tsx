import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { style } from "../../stylekit";
import { SAFE_W } from "./safe";

/**
 * DonutFill — a ring that FILLS to `value`% with the % ticking up in the centre
 * (Andrey/critic, 2026-07-23). For «доля / процент / половина / сколько из».
 *
 * Plan act {type:"donutFill", props:{value, label?}}.
 */
type Props = { value?: number; label?: string; delaySec?: number };

const SIZE = 460;
const R = 180;

export const DonutFill: React.FC<Props> = ({ value = 73, label = "переплаты", delaySec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const rel = Math.max(0, frame - start);

  const enter = spring({ frame: rel, fps, config: style.animation.spring.gentle });
  const t = interpolate(rel, [0, Math.round(1.1 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const v = Math.max(0, Math.min(100, value));
  const fill = (v / 100) * t;
  const circ = 2 * Math.PI * R;
  const cx = SIZE / 2;

  return (
    <svg width={SIZE} height={SIZE} style={{ overflow: "visible", opacity: enter }}>
      <g transform={`rotate(-90 ${cx} ${cx})`}>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke={style.colors.cardBorder} strokeWidth={26} />
        <circle
          cx={cx}
          cy={cx}
          r={R}
          fill="none"
          stroke={style.colors.accent}
          strokeWidth={26}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - fill)}
        />
      </g>
      <text x={cx} y={cx - 6} textAnchor="middle" fontFamily={style.fonts.heading} fontWeight={900} fontSize={130} fill={style.colors.textPrimary}>
        {Math.round(v * t)}
        <tspan fontSize={70} fill={style.colors.accent}>%</tspan>
      </text>
      {label && (
        <text x={cx} y={cx + 70} textAnchor="middle" fontFamily={style.fonts.mono} fontSize={Math.max(16, Math.min(34, fitText({ text: label, withinWidth: SAFE_W - 80, fontFamily: style.fonts.mono, fontWeight: 400 }).fontSize))} fill={style.colors.textSecondary}>
          {label}
        </text>
      )}
    </svg>
  );
};
