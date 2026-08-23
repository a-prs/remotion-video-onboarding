import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { style } from "../../stylekit";
import { SAFE_W } from "./safe";

/**
 * KineticWord — the default sound-off insurance (critic, 2026-07-23): the current
 * spoken key-word pops on a pill sized to the word.
 *
 * Text-robustness (Andrey, 2026-07-23): the pill NEVER exceeds the safe content
 * width — long text wraps to multiple lines, and a single over-long word shrinks
 * (fitText) to fit within the frame. Nothing spills past the phone edges.
 *
 * Sentiment: neg → shake + RED; pos → shake, then GREEN + check ✓; neutral → teal.
 * Plan act {type:"kineticWord", props:{word, sentiment?}}.
 */
type Sentiment = "neutral" | "neg" | "pos";
type Props = { word?: string; sentiment?: Sentiment; accent?: boolean; delaySec?: number };

const FS = 96;
const PAD_X = 34;
const TEAL = style.colors.accent;
const RED = style.colors.danger;
const GREEN = style.colors.success;

function lerpHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export const KineticWord: React.FC<Props> = ({
  word = "переплачиваешь",
  sentiment = "neutral",
  accent = true,
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const rel = Math.max(0, frame - start);
  const tSec = rel / fps;
  const pop = spring({ frame: rel, fps, config: style.animation.spring.enter });

  // Font: cap at FS, but shrink so the LONGEST word fits one line inside the safe
  // width — then wrapping handles multi-word phrases without ever spilling.
  const longest = word.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), "");
  const fit = fitText({ text: longest || word, withinWidth: SAFE_W - PAD_X * 2, fontFamily: style.fonts.heading, fontWeight: 900 });
  const fs = Math.max(30, Math.min(FS, fit.fontSize));

  const amp = sentiment === "neg" ? 9 : sentiment === "pos" ? 6 : 0;
  const decay = sentiment === "neg" ? Math.exp(-1.6 * tSec) : Math.exp(-4.5 * tSec);
  const shakeX = pop > 0.25 ? amp * Math.sin(tSec * 38) * decay : 0;

  let pill = TEAL;
  if (sentiment === "neg") pill = RED;
  if (sentiment === "pos") {
    const cp = interpolate(frame, [start + 8, start + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    pill = lerpHex(TEAL, GREEN, cp);
  }
  const textColor = sentiment === "neg" ? "#ffffff" : style.contrast.textOnAccent;
  const checkPop = sentiment === "pos"
    ? spring({ frame: Math.max(0, frame - (start + 20)), fps, config: style.animation.spring.enter })
    : 0;

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20, maxWidth: SAFE_W, transform: `translateX(${shakeX}px) scale(${0.7 + pop * 0.3})`, opacity: pop }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: SAFE_W - 120,
          padding: `16px ${PAD_X}px`,
          borderRadius: 18,
          background: accent ? pill : style.colors.cardBg,
          border: accent ? "none" : `2px solid ${style.colors.cardBorder}`,
        }}
      >
        <span
          style={{
            fontFamily: style.fonts.heading,
            fontWeight: 900,
            fontSize: fs,
            lineHeight: 1.05,
            textAlign: "center",
            color: accent ? textColor : style.colors.textPrimary,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {word}
        </span>
      </div>
      {sentiment === "pos" && checkPop > 0.02 && (
        <svg width={92} height={92} style={{ flexShrink: 0, transform: `scale(${checkPop})` }}>
          <circle cx={46} cy={46} r={42} fill={GREEN} />
          <path d="M 26 48 L 40 62 L 66 32" fill="none" stroke="#0a0a0c" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
};
