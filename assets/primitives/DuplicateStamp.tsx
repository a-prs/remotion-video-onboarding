import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { measureText, fitText } from "@remotion/layout-utils";
import { style } from "../../stylekit";
import { SAFE_W } from "./safe";

/**
 * DuplicateStamp — a card appears, then a DUPLICATE of it slides out with a «×N»
 * badge (Andrey, 2026-07-23). For «платил дважды / два раза за то же самое».
 * The doubling reads with sound off.
 *
 * Plan act {type:"duplicate", props:{label, times?}}.
 */
type Props = { label?: string; times?: number; delaySec?: number };

const RED = style.colors.danger;

const Card: React.FC<{ label: string; op: number; dx: number; dy: number; fs: number }> = ({ label, op, dx, dy, fs }) => (
  <div
    style={{
      position: "absolute",
      transform: `translate(${dx}px, ${dy}px)`,
      opacity: op,
      maxWidth: SAFE_W - 80,
      padding: "26px 40px",
      borderRadius: style.radius,
      background: style.colors.cardBg,
      border: `1px solid ${style.colors.cardBorder}`,
      whiteSpace: "nowrap",
    }}
  >
    <span style={{ fontFamily: style.fonts.heading, fontWeight: 900, fontSize: fs, color: style.colors.textPrimary }}>{label}</span>
  </div>
);

export const DuplicateStamp: React.FC<Props> = ({ label = "Подписка", times = 2, delaySec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const enter = spring({ frame: Math.max(0, frame - start), fps, config: style.animation.spring.gentle });
  const dupAt = start + Math.round(0.5 * fps);
  const dup = spring({ frame: Math.max(0, frame - dupAt), fps, config: style.animation.spring.gentle });
  const off = interpolate(dup, [0, 1], [0, 46]);

  const badgeAt = dupAt + Math.round(0.25 * fps);
  const badge = spring({ frame: Math.max(0, frame - badgeAt), fps, config: { damping: 9, mass: 0.6, stiffness: 130 } });
  const badgeScale = interpolate(badge, [0, 1], [2.2, 1]);

  // Shrink label so the (offset) card + badge stay inside the frame.
  const fs = Math.max(28, Math.min(52, fitText({ text: label, withinWidth: SAFE_W - 220, fontFamily: style.fonts.heading, fontWeight: 900 }).fontSize));
  const labelW = measureText({ text: label, fontFamily: style.fonts.heading, fontWeight: 900, fontSize: fs }).width;
  const boxW = Math.min(SAFE_W, Math.max(520, labelW + 200));

  return (
    <div style={{ position: "relative", width: boxW, height: 320, display: "flex", justifyContent: "center", alignItems: "center" }}>
      {/* duplicate behind, offset */}
      <Card label={label} op={dup * 0.85} dx={off} dy={off} fs={fs} />
      {/* original in front */}
      <Card label={label} op={enter} dx={0} dy={0} fs={fs} />
      {/* ×N badge */}
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 40,
          transform: `scale(${badgeScale})`,
          opacity: badge,
          width: 96,
          height: 96,
          borderRadius: "50%",
          background: RED,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: style.fonts.heading, fontWeight: 900, fontSize: 52, color: "#fff" }}>×{times}</span>
      </div>
    </div>
  );
};
