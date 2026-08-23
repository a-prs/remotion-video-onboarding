import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../stylekit";

/**
 * Spotlight — dims everything, lights up ONE card (Andrey/critic, 2026-07-23):
 * for «фокус на / вот в чём суть / главное». The reveal beat.
 *
 * Plan act {type:"spotlight", props:{cards:[{label}], focusIndex}}.
 */
type Card = { label: string };
type Props = { cards?: Card[]; focusIndex?: number; delaySec?: number };

const DEFAULT_CARDS: Card[] = [{ label: "Идея" }, { label: "Спрос" }, { label: "Оффер" }];

export const Spotlight: React.FC<Props> = ({ cards = DEFAULT_CARDS, focusIndex = 1, delaySec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  // Dimming + focus ramps in over ~0.5s.
  const p = interpolate(frame, [start, start + Math.round(0.5 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, width: 600 }}>
      {cards.map((c, i) => {
        const focused = i === focusIndex;
        const enter = spring({ frame: Math.max(0, frame - start - i * 4), fps, config: style.animation.spring.gentle });
        const op = focused ? 1 : interpolate(p, [0, 1], [1, 0.22]);
        const scale = interpolate(enter, [0, 1], [0.9, focused ? 1 + p * 0.06 : 1]);
        return (
          <div
            key={i}
            style={{
              width: "82%",
              padding: "26px 30px",
              borderRadius: style.radius,
              background: style.colors.cardBg,
              border: `1px solid ${focused ? style.colors.accent : style.colors.cardBorder}`,
              opacity: op,
              transform: `scale(${scale})`,
              boxShadow: focused ? `0 0 0 ${2 + p * 3}px rgba(94,234,212,${0.25 * p}), 0 20px 60px rgba(0,0,0,0.5)` : "none",
            }}
          >
            <div
              style={{
                fontFamily: style.fonts.heading,
                fontWeight: 900,
                fontSize: 52,
                color: focused ? style.colors.accent : style.colors.textPrimary,
                textAlign: "center",
                overflowWrap: "anywhere",
              }}
            >
              {c.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
