import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
import { fitText } from "@remotion/layout-utils";
import { style } from "../../stylekit";

function fitFS(text: string, w: number, base: number): number {
  const f = fitText({ text: text || "", withinWidth: w, fontFamily: style.fonts.mono, fontWeight: 500 });
  return Math.max(15, Math.min(base, f.fontSize));
}

/**
 * LineChart — animated line that DRAWS in, a point runs along it, and the colour
 * reflects direction: GREEN on a rise, RED on a fall (Andrey, 2026-07-23). The
 * fact of up/down + colour must read with sound off.
 *
 * Plan act {type:"lineChart", props:{values:[..], label?}}.
 */
type Props = { values?: number[]; label?: string; delaySec?: number };

const GREEN = style.colors.success;
const RED = style.colors.danger;
const W = 720;
const H = 520;

export const LineChart: React.FC<Props> = ({
  values = [20, 32, 28, 46, 62, 88],
  label = "просмотры",
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const padX = 70;
  const padY = 90;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => ({
    x: padX + ((W - padX * 2) * i) / (values.length - 1),
    y: H - padY - ((H - padY * 2) * (v - min)) / span,
  }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
  const total = getLength(d);

  const rising = values[values.length - 1] >= values[0];
  const color = rising ? GREEN : RED;

  const p = interpolate(frame, [start, start + Math.round(1.6 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const { strokeDasharray, strokeDashoffset } = evolvePath(p, d);
  const dot = getPointAtLength(d, total * p);

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      {/* baseline */}
      <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke={style.colors.cardBorder} strokeWidth={2} />
      {/* the line */}
      <path d={d} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
      {/* running dot */}
      <circle cx={dot.x} cy={dot.y} r={13} fill={color} />
      {/* trend arrow near the dot */}
      <text x={dot.x + 22} y={dot.y - 14} fontFamily={style.fonts.heading} fontWeight={900} fontSize={54} fill={color}>
        {rising ? "↑" : "↓"}
      </text>
      {/* label */}
      <text x={padX} y={H - 30} fontFamily={style.fonts.mono} fontSize={fitFS(label, W - padX * 2, 28)} fill={style.colors.textSecondary}>
        {label}
      </text>
    </svg>
  );
};
