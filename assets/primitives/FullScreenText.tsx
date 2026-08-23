import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../stylekit";
import { ZONES, LEGIBLE } from "./format";

/**
 * FullScreenText — ONE huge centered statement (hook / punchline). Montserrat
 * 900, tight line-height, optional mono label above. An optional accentWord is
 * recolored teal (or accentColor). Gentle scale + blur-in entrance, NO glow.
 * Fullscreen act.
 */
type Props = {
  text?: string;
  accentWord?: string;
  accentColor?: string;
  fontSize?: number;
  label?: string;
  delaySec?: number;
  compact?: boolean;
};

const DEFAULT_TEXT = "Это меняет всё";

/** Split `text` around the first occurrence of `word`, keeping the word. */
const splitAround = (text: string, word?: string): [string, string, string] => {
  if (!word) return [text, "", ""];
  const idx = text.toLowerCase().indexOf(word.toLowerCase());
  if (idx < 0) return [text, "", ""];
  return [
    text.slice(0, idx),
    text.slice(idx, idx + word.length),
    text.slice(idx + word.length),
  ];
};

export const FullScreenText: React.FC<Props> = ({
  text = DEFAULT_TEXT,
  accentWord,
  accentColor = style.colors.accent,
  fontSize = 96,
  label,
  delaySec = 0,
  compact = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const local = Math.max(0, frame - start);

  // Compact (Mode-A overlay, top-third): smaller heading + tighter block.
  // In compact use ~LEGIBLE.heading (84) instead of the 96–120 fullscreen size.
  const size = compact
    ? LEGIBLE.heading
    : Math.min(Math.max(fontSize, LEGIBLE.heading), LEGIBLE.headingHero);
  const maxW = compact ? 760 : 1080 - ZONES.sideGutter * 2;
  const blockGap = compact ? 14 : 24;
  const labelFont = compact ? 24 : 30;

  const enter = spring({ frame: local, fps, config: style.animation.spring.enter });
  const scale = interpolate(enter, [0, 1], [0.86, 1]);
  const blur = interpolate(local, [0, 12], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const op = interpolate(local, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // mono label appears a touch earlier (above the line).
  const labelOp = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const [before, hit, after] = splitAround(text, accentWord);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: maxW,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: blockGap,
        opacity: op,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
      }}
    >
      {label && (
        <div
          style={{
            fontFamily: style.fonts.mono,
            fontSize: labelFont,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: style.colors.textSecondary,
            opacity: labelOp,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          fontFamily: style.fonts.heading,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1.02,
          letterSpacing: -1,
          color: style.colors.textPrimary,
        }}
      >
        {hit ? (
          <>
            {before}
            <span style={{ color: accentColor }}>{hit}</span>
            {after}
          </>
        ) : (
          text
        )}
      </div>
    </div>
  );
};
