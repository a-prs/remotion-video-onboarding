import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { style } from "../stylekit";
import { SAFE_W } from "./safe";

/**
 * LayerStack — «поверх / обёртка / стек / прослойка» (critic, 2026-07-23): cards
 * STACK on top of each other with depth offset, one by one. The "layered on top"
 * idea reads with sound off.
 *
 * Plan act {type:"layerStack", props:{layers:[{label}], ...}}.
 */
type Layer = { label: string };
type Props = { layers?: Layer[]; delaySec?: number };

const DEFAULT_LAYERS: Layer[] = [
  { label: "Сервер" },
  { label: "Плагин" },
  { label: "Сессия" },
  { label: "Telegram" },
];

const W = SAFE_W; // 940 — use the full safe width
const H = 660;

export const LayerStack: React.FC<Props> = ({ layers = DEFAULT_LAYERS, delaySec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const cw = 620;
  const ch = 112;
  const dx = 32; // horizontal depth offset per layer
  const dy = 60; // vertical step per layer
  const n = layers.length;
  const baseX = (W - cw) / 2 - ((n - 1) * dx) / 2;
  const baseY = H / 2 + ((n - 1) * dy) / 2 - ch / 2;

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      {layers.map((l, i) => {
        const at = start + i * Math.round(0.28 * fps);
        const enter = spring({ frame: Math.max(0, frame - at), fps, config: style.animation.spring.gentle });
        const x = baseX + i * dx;
        const y = baseY - i * dy;
        const drop = interpolate(enter, [0, 1], [-40, 0]);
        const isTop = i === n - 1;
        // Shrink label so it fits inside the card (SVG text does not wrap).
        const fs = Math.max(22, Math.min(46, fitText({ text: l.label, withinWidth: cw - 64, fontFamily: style.fonts.heading, fontWeight: 900 }).fontSize));
        return (
          <g key={i} opacity={enter} transform={`translate(${x} ${y + drop})`}>
            <rect width={cw} height={ch} rx={12} fill={isTop ? `${style.colors.accent}1f` : style.colors.cardBg} stroke={isTop ? style.colors.accent : style.colors.cardBorder} strokeWidth={isTop ? 2 : 1} />
            <text x={28} y={ch / 2 + 12} fontFamily={style.fonts.heading} fontWeight={900} fontSize={fs} fill={isTop ? style.colors.textPrimary : style.colors.textSecondary}>
              {l.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
