import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../stylekit";
import { ZONES, LEGIBLE } from "./format";
import { LogoMark } from "./LogoMark";

/**
 * IconTitle — overlay (Mode A) section marker: a centered mark (brand logo or
 * emoji) above a big bold title, with an optional mono label underneath. Flat:
 * white-on-black, teal mark accent, purple mono label. GENTLE entrance — a soft
 * rise + fade, no energetic pop. Lives in the top third. ≤ ~3 lines.
 */
type Props = {
  icon?: string;
  brand?: string;
  title: string;
  label?: string;
  delaySec?: number;
};

export const IconTitle: React.FC<Props> = ({
  icon = "✦",
  brand,
  title = "Главная мысль",
  label = "РАЗДЕЛ",
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
        width: "100%",
        maxWidth: "85%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 22,
        padding: `0 ${ZONES.sideGutter}px`,
        opacity,
        transform: `translateY(${rise}px)`,
        textAlign: "center",
      }}
    >
      {/* mark: logo or emoji */}
      {brand ? (
        <LogoMark brand={brand} size={84} inline />
      ) : (
        <span style={{ fontSize: 80, lineHeight: 1, color: style.colors.accent }}>{icon}</span>
      )}

      {/* big bold title */}
      <div
        style={{
          fontFamily: style.fonts.heading,
          fontWeight: 900,
          fontSize: 72,
          lineHeight: 1.05,
          letterSpacing: -1,
          color: style.colors.textPrimary,
        }}
      >
        {title}
      </div>

      {/* optional mono label */}
      {label && (
        <div
          style={{
            fontFamily: style.fonts.mono,
            fontSize: LEGIBLE.caption,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: style.colors.primary,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
