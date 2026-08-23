import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { evolvePath } from "@remotion/paths";
import { fitText } from "@remotion/layout-utils";
import { style } from "../stylekit";
import { SAFE_W } from "./safe";

// Font size that keeps `text` inside `w` px on one line (capped at base), so a
// long label shrinks instead of spilling past the card / frame (Andrey 2026-07-23).
function fitFS(text: string, w: number, base: number): number {
  const f = fitText({ text: text || "", withinWidth: w, fontFamily: style.fonts.heading, fontWeight: 900 });
  return Math.max(18, Math.min(base, f.fontSize));
}

/**
 * NodeSplit — «разделить / развести / два пути / по разным» (Andrey, 2026-07-23):
 * one root node SPLITS into 2-3 branches — lines grow (evolvePath) from the root
 * out to branch cards. Reads the "one → many" fork with sound off.
 *
 * Sizing (Andrey, 2026-07-23): branches spread across the full safe width with
 * comfortable gaps — bigger cards/text — while edge cards stay inside the frame.
 *
 * Plan act {type:"nodeSplit", props:{root, branches:[{label}], ...}}.
 */
type Branch = { label: string };
type Props = { root?: string; branches?: Branch[]; delaySec?: number };

const DEFAULT_BRANCHES: Branch[] = [
  { label: "Проект A" },
  { label: "Проект B" },
  { label: "Проект C" },
];

const W = SAFE_W; // 940 — use the full safe width
const H = 660;

export const NodeSplit: React.FC<Props> = ({
  root = "Один чат",
  branches = DEFAULT_BRANCHES,
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const rootX = W / 2;
  const rootY = 130;
  const nb = Math.max(1, branches.length);
  const bY = H - 150;
  // Even slots across the safe width → branch card width adapts, gaps guaranteed.
  const slot = W / nb;
  const bw = Math.min(280, slot - 44);
  const bxs = branches.map((_, i) => slot * (i + 0.5));

  const rootEnter = spring({ frame: Math.max(0, frame - start), fps, config: style.animation.spring.gentle });
  const rootW = 340;

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      {/* growing branch lines */}
      {branches.map((_, i) => {
        const bx = bxs[i];
        const d = `M ${rootX} ${rootY + 34} C ${rootX} ${(rootY + bY) / 2}, ${bx} ${(rootY + bY) / 2}, ${bx} ${bY - 64}`;
        const at = start + Math.round(0.35 * fps) + i * Math.round(0.12 * fps);
        const p = interpolate(frame, [at, at + Math.round(0.5 * fps)], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const { strokeDasharray, strokeDashoffset } = evolvePath(p, d);
        return (
          <path key={i} d={d} fill="none" stroke={style.colors.accent} strokeWidth={3} strokeLinecap="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} opacity={0.85} />
        );
      })}
      {/* root node */}
      <g opacity={rootEnter} transform={`scale(${0.8 + rootEnter * 0.2})`} style={{ transformOrigin: `${rootX}px ${rootY}px` }}>
        <rect x={rootX - rootW / 2} y={rootY - 52} width={rootW} height={104} rx={14} fill={style.colors.cardBg} stroke={style.colors.cardBorder} />
        <text x={rootX} y={rootY + 14} textAnchor="middle" fontFamily={style.fonts.heading} fontWeight={900} fontSize={fitFS(root, rootW - 48, 52)} fill={style.colors.textPrimary}>
          {root}
        </text>
      </g>
      {/* branch cards */}
      {branches.map((b, i) => {
        const at = start + Math.round(0.7 * fps) + i * Math.round(0.12 * fps);
        const enter = spring({ frame: Math.max(0, frame - at), fps, config: style.animation.spring.gentle });
        const bx = bxs[i];
        return (
          <g key={i} opacity={enter}>
            <rect x={bx - bw / 2} y={bY - 54} width={bw} height={112} rx={12} fill={style.colors.cardBg} stroke={style.colors.accent} strokeWidth={2} />
            <text x={bx} y={bY + 12} textAnchor="middle" fontFamily={style.fonts.heading} fontWeight={900} fontSize={fitFS(b.label, bw - 32, 40)} fill={style.colors.textPrimary}>
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
