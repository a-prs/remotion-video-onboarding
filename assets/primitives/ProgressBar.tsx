import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../stylekit";
import { SAFE_W } from "./safe";

/**
 * ProgressBar — a horizontal bar that FILLS 0→`to`% with a label and live %
 * (critic, 2026-07-23). For «загрузка / готовность / прогресс / почти готово».
 *
 * Plan act {type:"progressBar", props:{label?, to?}}.
 */
type Props = { label?: string; to?: number; delaySec?: number };

const W = 720;

export const ProgressBar: React.FC<Props> = ({ label = "Готовность", to = 100, delaySec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const rel = Math.max(0, frame - start);

  const enter = spring({ frame: rel, fps, config: style.animation.spring.gentle });
  const target = Math.max(0, Math.min(100, to));
  const t = interpolate(rel, [0, Math.round(1.2 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pct = target * t;
  const trackH = 34;

  return (
    <div style={{ width: Math.min(W, SAFE_W), maxWidth: SAFE_W, opacity: enter }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 20, marginBottom: 18 }}>
        <span style={{ fontFamily: style.fonts.mono, fontSize: 34, color: style.colors.textSecondary, overflowWrap: "anywhere", minWidth: 0, flex: 1 }}>{label}</span>
        <span style={{ fontFamily: style.fonts.heading, fontWeight: 900, fontSize: 56, color: style.colors.accent, flexShrink: 0 }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ width: "100%", height: trackH, borderRadius: trackH / 2, background: style.colors.cardBg, border: `1px solid ${style.colors.cardBorder}`, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: trackH / 2, background: style.colors.accent }} />
      </div>
    </div>
  );
};
