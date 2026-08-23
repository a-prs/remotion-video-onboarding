import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { evolvePath } from "@remotion/paths";
import { fitText } from "@remotion/layout-utils";
import { style } from "../../stylekit";

/**
 * BeforeAfter — «было/стало / до/после / раньше-теперь» (critic, 2026-07-23):
 * a grey "before" card, an arrow grows across (evolvePath), a teal "after" card
 * lands. The transition reads with sound off.
 *
 * Plan act {type:"beforeAfter", props:{before:{label}, after:{label}, ...}}.
 */
type Card = { label: string };
type Props = { before?: Card; after?: Card; delaySec?: number };

const W = 760;
const H = 420;

export const BeforeAfter: React.FC<Props> = ({
  before = { label: "3 часа рутины" },
  after = { label: "10 минут" },
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const cy = H / 2;
  const cw = 260;
  const ch = 150;
  const leftX = 40;
  const rightX = W - 40 - cw;

  const beforeEnter = spring({ frame: Math.max(0, frame - start), fps, config: style.animation.spring.gentle });
  const arrowAt = start + Math.round(0.5 * fps);
  const arrowD = `M ${leftX + cw + 14} ${cy} L ${rightX - 14} ${cy}`;
  const ap = interpolate(frame, [arrowAt, arrowAt + Math.round(0.4 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const { strokeDasharray, strokeDashoffset } = evolvePath(ap, arrowD);
  const afterAt = arrowAt + Math.round(0.4 * fps);
  const afterEnter = spring({ frame: Math.max(0, frame - afterAt), fps, config: style.animation.spring.gentle });
  // Shrink labels to fit inside their cards (SVG text does not wrap).
  const beforeFs = Math.max(16, Math.min(34, fitText({ text: before.label, withinWidth: cw - 36, fontFamily: style.fonts.heading, fontWeight: 900 }).fontSize));
  const afterFs = Math.max(16, Math.min(38, fitText({ text: after.label, withinWidth: cw - 36, fontFamily: style.fonts.heading, fontWeight: 900 }).fontSize));

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      {/* before (grey) */}
      <g opacity={beforeEnter}>
        <rect x={leftX} y={cy - ch / 2} width={cw} height={ch} rx={14} fill={style.colors.cardBg} stroke={style.colors.cardBorder} />
        <text x={leftX + cw / 2} y={cy - 4} textAnchor="middle" fontFamily={style.fonts.mono} fontSize={24} fill={style.colors.textSecondary}>было</text>
        <text x={leftX + cw / 2} y={cy + 36} textAnchor="middle" fontFamily={style.fonts.heading} fontWeight={900} fontSize={beforeFs} fill={style.colors.textSecondary}>{before.label}</text>
      </g>
      {/* arrow */}
      <path d={arrowD} fill="none" stroke={style.colors.accent} strokeWidth={4} strokeLinecap="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
      {ap > 0.85 && <path d={`M ${rightX - 14} ${cy} l -16 -9 l 0 18 Z`} fill={style.colors.accent} />}
      {/* after (teal accent) */}
      <g opacity={afterEnter} transform={`scale(${0.9 + afterEnter * 0.1})`} style={{ transformOrigin: `${rightX + cw / 2}px ${cy}px` }}>
        <rect x={rightX} y={cy - ch / 2} width={cw} height={ch} rx={14} fill={`${style.colors.accent}1f`} stroke={style.colors.accent} strokeWidth={2} />
        <text x={rightX + cw / 2} y={cy - 4} textAnchor="middle" fontFamily={style.fonts.mono} fontSize={24} fill={style.colors.accent}>стало</text>
        <text x={rightX + cw / 2} y={cy + 36} textAnchor="middle" fontFamily={style.fonts.heading} fontWeight={900} fontSize={afterFs} fill={style.colors.textPrimary}>{after.label}</text>
      </g>
    </svg>
  );
};
