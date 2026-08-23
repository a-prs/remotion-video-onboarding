import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { getLength, getPointAtLength } from "@remotion/paths";
import { measureText } from "@remotion/layout-utils";
import { style } from "../stylekit";
import { SAFE_W } from "./safe";

/**
 * PipelineFlow — the automation motif (Andrey, 2026-07-23): вход → трансформ →
 * выход, with a "packet" travelling the belt and a gear spinning («автоматом»).
 *
 * Text-robustness (2026-07-23): chips AUTO-WIDTH to their label (measureText),
 * and the whole row SCALES DOWN to stay within SAFE_W — chips never overlap or
 * spill past the frame, however long the labels.
 *
 * Plan act {type:"pipeline", props:{steps:[{label}], ...}}.
 */
type Step = { label: string };
type Props = { steps?: Step[]; delaySec?: number; loopSec?: number };

const DEFAULT_STEPS: Step[] = [{ label: "Вход" }, { label: "Агент" }, { label: "Выход" }];

const H = 320;
const FS = 46;
const PAD_X = 36;
const CHIP_MIN = 190;
const GAP_MIN = 56;
const GAP_MAX = 240;
const CHIP_H = 112;
const Y = 160;

const Gear: React.FC<{ x: number; y: number; r: number; spin: number; color: string }> = ({ x, y, r, spin, color }) => {
  const teeth = 8;
  const inner = r * 0.62;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
    const a2 = ((i + 1) / teeth) * Math.PI * 2;
    const p = (ang: number, rad: number) => `${Math.cos(ang) * rad} ${Math.sin(ang) * rad}`;
    d += `${i === 0 ? "M" : "L"} ${p(a0, r)} L ${p(a1, r)} L ${p(a1, inner)} L ${p(a2, inner)} `;
  }
  d += "Z";
  return (
    <g transform={`translate(${x} ${y}) rotate(${spin})`} opacity={0.85}>
      <path d={d} fill="none" stroke={color} strokeWidth={3} />
      <circle cx={0} cy={0} r={inner * 0.4} fill="none" stroke={color} strokeWidth={3} />
    </g>
  );
};

export const PipelineFlow: React.FC<Props> = ({ steps = DEFAULT_STEPS, delaySec = 0, loopSec = 2.2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const loop = Math.round(loopSec * fps);
  const n = Math.max(1, steps.length);

  // Auto-width each chip to its label; SPREAD the row to fill SAFE_W (bigger chips,
  // wider gaps) when labels are short, and scale DOWN only if it overflows.
  const cw = steps.map((s) =>
    Math.max(CHIP_MIN, measureText({ text: s.label || "", fontFamily: style.fonts.heading, fontWeight: 900, fontSize: FS }).width + PAD_X * 2)
  );
  const sumW = cw.reduce((a, b) => a + b, 0);
  const gap = n > 1 ? Math.max(GAP_MIN, Math.min(GAP_MAX, (SAFE_W - sumW) / (n - 1))) : 0;
  const totalW = sumW + gap * (n - 1);
  const scale = Math.min(1, SAFE_W / totalW);
  const offX = (SAFE_W - totalW * scale) / 2;

  // chip centre X in local (unscaled) coords
  const cx: number[] = [];
  let acc = 0;
  steps.forEach((_, i) => { cx.push(acc + cw[i] / 2); acc += cw[i] + gap; });

  const beltD = `M ${cx[0]} ${Y} L ${cx[n - 1]} ${Y}`;
  const total = getLength(beltD) || 1;
  const t = ((frame - start) % loop) / loop;
  // getPointAtLength returns null past/at the path's own length (Remotion v5+
  // API change) - clamp just under `total` so the end-of-path frame never hits it.
  const packet = getPointAtLength(beltD, Math.min(total * t, total - 0.01)) ?? { x: 0, y: 0 };
  const spin = ((frame - start) / fps) * 90;

  return (
    <svg width={SAFE_W} height={H} style={{ overflow: "visible" }}>
      <g transform={`translate(${offX} ${Y * (1 - scale)}) scale(${scale})`}>
        <path d={beltD} stroke={style.colors.cardBorder} strokeWidth={3} fill="none" strokeDasharray="2 12" strokeLinecap="round" />
        {steps.map((s, i) => {
          const enter = spring({ frame: Math.max(0, frame - start - i * 6), fps, config: style.animation.spring.gentle });
          return (
            <g key={i} opacity={enter}>
              <rect x={cx[i] - cw[i] / 2} y={Y - CHIP_H / 2} width={cw[i]} height={CHIP_H} rx={12} fill={style.colors.cardBg} stroke={style.colors.cardBorder} />
              <text x={cx[i]} y={Y + 12} textAnchor="middle" fontFamily={style.fonts.heading} fontWeight={900} fontSize={FS} fill={style.colors.textPrimary}>
                {s.label}
              </text>
              {i < n - 1 && (
                <g transform={`translate(${(cx[i] + cx[i + 1]) / 2} ${Y})`}>
                  <path d="M -8 -8 L 8 0 L -8 8 Z" fill={style.colors.accent} opacity={0.6} />
                </g>
              )}
            </g>
          );
        })}
        <circle cx={packet.x} cy={packet.y} r={12} fill={style.colors.accent} />
      </g>
      <Gear x={SAFE_W - 54} y={H - 54} r={40} spin={spin} color={style.colors.primary} />
    </svg>
  );
};
