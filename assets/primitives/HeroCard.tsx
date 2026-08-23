import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../stylekit";
import { ZONES, LEGIBLE } from "./format";
import { LogoMark } from "./LogoMark";

/**
 * HeroCard — ONE deep-dive card centered in the frame. A mono category label, a
 * logo/emoji mark in the header, a big bold title, a description line, then
 * bullets revealing one-by-one (staggered). Flat: thin-border card on the
 * frosted stage, teal accent edge, NO glow. Fullscreen act.
 */
type Props = {
  category?: string;
  title: string;
  description?: string;
  bullets?: string[];
  icon?: string;
  brand?: string;
  delaySec?: number;
  compact?: boolean;
};

const DEFAULT: Required<Pick<Props, "category" | "title" | "description" | "bullets" | "icon">> = {
  category: "Разбираем",
  title: "Главная идея",
  description: "Одна мысль, которую стоит унести с собой.",
  bullets: [
    "Что это даёт на практике",
    "Где это экономит время",
    "Почему это работает",
  ],
  icon: "🎯",
};

export const HeroCard: React.FC<Props> = ({
  category = DEFAULT.category,
  title = DEFAULT.title,
  description = DEFAULT.description,
  bullets = DEFAULT.bullets,
  icon = DEFAULT.icon,
  brand,
  delaySec = 0,
  compact = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const local = Math.max(0, frame - start);
  const step = 8; // frames between bullets

  // Compact (Mode A overlay) — tighter, fits the top-third band.
  const shownBullets = compact ? bullets.slice(0, 3) : bullets;
  const cardMaxW = compact ? 760 : 920;
  const cardGap = compact ? 16 : 28;
  const cardPad = compact ? "28px 32px" : "48px 52px";
  const categorySize = compact ? 20 : LEGIBLE.caption;
  const headerGap = compact ? 18 : 28;
  const markSize = compact ? 42 : 64;
  const iconSize = compact ? 40 : 60;
  const titleSize = compact ? 38 : 58;
  const descSize = compact ? 34 : 38; // keep >= LEGIBLE.bodyMin
  const bulletsGap = compact ? 11 : 18;
  const bodySize = compact ? LEGIBLE.bodyMin : LEGIBLE.body;
  const dotMarginTop = compact ? 12 : 16;

  // Card entrance.
  const cardEnter = spring({ frame: local, fps, config: style.animation.spring.enter });
  const cardOp = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardY = interpolate(cardEnter, [0, 1], [40, 0]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: cardMaxW,
        display: "flex",
        flexDirection: "column",
        gap: cardGap,
        padding: cardPad,
        background: style.colors.cardBg,
        border: `1px solid ${style.colors.cardBorder}`,
        borderTop: `3px solid ${style.colors.accent}`,
        borderRadius: style.radius,
        boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
        opacity: cardOp,
        transform: `translateY(${cardY}px)`,
      }}
    >
      {/* category label */}
      <div
        style={{
          fontFamily: style.fonts.mono,
          fontSize: categorySize,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: style.colors.textSecondary,
        }}
      >
        {category}
      </div>

      {/* header: mark + title */}
      <div style={{ display: "flex", alignItems: "center", gap: headerGap }}>
        {brand ? (
          <LogoMark brand={brand} size={markSize} inline />
        ) : icon ? (
          <span style={{ fontSize: iconSize, lineHeight: 1 }}>{icon}</span>
        ) : null}
        <div
          style={{
            fontFamily: style.fonts.heading,
            fontWeight: 900,
            fontSize: titleSize,
            color: style.colors.textPrimary,
            letterSpacing: -0.5,
            lineHeight: 1.04,
          }}
        >
          {title}
        </div>
      </div>

      {/* description */}
      {description && (
        <div
          style={{
            fontFamily: style.fonts.body,
            fontSize: descSize,
            color: style.colors.textSecondary,
            lineHeight: 1.3,
          }}
        >
          {description}
        </div>
      )}

      {/* bullets — staggered reveal */}
      {shownBullets && shownBullets.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: bulletsGap, marginTop: 4 }}>
          {shownBullets.map((b, i) => {
            const d = 10 + i * step;
            const enter = spring({ frame: local - d, fps, config: style.animation.spring.enter });
            const op = interpolate(local, [d, d + 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const x = interpolate(enter, [0, 1], [36, 0]);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 18,
                  opacity: op,
                  transform: `translateX(${x}px)`,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: style.colors.accent,
                    flexShrink: 0,
                    marginTop: dotMarginTop,
                  }}
                />
                <div
                  style={{
                    fontFamily: style.fonts.body,
                    fontSize: bodySize,
                    color: style.colors.textPrimary,
                    lineHeight: 1.28,
                  }}
                >
                  {b}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
