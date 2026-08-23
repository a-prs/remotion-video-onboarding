import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../../stylekit";

/**
 * Swarm — one dot MULTIPLIES into a grid/swarm of copies (critic, 2026-07-23): for
 * «сотни / тысячи / рой / пачками / завалило». Gives "many" without reading a number.
 *
 * Plan act {type:"swarm", props:{count, label?}}.
 */
type Props = { count?: number; label?: string; delaySec?: number };

const W = 640;
const H = 640;

export const Swarm: React.FC<Props> = ({ count = 48, label = "сотни", delaySec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const gap = 74;
  const gridW = (cols - 1) * gap;
  const gridH = (rows - 1) * gap;
  const cx = W / 2;
  const cy = H / 2;

  return (
    <div style={{ position: "relative", width: W, height: H }}>
      {Array.from({ length: count }).map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const at = start + i * 1.2; // fast stagger → looks like a burst
        const pop = spring({ frame: Math.max(0, frame - at), fps, config: style.animation.spring.enter });
        const tx = cx - gridW / 2 + col * gap;
        const ty = cy - gridH / 2 + row * gap;
        // fly out from centre to the grid slot
        const x = interpolate(pop, [0, 1], [cx, tx]);
        const y = interpolate(pop, [0, 1], [cy, ty]);
        const first = i === 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 18,
              top: y - 18,
              width: 36,
              height: 36,
              borderRadius: 10,
              background: first ? style.colors.accent : style.colors.primary,
              opacity: first ? 1 : pop,
              transform: `scale(${0.6 + pop * 0.4})`,
            }}
          />
        );
      })}
      {label && (
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: -8,
            width: "100%",
            textAlign: "center",
            fontFamily: style.fonts.heading,
            fontWeight: 900,
            fontSize: 48,
            color: style.colors.accent,
            overflowWrap: "anywhere",
            lineHeight: 1.1,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
