import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { style } from "../../stylekit";

/**
 * PlugConnect — «подключаю к / коннекчу / интеграция / плагин к» (critic,
 * 2026-07-23): a plug slides out of node A and INSERTS into node B's socket, a
 * wire trailing behind. The physical "connect" reads with sound off.
 *
 * Plan act {type:"plugConnect", props:{a, b, ...}}.
 */
type Props = { a?: string; b?: string; delaySec?: number };

const W = 760;
const H = 420;

export const PlugConnect: React.FC<Props> = ({
  a = "Мой бот",
  b = "Супергруппа",
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const cy = H / 2;
  const cw = 230;
  const ch = 150;
  const leftX = 30;
  const rightX = W - 30 - cw;

  const enter = spring({ frame: Math.max(0, frame - start), fps, config: style.animation.spring.gentle });
  // Plug travels from A's right edge into B's socket.
  const from = leftX + cw + 12;
  const to = rightX - 26;
  const t = interpolate(frame, [start + fps * 0.4, start + fps * 1.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const plugX = interpolate(t, [0, 1], [from, to]);
  const seated = t > 0.98;
  // Shrink node labels to fit inside their boxes (SVG text does not wrap).
  const aFs = Math.max(15, Math.min(32, fitText({ text: a, withinWidth: cw - 32, fontFamily: style.fonts.heading, fontWeight: 900 }).fontSize));
  const bFs = Math.max(15, Math.min(30, fitText({ text: b, withinWidth: cw - 32, fontFamily: style.fonts.heading, fontWeight: 900 }).fontSize));

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      {/* wire trailing the plug */}
      <path d={`M ${from} ${cy} L ${plugX} ${cy}`} stroke={style.colors.accent} strokeWidth={4} strokeLinecap="round" opacity={enter} />
      {/* node A */}
      <g opacity={enter}>
        <rect x={leftX} y={cy - ch / 2} width={cw} height={ch} rx={14} fill={style.colors.cardBg} stroke={style.colors.cardBorder} />
        <text x={leftX + cw / 2} y={cy + 12} textAnchor="middle" fontFamily={style.fonts.heading} fontWeight={900} fontSize={aFs} fill={style.colors.textPrimary}>{a}</text>
      </g>
      {/* node B with a socket notch on its left side */}
      <g opacity={enter}>
        <rect x={rightX} y={cy - ch / 2} width={cw} height={ch} rx={14} fill={style.colors.cardBg} stroke={seated ? style.colors.accent : style.colors.cardBorder} strokeWidth={seated ? 2 : 1} />
        <rect x={rightX - 6} y={cy - 16} width={14} height={32} rx={3} fill={style.colors.bg} stroke={style.colors.cardBorder} />
        <text x={rightX + cw / 2} y={cy + 12} textAnchor="middle" fontFamily={style.fonts.heading} fontWeight={900} fontSize={bFs} fill={style.colors.textPrimary}>{b}</text>
      </g>
      {/* the plug */}
      <g transform={`translate(${plugX} ${cy})`}>
        <rect x={-24} y={-14} width={26} height={28} rx={4} fill={style.colors.accent} />
        <rect x={2} y={-6} width={12} height={4} rx={2} fill={style.colors.accent} />
        <rect x={2} y={2} width={12} height={4} rx={2} fill={style.colors.accent} />
      </g>
    </svg>
  );
};
