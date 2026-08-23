import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { measureText, fitText } from "@remotion/layout-utils";
import { style } from "../../stylekit";
import { SAFE_W } from "./safe";

/**
 * Pointer — a cursor-hand FLIES IN and taps an element (critic, 2026-07-23): for
 * «смотри сюда / вот тут / видишь / обрати внимание». The deixis gesture.
 *
 * Plan act {type:"pointer", props:{label}}.
 */
type Props = { label?: string; delaySec?: number };

const W = 620;
const H = 460;

export const Pointer: React.FC<Props> = ({ label = "вот тут", delaySec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const cardX = W / 2;
  const cardY = H * 0.4;
  const cardEnter = spring({ frame: Math.max(0, frame - start), fps, config: style.animation.spring.gentle });

  // Adaptive card: shrink font + width so the label fits inside the frame.
  const labelFs = Math.max(26, Math.min(46, fitText({ text: label, withinWidth: SAFE_W - 140, fontFamily: style.fonts.heading, fontWeight: 900 }).fontSize));
  const labelW = measureText({ text: label, fontFamily: style.fonts.heading, fontWeight: 900, fontSize: labelFs }).width;
  const rectW = Math.min(SAFE_W, Math.max(340, labelW + 80));

  // Cursor flies from bottom-right to just under the card, then a tap pulse.
  const flyAt = start + Math.round(0.25 * fps);
  const fly = spring({ frame: Math.max(0, frame - flyAt), fps, config: style.animation.spring.gentle });
  const curX = interpolate(fly, [0, 1], [W + 80, cardX + 60]);
  const curY = interpolate(fly, [0, 1], [H + 80, cardY + 70]);
  // Tap pulse once the cursor arrives.
  const tapAt = flyAt + Math.round(0.5 * fps);
  const tapPhase = Math.max(0, frame - tapAt) / fps;
  const tap = Math.sin(tapPhase * 14) * Math.exp(-4 * tapPhase);
  const cardScale = interpolate(cardEnter, [0, 1], [0.9, 1]) + (frame >= tapAt ? tap * 0.04 : 0);

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      {/* the target card */}
      <g opacity={cardEnter} transform={`translate(${cardX} ${cardY}) scale(${cardScale})`}>
        <rect x={-rectW / 2} y={-58} width={rectW} height={116} rx={14} fill={style.colors.cardBg} stroke={style.colors.accent} strokeWidth={2} />
        <text x={0} y={14} textAnchor="middle" fontFamily={style.fonts.heading} fontWeight={900} fontSize={labelFs} fill={style.colors.textPrimary}>
          {label}
        </text>
      </g>
      {/* tap ripple */}
      {frame >= tapAt && (
        <circle cx={cardX} cy={cardY} r={interpolate(Math.min(1, tapPhase * 2), [0, 1], [10, 90])} fill="none" stroke={style.colors.accent} strokeWidth={3} opacity={Math.max(0, 0.6 - tapPhase)} />
      )}
      {/* cursor hand (simple arrow pointer) */}
      <g transform={`translate(${curX} ${curY}) scale(${1 + tap * 0.15})`}>
        <path
          d="M 0 0 L 0 34 L 9 26 L 15 40 L 22 37 L 16 23 L 27 23 Z"
          fill={style.colors.textPrimary}
          stroke="#0a0a0c"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};
