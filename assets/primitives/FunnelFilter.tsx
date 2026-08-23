import { useCurrentFrame, useVideoConfig, interpolate, spring, random } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { style } from "../../stylekit";

// Shrink a centred label so it never spills past the frame (Andrey 2026-07-23).
function fitFS(text: string, w: number, base: number, fam: string): number {
  const f = fitText({ text: text || "", withinWidth: w, fontFamily: fam, fontWeight: 700 });
  return Math.max(15, Math.min(base, f.fontSize));
}

/**
 * FunnelFilter — «из N оставляю K» (Andrey/critic, 2026-07-23): a pile of cards
 * rains into a funnel, only a few pass through the neck. Instantly legible muted.
 *
 * Plan act {type:"funnel", props:{topLabel, outLabel, drop=8, kept=2}}.
 */
type Props = {
  topLabel?: string;
  outLabel?: string;
  drop?: number;
  kept?: number;
  delaySec?: number;
};

const W = 820;
const H = 900;

export const FunnelFilter: React.FC<Props> = ({
  topLabel = "300 репо",
  outLabel = "5 лучших",
  drop = 9,
  kept = 2,
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const cx = W / 2;
  const topY = 150;
  const neckY = 560;
  const funnelTopW = 600;
  const neckW = 150;
  // Funnel walls (trapezoid).
  const wall = `M ${cx - funnelTopW / 2} ${topY} L ${cx - neckW / 2} ${neckY} M ${cx + funnelTopW / 2} ${topY} L ${cx + neckW / 2} ${neckY}`;

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      {/* top label */}
      <text x={cx} y={92} textAnchor="middle" fontFamily={style.fonts.mono} fontSize={fitFS(topLabel, W - 80, 40, style.fonts.mono)} fill={style.colors.textSecondary}>
        {topLabel}
      </text>
      {/* funnel walls */}
      <path d={wall} stroke={style.colors.cardBorder} strokeWidth={4} fill="none" strokeLinecap="round" />
      {/* raining cards (many in, staggered) */}
      {Array.from({ length: drop }).map((_, i) => {
        const seed = `f${i}`;
        const at = start + Math.round((0.1 + random(seed) * 1.4) * fps);
        const p = interpolate(frame, [at, at + Math.round(0.9 * fps)], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const sx = cx + (random(seed + "x") - 0.5) * funnelTopW * 0.7;
        const startY = topY - 70;
        const yy = interpolate(p, [0, 1], [startY, neckY - 40]);
        const xx = interpolate(p, [0, 1], [sx, cx]); // funnel toward the neck
        const scale = interpolate(p, [0, 1], [1, 0.5]);
        const op = interpolate(p, [0, 0.15, 0.9, 1], [0, 1, 1, 0.15]);
        return (
          <g key={i} transform={`translate(${xx} ${yy}) scale(${scale})`} opacity={op}>
            <rect x={-32} y={-22} width={64} height={44} rx={8} fill={style.colors.cardBg} stroke={style.colors.cardBorder} />
          </g>
        );
      })}
      {/* kept cards emerge below the neck */}
      {Array.from({ length: kept }).map((_, i) => {
        const at = start + Math.round((1.7 + i * 0.25) * fps);
        const enter = spring({ frame: Math.max(0, frame - at), fps, config: style.animation.spring.gentle });
        const bx = cx + (i - (kept - 1) / 2) * 168;
        const by = interpolate(enter, [0, 1], [neckY + 20, neckY + 130]);
        return (
          <g key={i} opacity={enter}>
            <rect x={bx - 66} y={by} width={132} height={86} rx={12} fill={style.colors.cardBg} stroke={style.colors.accent} strokeWidth={2} />
          </g>
        );
      })}
      {/* out label */}
      <text x={cx} y={neckY + 250} textAnchor="middle" fontFamily={style.fonts.heading} fontWeight={900} fontSize={fitFS(outLabel, W - 80, 58, style.fonts.heading)} fill={style.colors.accent}>
        {outLabel}
      </text>
    </svg>
  );
};
