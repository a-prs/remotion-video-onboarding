import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { evolvePath, getLength, getPointAtLength, getTangentAtLength } from "@remotion/paths";
import { style } from "../stylekit";

/**
 * ConnectorSpine — the "connected thought" primitive (Andrey, 2026-07-23).
 * Cards appear one by one; between consecutive cards a CURVED ARROW grows
 * (evolvePath), and already-drawn arrows never fade → an accumulating "spine"
 * (проблема → решение → результат) that is fully readable with sound off.
 *
 * Wiring: plan act {type:"spineFlow", props:{nodes:[{label,sub?,accent?}], ...}}.
 */
type Node = { label: string; sub?: string; accent?: string };
type Props = {
  nodes?: Node[];
  delaySec?: number;
  /** Seconds between each node (card + its incoming connector) appearing. */
  stepSec?: number;
  /** Alternate left/right for a serpentine feel; false = straight column. */
  zig?: boolean;
};

const DEFAULT_NODES: Node[] = [
  { label: "Проблема", sub: "контекст путается" },
  { label: "Причина", sub: "всё в одном чате" },
  { label: "Решение", sub: "топик = проект", accent: "#5eead4" },
];

const GAP = 64; // px height of the connector zone between two cards
const CARD_W = 860; // use more of the safe width (SAFE_W=940, incl. ±46 zig)

export const ConnectorSpine: React.FC<Props> = ({
  nodes = DEFAULT_NODES,
  delaySec = 0,
  stepSec = 1.0,
  zig = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const step = Math.round(stepSec * fps);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: CARD_W }}>
      {nodes.map((n, i) => {
        const at = start + i * step;
        const enter = spring({
          frame: Math.max(0, frame - at),
          fps,
          config: style.animation.spring.gentle,
        });
        const op = interpolate(frame, [at, at + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const y = interpolate(enter, [0, 1], [26, 0]);
        const accent = n.accent ?? style.colors.textPrimary;
        // A card whose horizontal shift (for the serpentine) alternates.
        const dir = zig ? (i % 2 === 0 ? -1 : 1) : 0;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            {i > 0 && (
              <Connector
                frame={frame}
                grewAt={at - step + Math.round(0.15 * fps)}
                growDur={Math.round(0.5 * fps)}
                fromDir={zig ? (i % 2 === 0 ? 1 : -1) : 0}
                toDir={dir}
                accent={n.accent ?? style.colors.accent}
              />
            )}
            <div
              style={{
                width: "88%",
                transform: `translate(${dir * 46}px, ${y}px)`,
                opacity: op,
                padding: "20px 26px",
                borderRadius: style.radius,
                background: style.colors.cardBg,
                border: `1px solid ${style.colors.cardBorder}`,
              }}
            >
              <div style={{ fontFamily: style.fonts.heading, fontWeight: 900, fontSize: 52, color: accent, overflowWrap: "anywhere" }}>
                {n.label}
              </div>
              {n.sub && (
                <div style={{ fontFamily: style.fonts.mono, fontSize: 27, color: style.colors.textSecondary, marginTop: 6, overflowWrap: "anywhere" }}>
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

/** One growing curved arrow occupying the GAP zone between two cards. */
const Connector: React.FC<{
  frame: number;
  grewAt: number;
  growDur: number;
  fromDir: number;
  toDir: number;
  accent: string;
}> = ({ frame, grewAt, growDur, fromDir, toDir, accent }) => {
  const w = CARD_W;
  const h = GAP;
  const x0 = w / 2 + fromDir * 46;
  const x1 = w / 2 + toDir * 46;
  // Cubic curve from bottom of the previous card to top of the next.
  const d = `M ${x0} 0 C ${x0} ${h * 0.5}, ${x1} ${h * 0.5}, ${x1} ${h}`;
  const progress = interpolate(frame, [grewAt, grewAt + growDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, d);
  // Arrowhead: sit at the path end, rotated along the tangent.
  // getPointAtLength/getTangentAtLength return null past/AT the path's own
  // length (Remotion v5+ API change) - querying exactly `len` always hit
  // this, so clamp just under it.
  const len = getLength(d);
  const tipLen = Math.max(0, len - 0.01);
  const tip = getPointAtLength(d, tipLen) ?? { x: 0, y: 0 };
  const tan = getTangentAtLength(d, tipLen) ?? { x: 1, y: 0 };
  const ang = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
  const headOp = interpolate(progress, [0.82, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <path
        d={d}
        fill="none"
        stroke={accent}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
      />
      <g transform={`translate(${tip.x}, ${tip.y}) rotate(${ang})`} opacity={headOp}>
        <path d="M 0 0 L -12 -6 L -12 6 Z" fill={accent} />
      </g>
    </svg>
  );
};
