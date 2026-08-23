import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { style } from "../stylekit";

/**
 * TwoColumn — the "Human vs Agent" comparison from the references. Two bordered
 * cards with a mono header + bullet items. In vertical the two columns STACK
 * top→bottom (mobile reflow) so each stays readable on a phone.
 */
type Col = { title: string; tag: string; items: string[]; accent?: string };
type Props = {
  left?: Col;
  right?: Col;
  delaySec?: number;
};

const L: Col = { title: "Human", tag: "stays human", items: ["judgment", "money on the line", "relationships"] };
const R: Col = {
  title: "Agent",
  tag: "can draft",
  items: ["responses", "proposals", "ideas"],
  accent: style.colors.accent,
};

const Card: React.FC<{ col: Col; delay: number; bulletAccent: string }> = ({ col, delay, bulletAccent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: Math.max(0, frame - delay), fps, config: style.animation.spring.gentle });
  const op = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(enter, [0, 1], [30, 0]);
  return (
    <div
      style={{
        flex: 1,
        padding: "26px 28px",
        borderRadius: 12,
        background: style.colors.cardBg,
        border: `1px solid ${col.accent ?? style.colors.cardBorder}`,
        opacity: op,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontFamily: style.fonts.mono,
          fontSize: 22,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: style.colors.textSecondary,
          marginBottom: 10,
        }}
      >
        {col.tag}
      </div>
      <div
        style={{
          fontFamily: style.fonts.heading,
          fontWeight: 900,
          fontSize: 56,
          color: col.accent ?? style.colors.textPrimary,
          marginBottom: 18,
        }}
      >
        {col.title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {col.items.map((it) => (
          <div key={it} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ color: bulletAccent, fontSize: 28 }}>◆</span>
            <span style={{ fontFamily: style.fonts.body, fontWeight: 600, fontSize: 38, color: style.colors.textPrimary }}>
              {it}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TwoColumn: React.FC<Props> = ({ left = L, right = R, delaySec = 0 }) => {
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, width: "100%" }}>
      <Card col={left} delay={start} bulletAccent={style.colors.primary} />
      <Card col={right} delay={start + Math.round(0.4 * fps)} bulletAccent={style.colors.accent} />
    </div>
  );
};
