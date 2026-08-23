import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { evolvePath } from "@remotion/paths";
import { measureText, fitText } from "@remotion/layout-utils";
import { style } from "../stylekit";
import { SAFE_W } from "./safe";

/**
 * StrikeNegate — Andrey's flagship example (2026-07-23): «клод-код здесь не поможет»
 * → the term is written, then STRUCK THROUGH as the negation is spoken, and a
 * red STAMP slams over it. The canonical «отрицание» beat.
 *
 * Plan act {type:"strikeNegate", props:{term, stamp}}.
 */
type Props = { term?: string; stamp?: string; delaySec?: number };

const RED = style.colors.danger;
const TERM_FS = 84;

export const StrikeNegate: React.FC<Props> = ({
  term = "Claude Code",
  stamp = "НЕ ПОМОЖЕТ",
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const termEnter = spring({ frame: Math.max(0, frame - start), fps, config: style.animation.spring.gentle });
  // Shrink term/stamp so they stay one line inside the safe frame width (no spill).
  const termFs = Math.max(34, Math.min(TERM_FS, fitText({ text: term, withinWidth: SAFE_W - 60, fontFamily: style.fonts.heading, fontWeight: 900 }).fontSize));
  const { width: termW } = measureText({ text: term, fontFamily: style.fonts.heading, fontSize: termFs, fontWeight: 900 });
  const stampFs = Math.max(26, Math.min(58, fitText({ text: stamp, withinWidth: SAFE_W - 80, fontFamily: style.fonts.heading, fontWeight: 900 }).fontSize));

  // Strike draws across the word ~0.6s after it lands.
  const strikeStart = start + Math.round(0.6 * fps);
  const strikeP = interpolate(frame, [strikeStart, strikeStart + Math.round(0.4 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineD = `M 0 0 L ${termW + 40} 0`;
  const { strokeDasharray, strokeDashoffset } = evolvePath(strikeP, lineD);

  // Stamp slams in once the strike is drawn.
  const stampAt = strikeStart + Math.round(0.35 * fps);
  const stampSpring = spring({ frame: Math.max(0, frame - stampAt), fps, config: { damping: 9, mass: 0.6, stiffness: 130 } });
  const stampScale = interpolate(stampSpring, [0, 1], [2.2, 1]);
  const stampOp = interpolate(frame, [stampAt, stampAt + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", maxWidth: SAFE_W }}>
      {/* the term */}
      <div style={{ position: "relative", opacity: termEnter, transform: `translateY(${interpolate(termEnter, [0, 1], [20, 0])}px)` }}>
        <span style={{ fontFamily: style.fonts.heading, fontWeight: 900, fontSize: termFs, color: style.colors.textPrimary, whiteSpace: "nowrap" }}>
          {term}
        </span>
        {/* strikethrough line, centred over the word */}
        <svg width={termW + 40} height={20} style={{ position: "absolute", left: -20, top: "50%", overflow: "visible" }}>
          <path d={lineD} stroke={RED} strokeWidth={7} strokeLinecap="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
        </svg>
      </div>
      {/* red slam stamp */}
      <div
        style={{
          marginTop: 40,
          maxWidth: SAFE_W,
          transform: `rotate(-8deg) scale(${stampScale})`,
          opacity: stampOp,
          padding: "12px 28px",
          background: RED,
          borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <span style={{ fontFamily: style.fonts.heading, fontWeight: 900, fontSize: stampFs, color: "#fff", letterSpacing: 1, whiteSpace: "nowrap" }}>
          {stamp}
        </span>
      </div>
    </div>
  );
};
