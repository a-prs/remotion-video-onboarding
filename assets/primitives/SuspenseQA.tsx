import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../../stylekit";
import { SAFE_W } from "./safe";

const WRAP = { overflowWrap: "anywhere" as const, wordBreak: "break-word" as const, lineHeight: 1.15 };

/**
 * SuspenseQA — a QUESTION card holds, then the ANSWER reveals (critic, 2026-07-23):
 * for «знаешь почему? / угадай что / и что вы думаете?». Structural hook beat.
 *
 * Plan act {type:"suspenseQA", props:{question, answer, holdSec?}}.
 */
type Props = { question?: string; answer?: string; holdSec?: number; delaySec?: number };

export const SuspenseQA: React.FC<Props> = ({
  question = "Знаешь, почему сливается бюджет?",
  answer = "Один чат на всё",
  holdSec = 1.4,
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const qEnter = spring({ frame: Math.max(0, frame - start), fps, config: style.animation.spring.gentle });
  const revealAt = start + Math.round(holdSec * fps);
  const aEnter = spring({ frame: Math.max(0, frame - revealAt), fps, config: { damping: 11, mass: 0.6, stiffness: 130 } });
  // The question slides up a bit as the answer takes the stage.
  const qShift = interpolate(aEnter, [0, 1], [0, -30]);
  const qOp = interpolate(aEnter, [0, 1], [1, 0.5]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30, width: 700, maxWidth: SAFE_W }}>
      <div
        style={{
          width: "90%",
          padding: "24px 28px",
          borderRadius: style.radius,
          background: style.colors.cardBg,
          border: `1px solid ${style.colors.cardBorder}`,
          opacity: qEnter * qOp,
          transform: `translateY(${interpolate(qEnter, [0, 1], [18, 0]) + qShift}px)`,
          textAlign: "center",
        }}
      >
        <span style={{ fontFamily: style.fonts.heading, fontWeight: 900, fontSize: 44, color: style.colors.textPrimary, ...WRAP }}>
          {question}
        </span>
      </div>
      {aEnter > 0.01 && (
        <div
          style={{
            width: "80%",
            padding: "26px 30px",
            borderRadius: style.radius,
            background: style.colors.accent,
            opacity: aEnter,
            transform: `scale(${interpolate(aEnter, [0, 1], [0.7, 1])})`,
            textAlign: "center",
            boxShadow: "0 18px 50px rgba(0,0,0,0.5)",
          }}
        >
          <span style={{ fontFamily: style.fonts.heading, fontWeight: 900, fontSize: 52, color: style.contrast.textOnAccent, ...WRAP }}>
            {answer}
          </span>
        </div>
      )}
    </div>
  );
};
