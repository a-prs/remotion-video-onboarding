import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { style } from "../../stylekit";

/**
 * Terminal — a chrome window with lines that type/appear in sequence.
 * Vertical-friendly: full width, monospace, big enough to read on a phone.
 * Dummy lines by default.
 */
type Line = { text: string; color?: string };
type Props = {
  lines?: Line[];
  delaySec?: number;
  title?: string;
  /** Seconds between each line appearing. */
  stepSec?: number;
};

const DEFAULT_LINES: Line[] = [
  { text: "$ reels-hunter --discover", color: style.colors.accent },
  { text: "→ найдено 18 видео за 48ч" },
  { text: "→ ранжирую по вовлечённости…" },
  { text: "✓ топ-3 готовы", color: style.colors.positive },
];

export const Terminal: React.FC<Props> = ({
  lines = DEFAULT_LINES,
  delaySec = 0,
  title = "agent — zsh",
  stepSec = 0.7,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const step = Math.round(stepSec * fps);

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 20,
        overflow: "hidden",
        background: "rgba(6,5,16,0.78)",
        border: "1px solid rgba(124,92,252,0.3)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 22px",
          background: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: style.colors.winClose }} />
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: style.colors.winMin }} />
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: style.colors.winMax }} />
        <div
          style={{
            marginLeft: 12,
            fontFamily: "monospace",
            fontSize: 24,
            color: "rgba(240,238,255,0.5)",
          }}
        >
          {title}
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: "26px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        {lines.map((ln, i) => {
          const at = start + i * step;
          const op = interpolate(frame, [at, at + 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const x = interpolate(frame, [at, at + 8], [-16, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                opacity: op,
                transform: `translateX(${x}px)`,
                fontFamily: "monospace",
                fontSize: 34,
                lineHeight: 1.3,
                color: ln.color ?? style.colors.textPrimary,
              }}
            >
              {ln.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};
