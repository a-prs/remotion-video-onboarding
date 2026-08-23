import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../../stylekit";
import { ZONES, LEGIBLE } from "../format";
import { V_GLASS } from "../glass";

/**
 * QuoteCard — overlay (Mode A) quote on a frosted glass plate (backdrop-blur,
 * footage shows through). A large teal opening quote mark, the quote text
 * (Montserrat), and an optional dim mono author line. Flat: white-on-black,
 * teal accent only. GENTLE entrance — soft rise + fade, no energetic pop.
 */
type Props = {
  text: string;
  author?: string;
  delaySec?: number;
};

export const QuoteCard: React.FC<Props> = ({
  text = "Хорошая мысль стоит дороже длинной речи",
  author = "Андрей",
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const local = Math.max(0, frame - start);

  // Gentle entrance: soft rise + fade (Mode A = minimal motion).
  const enter = spring({ frame: local, fps, config: style.animation.spring.gentle });
  const rise = interpolate(enter, [0, 1], [22, 0]);
  const opacity = interpolate(local, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (frame < start) return null;

  return (
    <div
      style={{
        maxWidth: "85%",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "32px 40px",
        background: V_GLASS.panelBg,
        backdropFilter: `blur(${V_GLASS.panelBlur}px)`,
        WebkitBackdropFilter: `blur(${V_GLASS.panelBlur}px)`,
        border: `1px solid ${V_GLASS.panelBorder}`,
        borderRadius: V_GLASS.panelRadius,
        boxShadow: `0 18px 50px rgba(0,0,0,0.45), inset 0 1px 0 ${V_GLASS.innerHighlight}`,
        opacity,
        transform: `translateY(${rise}px)`,
      }}
    >
      {/* large teal opening quote mark */}
      <div
        style={{
          fontFamily: style.fonts.heading,
          fontWeight: 900,
          fontSize: 96,
          lineHeight: 0.6,
          height: 56,
          color: style.colors.accent,
        }}
      >
        “
      </div>

      {/* quote text */}
      <div
        style={{
          fontFamily: style.fonts.heading,
          fontWeight: 700,
          fontSize: 48,
          lineHeight: 1.2,
          letterSpacing: -0.5,
          color: style.colors.textPrimary,
        }}
      >
        {text}
      </div>

      {/* optional author line */}
      {author && (
        <div
          style={{
            fontFamily: style.fonts.mono,
            fontSize: LEGIBLE.caption,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: style.colors.textSecondary,
            marginTop: 4,
          }}
        >
          — {author}
        </div>
      )}
    </div>
  );
};
