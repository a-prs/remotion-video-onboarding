import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
import { fitText } from "@remotion/layout-utils";
import { style } from "../../stylekit";
import { SAFE_W } from "./safe";

// Shrink a node label so it never runs past the frame edge (Andrey 2026-07-23).
function fitFS(text: string, w: number, base: number): number {
  const f = fitText({ text: text || "", withinWidth: w, fontFamily: style.fonts.heading, fontWeight: 900 });
  return Math.max(18, Math.min(base, f.fontSize));
}

/**
 * SerpentineLens — a long CONNECTED chain of nodes that winds down the screen,
 * with a magnifier "lens" that RIDES ALONG the path node-to-node in sync with
 * speech (Andrey, 2026-07-23). The whole algorithm is one unbroken thread and the
 * camera physically travels it → connectedness is undeniable with sound off.
 *
 * Plan act {type:"lensPath", props:{nodes:[{label,sub?}], ...}}.
 */
type Node = { label: string; sub?: string };
type Props = { nodes?: Node[]; delaySec?: number; spanSec?: number };

const DEFAULT_NODES: Node[] = [
  { label: "Запрос" },
  { label: "Роутер" },
  { label: "Агент" },
  { label: "Проверка" },
  { label: "Ответ" },
];

const W = SAFE_W; // 940 — use the full safe width
const H = 980;

export const SerpentineLens: React.FC<Props> = ({
  nodes = DEFAULT_NODES,
  delaySec = 0,
  spanSec = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const span = Math.round(spanSec * fps);

  // Node positions on a serpentine (alternating columns, marching down).
  const n = nodes.length;
  const pad = 120;
  const usableH = H - pad * 2;
  const pts = nodes.map((_, i) => ({
    x: i % 2 === 0 ? W * 0.30 : W * 0.70,
    y: pad + (usableH * i) / (n - 1),
  }));
  // Smooth path threading the nodes (vertical S-curves between columns).
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < n; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const my = (a.y + b.y) / 2;
    d += ` C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  }
  const total = getLength(d);

  // Path draws in over the first 40% of the span; lens rides it across the whole.
  const drawP = interpolate(frame, [start, start + span * 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rideP = interpolate(frame, [start, start + span], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const { strokeDasharray, strokeDashoffset } = evolvePath(drawP, d);
  const lens = getPointAtLength(d, total * rideP);
  // Nearest node to the lens = the "focused" one.
  const focus = pts.reduce(
    (best, p, i) => {
      const dist = Math.hypot(p.x - lens.x, p.y - lens.y);
      return dist < best.dist ? { i, dist } : best;
    },
    { i: 0, dist: Infinity }
  ).i;

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      {/* the connected thread */}
      <path
        d={d}
        fill="none"
        stroke={style.colors.accent}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        opacity={0.85}
      />
      {/* nodes */}
      {pts.map((p, i) => {
        const active = i === focus;
        const appeared = drawP >= i / (n - 1) - 0.02;
        return (
          <g key={i} opacity={appeared ? (active ? 1 : 0.4) : 0}>
            <circle cx={p.x} cy={p.y} r={active ? 12 : 7} fill={active ? style.colors.accent : style.colors.textSecondary} />
            <text
              x={p.x + (i % 2 === 0 ? 32 : -32)}
              y={p.y + 12}
              textAnchor={i % 2 === 0 ? "start" : "end"}
              fontFamily={style.fonts.heading}
              fontWeight={900}
              fontSize={fitFS(nodes[i].label, 380, active ? 48 : 38)}
              fill={active ? style.colors.textPrimary : style.colors.textSecondary}
            >
              {nodes[i].label}
            </text>
          </g>
        );
      })}
      {/* the traveling lens */}
      <g>
        <circle cx={lens.x} cy={lens.y} r={54} fill="none" stroke={style.colors.accent} strokeWidth={4} />
        <circle cx={lens.x} cy={lens.y} r={54} fill={style.colors.accent} opacity={0.08} />
      </g>
    </svg>
  );
};
