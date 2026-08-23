import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { style } from "../../stylekit";
import { LEGIBLE } from "../format";

/**
 * BarCompare — horizontal bars that grow in, staggered. Vertical-friendly:
 * bars stack top→bottom, full width. Dummy data by default.
 */
type Bar = { label: string; value: number; color?: string };
type Props = {
  bars?: Bar[];
  delaySec?: number;
  /** Max value for scaling; defaults to the largest bar. */
  max?: number;
};

const DEFAULT_BARS: Bar[] = [
  { label: "Руками", value: 40, color: "rgba(240,238,255,0.35)" },
  { label: "С агентом", value: 92, color: style.colors.primary },
  { label: "Цель", value: 100, color: style.colors.accent },
];

export const BarCompare: React.FC<Props> = ({
  bars = DEFAULT_BARS,
  delaySec = 0,
  max,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const top = max ?? Math.max(...bars.map((b) => b.value));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30, width: "100%" }}>
      {bars.map((b, i) => {
        const at = start + i * 8;
        const grow = spring({
          frame: Math.max(0, frame - at),
          fps,
          config: { damping: 15, mass: 0.7, stiffness: 95 },
        });
        const w = interpolate(grow, [0, 1], [0, (b.value / top) * 100]);
        return (
          <div key={b.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 10,
                fontFamily: style.fonts.body,
                fontSize: LEGIBLE.body,
                fontWeight: 600,
                color: style.colors.textPrimary,
              }}
            >
              <span>{b.label}</span>
              <span style={{ color: b.color }}>{Math.round((w / 100) * top)}</span>
            </div>
            <div
              style={{
                height: 46,
                borderRadius: 14,
                background: "rgba(240,238,255,0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${w}%`,
                  height: "100%",
                  borderRadius: 14,
                  background: b.color ?? style.colors.primary,
                  boxShadow: `0 0 24px ${b.color ?? style.colors.primary}`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
