import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import {
  Highlight,
  Circle,
  Underline,
  StrikeThrough,
  CrossedOff,
  Box,
  Bracket,
} from "@remotion/rough-notation";
import { fitText } from "@remotion/layout-utils";
import { style } from "../stylekit";
import { SAFE_W } from "./safe";

/**
 * RoughAnnotate — hand-drawn animated emphasis on a spoken word/phrase using
 * @remotion/rough-notation (bank v2, 2026-07-27). The single "underline the key
 * word AS it's said" move, in six flavours: highlight, circle, underline,
 * strike, crossed-off, box, bracket. `progress` is driven from the frame so the
 * mark draws deterministically in sync with the voice.
 *
 * Plan act {type:"annotate", props:{ text, variant, color?, sub? }}.
 * variant ∈ highlight|circle|underline|strike|crossed|box|bracket.
 */
type Variant =
  | "highlight"
  | "circle"
  | "underline"
  | "strike"
  | "crossed"
  | "box"
  | "bracket";

type Props = {
  text?: string;
  variant?: Variant;
  color?: string;
  sub?: string;
  delaySec?: number;
};

export const RoughAnnotate: React.FC<Props> = ({
  text = "важно",
  variant = "underline",
  color,
  sub,
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const f = Math.max(0, frame - start);

  // The word lands first (spring), THEN the mark draws over it ~0.35s later —
  // so the eye reads the word, then the emphasis hits, mirroring speech.
  const enter = spring({ frame: f, fps, config: style.animation.spring.gentle });
  const drawStart = Math.round(0.35 * fps);
  const progress = interpolate(
    f,
    [drawStart, drawStart + Math.round(0.7 * fps)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Highlight sits on a dark base, so pick a translucent accent; line marks use
  // solid teal by default. Strike/crossed lean red (negation), like StrikeNegate.
  const negation = variant === "strike" || variant === "crossed";
  const markColor =
    color ??
    (variant === "highlight"
      ? "rgba(94,234,212,0.35)"
      : negation
      ? style.colors.danger
      : style.colors.accent);

  // Keep the phrase inside the safe frame on one line (shrink, don't spill).
  const fs = Math.max(
    40,
    Math.min(
      92,
      fitText({
        text,
        withinWidth: SAFE_W - 120,
        fontFamily: style.fonts.heading,
        fontWeight: 900,
      }).fontSize
    )
  );

  const inner = (
    <span
      style={{
        fontFamily: style.fonts.heading,
        fontWeight: 900,
        fontSize: fs,
        color: negation ? style.colors.textPrimary : style.colors.textPrimary,
        whiteSpace: "nowrap",
        padding: variant === "box" || variant === "bracket" ? "4px 14px" : 0,
      }}
    >
      {text}
    </span>
  );

  const marked = (() => {
    const common = { color: markColor, progress, animationDuration: 700 } as const;
    switch (variant) {
      case "highlight":
        return <Highlight {...common}>{inner}</Highlight>;
      case "circle":
        return <Circle {...common}>{inner}</Circle>;
      case "underline":
        return <Underline {...common}>{inner}</Underline>;
      case "strike":
        return <StrikeThrough {...common}>{inner}</StrikeThrough>;
      case "crossed":
        return <CrossedOff {...common}>{inner}</CrossedOff>;
      case "box":
        return <Box {...common}>{inner}</Box>;
      case "bracket":
        return (
          <Bracket {...common} bracketLeft bracketRight>
            {inner}
          </Bracket>
        );
      default:
        return inner;
    }
  })();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        maxWidth: SAFE_W,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [18, 0])}px)`,
      }}
    >
      <div style={{ padding: "6px 18px" }}>{marked}</div>
      {sub && (
        <div
          style={{
            fontFamily: style.fonts.body,
            fontSize: 34,
            color: style.colors.textSecondary,
            textAlign: "center",
            maxWidth: SAFE_W - 80,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
};
