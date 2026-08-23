import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { interpolatePath } from "@remotion/paths";
import { style } from "../../stylekit";

/**
 * PathMorph — «превращается / становится / переходит из…в / эволюция» (Andrey,
 * 2026-07-23): one rounded shape FLOWS into another via interpolatePath. From/To
 * labels flank it. The transformation reads with sound off.
 *
 * Plan act {type:"pathMorph", props:{fromLabel, toLabel, ...}}.
 */
type Props = { fromLabel?: string; toLabel?: string; delaySec?: number };

const W = 700;
const H = 620;

// A closed shape from 4 cubic segments; `kf` tunes roundness (circle→square).
function blob(cx: number, cy: number, r: number, kf: number): string {
  const c = r * kf;
  return (
    `M ${cx} ${cy - r} ` +
    `C ${cx + c} ${cy - r}, ${cx + r} ${cy - c}, ${cx + r} ${cy} ` +
    `C ${cx + r} ${cy + c}, ${cx + c} ${cy + r}, ${cx} ${cy + r} ` +
    `C ${cx - c} ${cy + r}, ${cx - r} ${cy + c}, ${cx - r} ${cy} ` +
    `C ${cx - r} ${cy - c}, ${cx - c} ${cy - r}, ${cx} ${cy - r} Z`
  );
}

export const PathMorph: React.FC<Props> = ({
  fromLabel = "хаос",
  toLabel = "система",
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const cx = W / 2;
  const cy = H / 2 - 20;
  const from = blob(cx, cy, 130, 0.5523); // circle
  const to = blob(cx, cy, 130, 1.0); // rounded square

  const t = interpolate(frame, [start + fps * 0.4, start + fps * 1.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const d = interpolatePath(t, from, to);
  const enter = spring({ frame: Math.max(0, frame - start), fps, config: style.animation.spring.gentle });
  const color = `${style.colors.accent}`;

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <g opacity={enter}>
        <path d={d} fill={`${color}22`} stroke={color} strokeWidth={4} strokeLinejoin="round" />
      </g>
      <text x={cx} y={H - 70} textAnchor="middle" fontFamily={style.fonts.heading} fontWeight={900} fontSize={44} fill={style.colors.textPrimary}>
        <tspan fill={style.colors.textSecondary} opacity={interpolate(t, [0, 0.6], [1, 0.4])}>{fromLabel}</tspan>
        <tspan dx={22} fill={style.colors.textSecondary}>→</tspan>
        <tspan dx={22} fill={color} opacity={t}>{toLabel}</tspan>
      </text>
    </svg>
  );
};
