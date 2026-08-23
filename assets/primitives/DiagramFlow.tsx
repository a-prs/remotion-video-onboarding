import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../../stylekit";
import { ZONES, LEGIBLE } from "../format";
import { LogoMark } from "../LogoMark";

/**
 * DiagramFlow — a workflow chain reflowed VERTICALLY (top→bottom). Each step is
 * a flat node card (logo/emoji mark + label), connected by a downward arrow (↓)
 * that draws/fades in just before the next node appears. One node may be
 * "active" (subtle teal border, NO glow). Fullscreen act.
 */
type Step = { label: string; icon?: string; brand?: string; color?: string };
type Props = { steps?: Step[]; title?: string; delaySec?: number; compact?: boolean };

const DEFAULT: Step[] = [
  { label: "Запрос клиента", icon: "📥" },
  { label: "Агент собирает факты", icon: "🔎", color: style.colors.accent },
  { label: "Черновик контента", icon: "✍️" },
  { label: "Готовый пост", icon: "🚀", color: style.colors.primary },
];

export const DiagramFlow: React.FC<Props> = ({ steps = DEFAULT, title, delaySec = 0, compact = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const local = Math.max(0, frame - start);
  const step = 14; // frames between nodes (node + its leading arrow)

  // Compact (Mode-A overlay, top-third): tighter, smaller, fewer steps.
  const shown = compact ? steps.slice(0, 4) : steps;
  const maxW = compact ? 760 : 860;
  const titleMb = compact ? 16 : 28;
  const arrowFont = compact ? 34 : 52;
  const arrowMargin = compact ? "6px 0" : "10px 0";
  const cardGap = compact ? 16 : 24;
  const cardPad = compact ? "16px 20px" : "26px 30px";
  const markFont = compact ? 34 : 52;
  const markSize = compact ? 38 : 56;
  const labelFont = compact ? 34 : 44; // ≥ LEGIBLE.bodyMin (34)

  return (
    <div
      style={{
        width: "100%",
        maxWidth: maxW,
        margin: "0 auto",
        paddingLeft: ZONES.sideGutter,
        paddingRight: ZONES.sideGutter,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {title && (
        <div
          style={{
            fontFamily: style.fonts.mono,
            fontSize: LEGIBLE.caption,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: style.colors.textSecondary,
            marginBottom: titleMb,
            textAlign: "center",
          }}
        >
          {title}
        </div>
      )}
      {shown.map((s, i) => {
        const nodeD = i * step;
        // The downward arrow that LEADS this node (between prev and this).
        const arrowD = nodeD - 6;
        const enter = spring({ frame: local - nodeD, fps, config: style.animation.spring.enter });
        const op = interpolate(local, [nodeD, nodeD + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const y = interpolate(enter, [0, 1], [40, 0]);
        const arrowOp =
          i === 0
            ? 0
            : interpolate(local, [arrowD, arrowD + 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
        const active = !!s.color;
        const accent = s.color ?? style.colors.cardBorder;
        return (
          <div
            key={i}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}
          >
            {/* leading downward arrow (not before the first node) */}
            {i > 0 && (
              <div
                style={{
                  fontFamily: style.fonts.heading,
                  fontWeight: 900,
                  fontSize: arrowFont,
                  lineHeight: 1,
                  color: style.colors.textSecondary,
                  opacity: arrowOp,
                  margin: arrowMargin,
                }}
              >
                ↓
              </div>
            )}
            {/* node card */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: cardGap,
                width: "100%",
                padding: cardPad,
                background: style.colors.cardBg,
                border: `1px solid ${active ? accent : style.colors.cardBorder}`,
                borderRadius: style.radius,
                boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
                opacity: op,
                transform: `translateY(${y}px)`,
              }}
            >
              {/* mark: logo or emoji */}
              {s.brand ? (
                <LogoMark brand={s.brand} size={markSize} inline />
              ) : s.icon ? (
                <span style={{ fontSize: markFont, lineHeight: 1 }}>{s.icon}</span>
              ) : (
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: active ? accent : style.colors.accent,
                    flexShrink: 0,
                  }}
                />
              )}
              {/* label */}
              <div
                style={{
                  fontFamily: style.fonts.heading,
                  fontWeight: 900,
                  fontSize: labelFont,
                  color: style.colors.textPrimary,
                  letterSpacing: -0.5,
                  lineHeight: 1.08,
                  flex: 1,
                }}
              >
                {s.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
