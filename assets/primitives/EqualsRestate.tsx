import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../../stylekit";
import { SAFE_W } from "./safe";

/**
 * EqualsRestate — «A = B» (critic, 2026-07-23): for «то есть / по сути / иными
 * словами / проще говоря». Cheap, reads instantly with sound off.
 *
 * Plan act {type:"equals", props:{a, b}}.
 */
type Props = { a?: string; b?: string; delaySec?: number };

const Card: React.FC<{ text: string; enter: number; accent?: boolean }> = ({ text, enter, accent }) => (
  <div
    style={{
      minWidth: 200,
      maxWidth: (SAFE_W - 120) / 2,
      padding: "26px 30px",
      borderRadius: style.radius,
      background: style.colors.cardBg,
      border: `1px solid ${accent ? style.colors.accent : style.colors.cardBorder}`,
      opacity: enter,
      transform: `translateY(${interpolate(enter, [0, 1], [18, 0])}px)`,
      textAlign: "center",
    }}
  >
    <span style={{ fontFamily: style.fonts.heading, fontWeight: 900, fontSize: 48, color: accent ? style.colors.accent : style.colors.textPrimary, overflowWrap: "anywhere", wordBreak: "break-word", lineHeight: 1.1 }}>
      {text}
    </span>
  </div>
);

export const EqualsRestate: React.FC<Props> = ({ a = "AI-агент", b = "твой сотрудник", delaySec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const enterA = spring({ frame: Math.max(0, frame - start), fps, config: style.animation.spring.gentle });
  const enterEq = spring({ frame: Math.max(0, frame - start - Math.round(0.35 * fps)), fps, config: style.animation.spring.enter });
  const enterB = spring({ frame: Math.max(0, frame - start - Math.round(0.7 * fps)), fps, config: style.animation.spring.gentle });

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28, maxWidth: SAFE_W }}>
      <Card text={a} enter={enterA} />
      <span
        style={{
          fontFamily: style.fonts.heading,
          fontWeight: 900,
          fontSize: 88,
          color: style.colors.accent,
          opacity: enterEq,
          transform: `scale(${interpolate(enterEq, [0, 1], [0.4, 1])})`,
        }}
      >
        =
      </span>
      <Card text={b} enter={enterB} accent />
    </div>
  );
};
