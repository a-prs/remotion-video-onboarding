import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { style } from "../stylekit";
import { SAFE_W } from "./safe";

/**
 * VerdictStamp — a card + a big STAMP slams over it: green ✓ (ok) or red ✗
 * (Andrey/critic, 2026-07-23). For «работает / готово» vs «провал / не взлетело».
 *
 * Plan act {type:"verdict", props:{text, ok}}.
 */
type Props = { text?: string; ok?: boolean; delaySec?: number };

const GREEN = style.colors.success;
const RED = style.colors.danger;

export const VerdictStamp: React.FC<Props> = ({ text = "Работает", ok = true, delaySec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const color = ok ? GREEN : RED;

  const enter = spring({ frame: Math.max(0, frame - start), fps, config: style.animation.spring.gentle });
  const stampAt = start + Math.round(0.4 * fps);
  const stamp = spring({ frame: Math.max(0, frame - stampAt), fps, config: { damping: 9, mass: 0.6, stiffness: 130 } });
  const stampScale = interpolate(stamp, [0, 1], [2.4, 1]);
  const stampOp = interpolate(frame, [stampAt, stampAt + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
      {/* the target card */}
      <div style={{ maxWidth: SAFE_W, opacity: enter, transform: `translateY(${interpolate(enter, [0, 1], [20, 0])}px)`, padding: "26px 48px", borderRadius: style.radius, background: style.colors.cardBg, border: `1px solid ${style.colors.cardBorder}`, textAlign: "center" }}>
        <span style={{ fontFamily: style.fonts.heading, fontWeight: 900, fontSize: Math.max(30, Math.min(60, fitText({ text, withinWidth: SAFE_W - 120, fontFamily: style.fonts.heading, fontWeight: 900 }).fontSize)), color: style.colors.textPrimary, overflowWrap: "anywhere", wordBreak: "break-word", lineHeight: 1.1 }}>{text}</span>
      </div>
      {/* the slam stamp: circle + check/cross */}
      <div style={{ transform: `scale(${stampScale}) rotate(-6deg)`, opacity: stampOp }}>
        <svg width={180} height={180}>
          <circle cx={90} cy={90} r={82} fill="none" stroke={color} strokeWidth={12} />
          {ok ? (
            <path d="M 52 92 L 80 120 L 132 60" fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M 58 58 L 122 122 M 122 58 L 58 122" fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" />
          )}
        </svg>
      </div>
    </div>
  );
};
