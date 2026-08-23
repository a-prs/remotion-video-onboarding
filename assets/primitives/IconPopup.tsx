import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../../stylekit";
import { ZONES, LEGIBLE } from "../format";
import { V_GLASS } from "../glass";
import { LogoMark } from "../LogoMark";

/**
 * IconPopup — overlay (Mode A) accent pill: a small horizontal row of a mark
 * (brand logo or emoji) + one short line of text, on a frosted glass plate
 * (backdrop-blur, footage shows through). Flat: white text, teal mark accent.
 * GENTLE entrance — soft rise + fade, not an energetic pop. One line.
 */
type Props = {
  icon?: string;
  brand?: string;
  text: string;
  delaySec?: number;
};

export const IconPopup: React.FC<Props> = ({
  icon = "⚡",
  brand,
  text = "Главное за секунду",
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const local = Math.max(0, frame - start);

  // Gentle pop: soft rise + fade (Mode A = minimal motion).
  const enter = spring({ frame: local, fps, config: style.animation.spring.gentle });
  const rise = interpolate(enter, [0, 1], [20, 0]);
  const opacity = interpolate(local, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (frame < start) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 22,
        maxWidth: "85%",
        padding: "22px 32px",
        background: V_GLASS.panelBg,
        backdropFilter: `blur(${V_GLASS.panelBlur}px)`,
        WebkitBackdropFilter: `blur(${V_GLASS.panelBlur}px)`,
        border: `1px solid ${V_GLASS.panelBorder}`,
        borderLeft: `3px solid ${style.colors.accent}`,
        borderRadius: V_GLASS.panelRadius,
        boxShadow: `0 18px 50px rgba(0,0,0,0.45), inset 0 1px 0 ${V_GLASS.innerHighlight}`,
        opacity,
        transform: `translateY(${rise}px)`,
      }}
    >
      {/* mark: logo or emoji */}
      {brand ? (
        <LogoMark brand={brand} size={52} inline />
      ) : (
        <span style={{ fontSize: 48, lineHeight: 1 }}>{icon}</span>
      )}

      {/* short line of text */}
      <div
        style={{
          fontFamily: style.fonts.heading,
          fontWeight: 700,
          fontSize: LEGIBLE.body,
          lineHeight: 1.1,
          letterSpacing: -0.5,
          color: style.colors.textPrimary,
        }}
      >
        {text}
      </div>
    </div>
  );
};
