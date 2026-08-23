import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../stylekit";
import { ZONES } from "./format";

/**
 * WorkspaceScene — a simulated desktop reflowed VERTICAL. Top: a file-tree panel
 * (projectName as root + files revealing staggered, mono, small ▸ file icons).
 * Bottom: a terminal panel (mono prompt + terminalCmd typed out, then
 * terminalOutput). Flat windows, thin borders + title bars (Terminal.tsx look).
 * NO glow. Fullscreen act.
 */
type Props = {
  projectName?: string;
  files?: string[];
  terminalCmd?: string;
  terminalOutput?: string;
  delaySec?: number;
};

const DEFAULT_FILES = [
  "app.py",
  "worker.py",
  "config.yaml",
  "skills/",
  "README.md",
];

export const WorkspaceScene: React.FC<Props> = ({
  projectName = "office-agent",
  files = DEFAULT_FILES,
  terminalCmd = "python app.py --run",
  terminalOutput = "✓ агент запущен · слушаю задачи",
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const local = Math.max(0, frame - start);

  // ── File-tree panel ──────────────────────────────────────────────
  const treeEnter = spring({ frame: local, fps, config: style.animation.spring.enter });
  const treeY = interpolate(treeEnter, [0, 1], [40, 0]);
  const treeOp = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Terminal panel (staggered after the tree) ────────────────────
  const termDelay = 12;
  const termEnter = spring({
    frame: local - termDelay,
    fps,
    config: style.animation.spring.enter,
  });
  const termY = interpolate(termEnter, [0, 1], [40, 0]);
  const termOp = interpolate(local, [termDelay, termDelay + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // typewriter for the command — reveal char by char after terminal lands.
  const cmdStart = termDelay + 8;
  const cmdChars = Math.round(
    interpolate(local, [cmdStart, cmdStart + terminalCmd.length * 1.2], [0, terminalCmd.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const typedCmd = terminalCmd.slice(0, cmdChars);
  const cmdDone = cmdChars >= terminalCmd.length;
  const outStart = cmdStart + terminalCmd.length * 1.2 + 6;
  const outOp = interpolate(local, [outStart, outStart + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleBarStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 22px",
    background: "rgba(255,255,255,0.04)",
    borderBottom: `1px solid ${style.colors.cardBorder}`,
  };
  const dots = (
    <div style={{ display: "flex", gap: 8 }}>
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1080 - ZONES.sideGutter * 2,
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      {/* ── File-tree window ── */}
      <div
        style={{
          width: "100%",
          borderRadius: style.radius,
          overflow: "hidden",
          background: style.colors.cardBg,
          border: `1px solid ${style.colors.cardBorder}`,
          boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
          opacity: treeOp,
          transform: `translateY(${treeY}px)`,
        }}
      >
        <div style={titleBarStyle}>
          {dots}
          <div
            style={{
              fontFamily: style.fonts.mono,
              fontSize: 28,
              letterSpacing: 1,
              color: style.colors.textMono,
            }}
          >
            EXPLORER
          </div>
        </div>
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* root */}
          <div
            style={{
              fontFamily: style.fonts.mono,
              fontSize: 36,
              color: style.colors.accent,
            }}
          >
            ▾ {projectName}/
          </div>
          {files.map((f, i) => {
            const d = 6 + i * 6;
            const op = interpolate(local, [d, d + 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const x = interpolate(local, [d, d + 8], [-16, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const isDir = f.endsWith("/");
            return (
              <div
                key={i}
                style={{
                  marginLeft: 38,
                  fontFamily: style.fonts.mono,
                  fontSize: 32,
                  color: isDir ? style.colors.textPrimary : style.colors.textMono,
                  opacity: op,
                  transform: `translateX(${x}px)`,
                }}
              >
                {isDir ? "▸ " : "▪ "}
                {f}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Terminal window ── */}
      <div
        style={{
          width: "100%",
          borderRadius: style.radius,
          overflow: "hidden",
          background: style.colors.cardBg,
          border: `1px solid ${style.colors.cardBorder}`,
          boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
          opacity: termOp,
          transform: `translateY(${termY}px)`,
        }}
      >
        <div style={titleBarStyle}>
          {dots}
          <div
            style={{
              fontFamily: style.fonts.mono,
              fontSize: 28,
              letterSpacing: 1,
              color: style.colors.textMono,
            }}
          >
            {projectName} — zsh
          </div>
        </div>
        <div style={{ padding: "26px 28px", display: "flex", flexDirection: "column", gap: 16, minHeight: 140 }}>
          <div
            style={{
              fontFamily: style.fonts.mono,
              fontSize: 34,
              lineHeight: 1.3,
              color: style.colors.textPrimary,
            }}
          >
            <span style={{ color: style.colors.accent }}>$ </span>
            {typedCmd}
            {!cmdDone && <span style={{ color: style.colors.textSecondary }}>▌</span>}
          </div>
          <div
            style={{
              fontFamily: style.fonts.mono,
              fontSize: 32,
              lineHeight: 1.3,
              color: style.colors.primaryLight,
              opacity: outOp,
            }}
          >
            {terminalOutput}
          </div>
        </div>
      </div>
    </div>
  );
};
