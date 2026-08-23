import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../stylekit";
import { LogoMark } from "./LogoMark";

/**
 * ChapterCards — numbered cards revealed one by one, stacked vertically (9:16
 * reflow). Topic overview / "three things". Flat: thin-border cards on the
 * frosted stage, teal index, white title, mono label. Logo or emoji in the
 * mark slot. Fullscreen act.
 */
type Chapter = {
  number?: string;
  title: string;
  subtitle?: string;
  icon?: string;
  brand?: string;
};
type Props = { chapters?: Chapter[]; title?: string; delaySec?: number; compact?: boolean };

const DEFAULT: Chapter[] = [
  { title: "Первое", subtitle: "что приходит первым" },
  { title: "Второе", subtitle: "за ним следует это" },
  { title: "Третье", subtitle: "и в конце вот это" },
];

export const ChapterCards: React.FC<Props> = ({
  chapters = DEFAULT,
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
  const items = compact ? chapters.slice(0, 3) : chapters;
  const containerMaxW = compact ? 760 : 900;
  const containerGap = compact ? 13 : 22;
  const titleSize = compact ? 18 : 26;
  const cardGap = compact ? 16 : 26;
  const cardPad = compact ? "17px 20px" : "28px 32px";
  const indexSize = compact ? 40 : 64;
  const indexMinW = compact ? 44 : 70;
  const markSize = compact ? 36 : 56;
  const iconSize = compact ? 34 : 52;
  const cardTitleSize = compact ? 34 : 46;
  const subtitleSize = 34; // keep >= LEGIBLE.bodyMin

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
            marginBottom: compact ? 4 : 6,
          }}
        >
          {title}
        </div>
      )}
      {items.map((ch, i) => {
        const d = i * step;
        const enter = spring({ frame: local - d, fps, config: style.animation.spring.enter });
        const op = interpolate(local, [d, d + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const x = interpolate(enter, [0, 1], [50, 0]);
        const accent = i === 0 ? style.colors.accent : style.colors.primary;
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
              transform: `translateX(${x}px)`,
            }}
          >
            {/* index */}
            <div
              style={{
                fontFamily: style.fonts.heading,
                fontWeight: 900,
                fontSize: indexSize,
                lineHeight: 1,
                color: accent,
                minWidth: indexMinW,
              }}
            >
              {ch.number ?? String(i + 1).padStart(2, "0")}
            </div>
            {/* mark: logo or emoji */}
            {ch.brand ? (
              <LogoMark brand={ch.brand} size={markSize} inline />
            ) : ch.icon ? (
              <span style={{ fontSize: iconSize }}>{ch.icon}</span>
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
                {ch.title}
              </div>
              {ch.subtitle && (
                <div
                  style={{
                    fontFamily: style.fonts.body,
                    fontSize: subtitleSize,
                    color: style.colors.textSecondary,
                    lineHeight: 1.25,
                  }}
                >
                  {ch.subtitle}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
