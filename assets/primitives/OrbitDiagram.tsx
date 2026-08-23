import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../../stylekit";
import { ZONES, LEGIBLE } from "../format";
import { LogoMark } from "../LogoMark";

/**
 * OrbitDiagram — a central core (teal-bordered disc) with items arranged AROUND
 * it on a ring. Reflowed for 9:16: a fixed 900×1100 stage, items placed on a
 * circle via sin/cos. Each item reveals staggered with a thin connector line to
 * the core. Logo/emoji per item. Flat, NO glow. Fullscreen act.
 */
type Item = { label: string; icon?: string; brand?: string };
type Props = {
  center: string;
  items?: Item[];
  title?: string;
  description?: string;
  delaySec?: number;
};

const DEFAULT_ITEMS: Item[] = [
  { label: "Ресёрч", icon: "🔎" },
  { label: "Контент", icon: "✍️" },
  { label: "Reels", icon: "🎬" },
  { label: "Постинг", icon: "📤" },
  { label: "Аналитика", icon: "📊" },
  { label: "QA", icon: "✅" },
];

// Fixed stage geometry (px).
const STAGE_W = 900;
const STAGE_H = 1100;
const CX = STAGE_W / 2;
const CY = STAGE_H / 2;
const CORE = 220; // core disc diameter
const RADIUS = 360; // orbit radius (center → item center)
const ITEM_W = 220;
const ITEM_H = 120;

export const OrbitDiagram: React.FC<Props> = ({
  center,
  items = DEFAULT_ITEMS,
  title,
  description,
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const local = Math.max(0, frame - start);
  const step = 8;

  const coreEnter = spring({ frame: local, fps, config: style.animation.spring.enter });
  const coreScale = interpolate(coreEnter, [0, 1], [0.6, 1]);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
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
            textAlign: "center",
          }}
        >
          {title}
        </div>
      )}

      {/* fixed-size orbit stage */}
      <div style={{ position: "relative", width: STAGE_W, height: STAGE_H }}>
        {/* connector lines + items (drawn first so the core sits on top) */}
        {items.map((it, i) => {
          // start at top (-90deg), go clockwise
          const ang = (-90 + (360 / items.length) * i) * (Math.PI / 180);
          const ix = CX + Math.cos(ang) * RADIUS;
          const iy = CY + Math.sin(ang) * RADIUS;
          const d = 10 + i * step;
          const enter = spring({ frame: local - d, fps, config: style.animation.spring.enter });
          const op = interpolate(local, [d, d + 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const scale = interpolate(enter, [0, 1], [0.7, 1]);
          // connector: from core edge to item edge
          const lineLen = RADIUS - CORE / 2 - 8;
          const lineGrow = interpolate(local, [d - 4, d + 6], [0, lineLen], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const lineAngDeg = (ang * 180) / Math.PI;
          const accent = i % 2 === 0 ? style.colors.accent : style.colors.primary;
          return (
            <div key={i}>
              {/* thin connector line from core toward the item */}
              <div
                style={{
                  position: "absolute",
                  left: CX,
                  top: CY,
                  width: lineGrow,
                  height: 2,
                  background: "rgba(255,255,255,0.22)",
                  transformOrigin: "left center",
                  transform: `translateX(${CORE / 2 + 4}px) rotate(${lineAngDeg}deg)`,
                }}
              />
              {/* item card */}
              <div
                style={{
                  position: "absolute",
                  left: ix - ITEM_W / 2,
                  top: iy - ITEM_H / 2,
                  width: ITEM_W,
                  minHeight: ITEM_H,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "16px 18px",
                  background: style.colors.cardBg,
                  border: `1px solid ${style.colors.cardBorder}`,
                  borderRadius: style.radius,
                  boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
                  opacity: op,
                  transform: `scale(${scale})`,
                }}
              >
                {it.brand ? (
                  <LogoMark brand={it.brand} size={44} inline />
                ) : it.icon ? (
                  <span style={{ fontSize: 42, lineHeight: 1 }}>{it.icon}</span>
                ) : (
                  <div
                    style={{ width: 12, height: 12, borderRadius: "50%", background: accent }}
                  />
                )}
                <div
                  style={{
                    fontFamily: style.fonts.heading,
                    fontWeight: 900,
                    fontSize: 32,
                    color: style.colors.textPrimary,
                    letterSpacing: -0.3,
                    textAlign: "center",
                    lineHeight: 1.05,
                  }}
                >
                  {it.label}
                </div>
              </div>
            </div>
          );
        })}

        {/* central core disc */}
        <div
          style={{
            position: "absolute",
            left: CX - CORE / 2,
            top: CY - CORE / 2,
            width: CORE,
            height: CORE,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 18,
            background: style.colors.cardBg,
            border: `2px solid ${style.colors.accent}`,
            boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
            transform: `scale(${coreScale})`,
          }}
        >
          <div
            style={{
              fontFamily: style.fonts.heading,
              fontWeight: 900,
              fontSize: 40,
              color: style.colors.textPrimary,
              letterSpacing: -0.5,
              lineHeight: 1.05,
            }}
          >
            {center}
          </div>
        </div>
      </div>

      {description && (
        <div
          style={{
            fontFamily: style.fonts.body,
            fontSize: LEGIBLE.body,
            color: style.colors.textSecondary,
            textAlign: "center",
            maxWidth: 820,
            lineHeight: 1.3,
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
};
