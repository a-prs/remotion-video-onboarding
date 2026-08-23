import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { style } from "../stylekit";

/**
 * CodeAppear (vertical) — a code window whose lines slide in one by one with naive
 * syntax highlighting, ported from the 16:9 branch to the 9:16 bank (Andrey,
 * 2026-06-27). Phone-readable: full width, big mono, line numbers.
 *
 * Frame convention mirrors Terminal: global frame + `delaySec` = act.at; line i
 * appears at delaySec + (i * stepSec).
 */
type Props = {
  lines?: string[];
  title?: string;
  delaySec?: number;
  fontSize?: number;
  stepSec?: number;
};

const DEFAULT_LINES = [
  "const agent = new Agent();",
  "await agent.run(task); // делает сам",
];

export const CodeAppear: React.FC<Props> = ({
  lines = DEFAULT_LINES,
  title = "agent.ts",
  delaySec = 0,
  fontSize = 32,
  stepSec = 0.5,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const step = Math.round(stepSec * fps);

  const win = spring({ frame: frame - start, fps, config: { damping: 16, mass: 0.8, stiffness: 110 } });
  const winScale = interpolate(win, [0, 1], [0.92, 1]);
  const winOpacity = interpolate(frame, [start, start + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        width: "100%",
        transform: `scale(${winScale})`,
        opacity: winOpacity,
        borderRadius: 20,
        overflow: "hidden",
        background: "rgba(6,5,16,0.82)",
        border: "1px solid rgba(124,92,252,0.3)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {/* Chrome bar */}
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
        {[style.colors.winClose, style.colors.winMin, style.colors.winMax].map((c) => (
          <div key={c} style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />
        ))}
        <div style={{ marginLeft: 12, fontFamily: style.fonts.mono, fontSize: 24, color: "rgba(240,238,255,0.5)" }}>
          {title}
        </div>
      </div>

      {/* Code lines */}
      <div style={{ padding: "26px 28px", background: style.colors.bg }}>
        {lines.map((line, i) => {
          const at = start + 6 + i * step;
          if (frame < at) return null;
          const op = interpolate(frame, [at, at + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const x = interpolate(frame, [at, at + 8], [26, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                opacity: op,
                transform: `translateX(${x}px)`,
                fontFamily: style.fonts.mono,
                fontSize,
                lineHeight: 1.7,
                whiteSpace: "pre",
                display: "flex",
              }}
            >
              <span style={{ color: "rgba(240,238,255,0.22)", width: 44, textAlign: "right", marginRight: 22, userSelect: "none", flexShrink: 0 }}>
                {i + 1}
              </span>
              <span dangerouslySetInnerHTML={{ __html: colorize(line) }} style={{ flex: 1 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Naive syntax highlighter for visual effect (same palette as the 16:9 twin).
function colorize(line: string): string {
  const primary = style.colors.primary;
  const accent = style.colors.accent;
  const textSec = "rgba(240,238,255,0.5)";
  const str = "#a0f7e7";

  return line
    .replace(/\/\/.*/g, (m) => `<span style="color:${textSec};font-style:italic">${m}</span>`)
    .replace(/"([^"]*)"/g, (_, p1) => `<span style="color:${str}">"${p1}"</span>`)
    .replace(/'([^']*)'/g, (_, p1) => `<span style="color:${str}">'${p1}'</span>`)
    .replace(
      /\b(const|let|var|function|return|import|from|export|async|await|if|else|for|while|new|class|type|interface)\b/g,
      (m) => `<span style="color:${primary}">${m}</span>`
    )
    .replace(/\b(true|false|null|undefined|console)\b/g, (m) => `<span style="color:${accent}">${m}</span>`)
    .replace(/(\.\w+)\(/g, (_, p1) => `<span style="color:${accent}">${p1}</span>(`);
}
