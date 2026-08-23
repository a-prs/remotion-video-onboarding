import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { style } from "../stylekit";
import { LEGIBLE } from "./format";

/**
 * DonutChart — animated ring with a center value. Vertical-friendly (big).
 * The sweep grows from 0 → `value`% via spring; dummy data by default.
 */
type Props = {
  value?: number; // 0–100
  label?: string;
  color?: string;
  size?: number;
  delaySec?: number;
};

export const DonutChart: React.FC<Props> = ({
  value = 73,
  label = "автоматизировано",
  color = style.colors.accent,
  size = 380,
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - Math.round(delaySec * fps));

  const grow = spring({ frame: local, fps, config: { damping: 16, mass: 0.8, stiffness: 90 } });
  const shown = interpolate(grow, [0, 1], [0, value]);

  const stroke = 34;
  // Leave room INSIDE the box for the ring's glow so the SVG filter region
  // doesn't clip it into a rectangle (Andrey, 2026-06-16).
  const glowPad = 26;
  const r = (size - stroke) / 2 - glowPad;
  const circ = 2 * Math.PI * r;
  const dash = (shown / 100) * circ;

  return (
    <div style={{ position: "relative", width: size, height: size, overflow: "visible" }}>
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)", overflow: "visible" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(240,238,255,0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ filter: `drop-shadow(0 0 16px ${color})` }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: style.fonts.heading,
            fontWeight: 800,
            fontSize: 96,
            color: style.colors.textPrimary,
          }}
        >
          {Math.round(shown)}%
        </div>
        <div
          style={{
            fontFamily: style.fonts.body,
            fontSize: LEGIBLE.caption,
            color: style.colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
};
