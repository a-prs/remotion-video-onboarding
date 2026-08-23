import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { style } from "../stylekit";

/**
 * NumberedRows — the "01 / 02 / 03" tabular list from the references. Mono
 * numbers + grotesk labels in thin bordered rows, revealed in sequence.
 */
type Row = { label: string; accent?: boolean };
type Props = {
  rows?: Row[];
  delaySec?: number;
  stepSec?: number;
};

const DEFAULT_ROWS: Row[] = [
  { label: "before & after videos" },
  { label: "client stories" },
  { label: "progress updates" },
  { label: "estimate explainers" },
  { label: "FAQ videos", accent: true },
];

export const NumberedRows: React.FC<Props> = ({
  rows = DEFAULT_ROWS,
  delaySec = 0,
  stepSec = 0.45,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const step = Math.round(stepSec * fps);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
      {rows.map((row, i) => {
        const at = start + i * step;
        const enter = spring({ frame: Math.max(0, frame - at), fps, config: style.animation.spring.gentle });
        const op = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const x = interpolate(enter, [0, 1], [40, 0]);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 22,
              padding: "20px 26px",
              borderRadius: 10,
              background: style.colors.cardBg,
              border: `1px solid ${row.accent ? style.colors.accent : style.colors.cardBorder}`,
              opacity: op,
              transform: `translateX(${x}px)`,
            }}
          >
            <span
              style={{
                fontFamily: style.fonts.mono,
                fontSize: 26,
                color: row.accent ? style.colors.accent : style.colors.textSecondary,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              style={{
                fontFamily: style.fonts.body,
                fontWeight: 700,
                fontSize: 40,
                color: style.colors.textPrimary,
              }}
            >
              {row.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
