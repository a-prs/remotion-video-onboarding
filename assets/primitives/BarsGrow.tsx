import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { style } from "../stylekit";

function fitFS(text: string, w: number, base: number): number {
  const f = fitText({ text: text || "", withinWidth: w, fontFamily: style.fonts.mono, fontWeight: 500 });
  return Math.max(13, Math.min(base, f.fontSize));
}

/**
 * BarsGrow — histogram whose bars GROW up from the baseline one by one, tallest
 * in teal (Andrey, 2026-07-23). Movement (growth) reads with sound off.
 *
 * Plan act {type:"barsGrow", props:{bars:[{label,value}]}}.
 */
type Bar = { label: string; value: number };
type Props = { bars?: Bar[]; delaySec?: number };

const W = 720;
const H = 560;

export const BarsGrow: React.FC<Props> = ({
  bars = [
    { label: "Пн", value: 30 },
    { label: "Вт", value: 52 },
    { label: "Ср", value: 44 },
    { label: "Чт", value: 76 },
    { label: "Пт", value: 100 },
  ],
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const padX = 60;
  const baseY = H - 90;
  const maxBarH = H - 180;
  const max = Math.max(...bars.map((b) => b.value)) || 1;
  const slot = (W - padX * 2) / bars.length;
  const barW = slot * 0.56;
  const topIdx = bars.reduce((mi, b, i, a) => (b.value > a[mi].value ? i : mi), 0);

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <line x1={padX * 0.6} y1={baseY} x2={W - padX * 0.6} y2={baseY} stroke={style.colors.cardBorder} strokeWidth={2} />
      {bars.map((b, i) => {
        const at = start + i * Math.round(0.18 * fps);
        const grow = spring({ frame: Math.max(0, frame - at), fps, config: style.animation.spring.gentle });
        const h = interpolate(grow, [0, 1], [0, (maxBarH * b.value) / max]);
        const x = padX + slot * i + (slot - barW) / 2;
        const isTop = i === topIdx;
        const col = isTop ? style.colors.accent : "rgba(255,255,255,0.22)";
        return (
          <g key={i}>
            <rect x={x} y={baseY - h} width={barW} height={h} rx={8} fill={col} />
            <text x={x + barW / 2} y={baseY - h - 16} textAnchor="middle" fontFamily={style.fonts.heading} fontWeight={900} fontSize={34} fill={isTop ? style.colors.accent : style.colors.textSecondary} opacity={grow}>
              {Math.round(b.value * grow)}
            </text>
            <text x={x + barW / 2} y={baseY + 40} textAnchor="middle" fontFamily={style.fonts.mono} fontSize={fitFS(b.label, slot * 0.94, 26)} fill={style.colors.textSecondary}>
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
