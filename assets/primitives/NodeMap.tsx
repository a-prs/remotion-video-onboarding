import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { style } from "../../stylekit";

/**
 * NodeMap — the "control map" motif from the references: agent/skill nodes on a
 * vertical spine, code-named (name.suffix, suffix in accent), revealed in
 * sequence with the connecting line drawing in. Vertical-friendly (top→bottom).
 */
type Node = { name: string; suffix?: string; sub?: string; accent?: string };
type Props = {
  nodes?: Node[];
  delaySec?: number;
  /** Seconds between each node appearing. */
  stepSec?: number;
};

const DEFAULT_NODES: Node[] = [
  { name: "brief", suffix: ".in", sub: "one job enters the system" },
  { name: "research", suffix: ".agent", sub: "facts · sources · proof" },
  { name: "viral-radar", suffix: ".agent", sub: "hooks · timing windows" },
  { name: "content", suffix: ".agent", sub: "strategy → formats" },
  { name: "shortform", suffix: ".skill", sub: "reels · shorts", accent: style.colors.primary },
];

export const NodeMap: React.FC<Props> = ({
  nodes = DEFAULT_NODES,
  delaySec = 0,
  stepSec = 0.6,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const step = Math.round(stepSec * fps);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
      {nodes.map((n, i) => {
        const at = start + i * step;
        const enter = spring({
          frame: Math.max(0, frame - at),
          fps,
          config: { damping: 16, mass: 0.7, stiffness: 110 },
        });
        const op = interpolate(frame, [at, at + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const x = interpolate(enter, [0, 1], [40, 0]);
        // Connector line to the previous node draws in.
        const lineH = i === 0 ? 0 : 40;
        const lineGrow = interpolate(frame, [at - step + 2, at], [0, lineH], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const accent = n.accent ?? style.colors.accent;
        return (
          <div key={i} style={{ display: "flex", gap: 22 }}>
            {/* Spine column: line + node dot */}
            <div style={{ width: 18, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 2, height: lineGrow, background: "rgba(255,255,255,0.25)" }} />
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: accent,
                  opacity: op,
                  flexShrink: 0,
                }}
              />
            </div>
            {/* Node box */}
            <div
              style={{
                flex: 1,
                marginBottom: 8,
                padding: "18px 22px",
                borderRadius: 10,
                background: style.colors.cardBg,
                border: `1px solid ${style.colors.cardBorder}`,
                opacity: op,
                transform: `translateX(${x}px)`,
              }}
            >
              <div style={{ fontFamily: style.fonts.mono, fontSize: 38, color: style.colors.textPrimary }}>
                {n.name}
                {n.suffix && <span style={{ color: accent }}>{n.suffix}</span>}
              </div>
              {n.sub && (
                <div
                  style={{
                    fontFamily: style.fonts.mono,
                    fontSize: 22,
                    letterSpacing: 1,
                    color: style.colors.textSecondary,
                    marginTop: 4,
                  }}
                >
                  {n.sub}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
