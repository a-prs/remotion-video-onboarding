import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../../stylekit";
import { ZONES, LEGIBLE } from "../format";
import { LogoMark } from "../LogoMark";

/**
 * CardPile — a small collection of concept cards that appear stacking up in a
 * vertical stack with a slight alternating rotation (±2–3deg) for a "pile"
 * feel. Each card: optional logo/emoji mark, title, optional subtitle, optional
 * mono badge pill (teal). Staggered entrances. Flat: thin-border cards on the
 * frosted stage, NO glow. Fullscreen act.
 */
type Card = {
  title: string;
  subtitle?: string;
  badge?: string;
  brand?: string;
  icon?: string;
};
type Props = { cards?: Card[]; title?: string; delaySec?: number; compact?: boolean };

const DEFAULT: Card[] = [
  { title: "Идея в работу", subtitle: "одна задача входит в систему", badge: "вход", icon: "📥" },
  { title: "Агент-исследователь", subtitle: "факты · источники · проверка", badge: "research", icon: "🔍" },
  { title: "Сборка контента", subtitle: "стратегия → форматы", badge: "content", icon: "✍️" },
];

export const CardPile: React.FC<Props> = ({
  cards = DEFAULT,
  title,
  delaySec = 0,
  compact = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const local = Math.max(0, frame - start);
  const step = 9; // frames between cards

  // Compact (Mode A overlay) — tighter, fits the top-third band.
  const items = compact ? cards.slice(0, 3) : cards;
  const containerMaxW = compact ? 760 : 900;
  const containerGap = compact ? 14 : 24;
  const titleSize = compact ? 20 : LEGIBLE.caption;
  const cardGap = compact ? 16 : 26;
  const cardPad = compact ? "16px 20px" : "26px 32px";
  const markSize = compact ? 36 : 56;
  const iconSize = compact ? 34 : 52;
  const cardTitleSize = compact ? 34 : 46;
  const subtitleSize = 34; // keep >= LEGIBLE.bodyMin
  const badgeSize = compact ? 16 : 22;
  const badgePad = compact ? "5px 11px" : "8px 16px";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: containerMaxW,
        display: "flex",
        flexDirection: "column",
        gap: containerGap,
      }}
    >
      {title && (
        <div
          style={{
            fontFamily: style.fonts.mono,
            fontSize: titleSize,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: style.colors.textSecondary,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
      )}
      {items.map((c, i) => {
        const d = i * step;
        const enter = spring({ frame: local - d, fps, config: style.animation.spring.enter });
        const op = interpolate(local, [d, d + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const y = interpolate(enter, [0, 1], [60, 0]);
        // Alternating "pile" lean, settling to its resting tilt.
        const restTilt = (i % 2 === 0 ? 1 : -1) * (2 + (i % 2) * 0.5);
        const rot = interpolate(enter, [0, 1], [restTilt * 3, restTilt]);
        const accent = i % 2 === 0 ? style.colors.accent : style.colors.primary;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: cardGap,
              padding: cardPad,
              background: style.colors.cardBg,
              border: `1px solid ${style.colors.cardBorder}`,
              borderLeft: `3px solid ${accent}`,
              borderRadius: style.radius,
              boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
              opacity: op,
              transform: `translateY(${y}px) rotate(${rot}deg)`,
            }}
          >
            {/* mark: logo or emoji */}
            {c.brand ? (
              <LogoMark brand={c.brand} size={markSize} inline />
            ) : c.icon ? (
              <span style={{ fontSize: iconSize, lineHeight: 1 }}>{c.icon}</span>
            ) : null}

            {/* text */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <div
                style={{
                  fontFamily: style.fonts.heading,
                  fontWeight: 900,
                  fontSize: cardTitleSize,
                  color: style.colors.textPrimary,
                  letterSpacing: -0.5,
                  lineHeight: 1.05,
                }}
              >
                {c.title}
              </div>
              {c.subtitle && (
                <div
                  style={{
                    fontFamily: style.fonts.body,
                    fontSize: subtitleSize,
                    color: style.colors.textSecondary,
                    lineHeight: 1.25,
                  }}
                >
                  {c.subtitle}
                </div>
              )}
            </div>

            {/* badge pill */}
            {c.badge && (
              <div
                style={{
                  fontFamily: style.fonts.mono,
                  fontSize: badgeSize,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: style.colors.accent,
                  border: `1px solid ${style.colors.cardBorder}`,
                  borderRadius: 999,
                  padding: badgePad,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {c.badge}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
