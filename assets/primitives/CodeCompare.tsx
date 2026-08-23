import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../../stylekit";
import { ZONES } from "../format";
import { LogoMark } from "../LogoMark";

/**
 * CodeCompare — two stacked IDE-ish panes (before → after) reflowed VERTICAL:
 * top pane = "before", bottom pane = "after". Each is a flat window with a mono
 * title bar (title + optional brand logo) and a few abstract code lines rendered
 * as dim mono bars of varying widths. The "after" pane gets a teal accent
 * border. Panes stagger in. Optional heading above. NO glow. Fullscreen act.
 */
type Props = {
  leftTitle?: string;
  rightTitle?: string;
  heading?: string;
  leftBrand?: string;
  rightBrand?: string;
  delaySec?: number;
  compact?: boolean;
};

// Abstract "code" rows: [indent levels, width %]. Indent → left padding.
const BEFORE_ROWS: Array<[number, number]> = [
  [0, 62],
  [1, 80],
  [1, 46],
  [2, 70],
  [2, 38],
  [1, 54],
  [0, 30],
];
const AFTER_ROWS: Array<[number, number]> = [
  [0, 50],
  [1, 40],
  [0, 34],
];

const Pane: React.FC<{
  title: string;
  brand?: string;
  rows: Array<[number, number]>;
  accent: boolean;
  local: number;
  delay: number;
  fps: number;
  compact?: boolean;
}> = ({ title, brand, rows, accent, local, delay, fps, compact = false }) => {
  const enter = spring({
    frame: local - delay,
    fps,
    config: style.animation.spring.enter,
  });
  const op = interpolate(local, [delay, delay + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(enter, [0, 1], [40, 0]);
  const accentColor = style.colors.accent;
  const barColor = accent ? "rgba(94,234,212,0.30)" : "rgba(244,244,245,0.22)";

  // Compact (Mode-A overlay): tighter title bar / body, smaller mono title.
  const barGap = compact ? 10 : 14;
  const barPad = compact ? "12px 18px" : "18px 24px";
  const dotSize = compact ? 9 : 12;
  const brandSize = compact ? 24 : 34;
  const titleFont = compact ? 22 : 30;
  const bodyPad = compact ? "16px 22px" : "26px 28px";
  const bodyGap = compact ? 11 : 18;
  const indentUnit = compact ? 28 : 44;
  const barH = compact ? 10 : 14;
  const barRadius = compact ? 5 : 7;

  return (
    <div
      style={{
        width: "100%",
        borderRadius: style.radius,
        overflow: "hidden",
        background: style.colors.cardBg,
        border: `1px solid ${accent ? accentColor : style.colors.cardBorder}`,
        boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
        opacity: op,
        transform: `translateY(${y}px)`,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: barGap,
          padding: barPad,
          background: "rgba(255,255,255,0.04)",
          borderBottom: `1px solid ${style.colors.cardBorder}`,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ width: dotSize, height: dotSize, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
          <div style={{ width: dotSize, height: dotSize, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
          <div style={{ width: dotSize, height: dotSize, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
        </div>
        {brand && <LogoMark brand={brand} size={brandSize} inline />}
        <div
          style={{
            fontFamily: style.fonts.mono,
            fontSize: titleFont,
            letterSpacing: 1,
            color: accent ? accentColor : style.colors.textMono,
          }}
        >
          {title}
        </div>
      </div>
      {/* Abstract code body */}
      <div style={{ padding: bodyPad, display: "flex", flexDirection: "column", gap: bodyGap }}>
        {rows.map(([indent, w], i) => {
          const rd = delay + 6 + i * 3;
          const rop = interpolate(local, [rd, rd + 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                marginLeft: indent * indentUnit,
                width: `${w}%`,
                height: barH,
                borderRadius: barRadius,
                background: barColor,
                opacity: rop,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export const CodeCompare: React.FC<Props> = ({
  leftTitle = "было.py",
  rightTitle = "стало.py",
  heading,
  leftBrand,
  rightBrand,
  delaySec = 0,
  compact = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const local = Math.max(0, frame - start);

  const headOp = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Compact (Mode-A overlay): fewer/shorter code lines, smaller heading, tighter.
  const maxW = compact ? 760 : 1080 - ZONES.sideGutter * 2;
  const outerGap = compact ? 16 : 28;
  const headFont = compact ? 44 : 64;
  const arrowFont = compact ? 30 : 44;
  const beforeRows = compact ? BEFORE_ROWS.slice(0, 4) : BEFORE_ROWS;
  const afterRows = compact ? AFTER_ROWS.slice(0, 2) : AFTER_ROWS;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: maxW,
        display: "flex",
        flexDirection: "column",
        gap: outerGap,
      }}
    >
      {heading && (
        <div
          style={{
            fontFamily: style.fonts.heading,
            fontWeight: 900,
            fontSize: headFont,
            letterSpacing: -0.5,
            lineHeight: 1.05,
            color: style.colors.textPrimary,
            opacity: headOp,
          }}
        >
          {heading}
        </div>
      )}
      <Pane
        title={leftTitle}
        brand={leftBrand}
        rows={beforeRows}
        accent={false}
        local={local}
        delay={0}
        fps={fps}
        compact={compact}
      />
      {/* ↓ before → after */}
      <div
        style={{
          alignSelf: "center",
          fontFamily: style.fonts.mono,
          fontSize: arrowFont,
          color: style.colors.accent,
          opacity: interpolate(local, [10, 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        ↓
      </div>
      <Pane
        title={rightTitle}
        brand={rightBrand}
        rows={afterRows}
        accent
        local={local}
        delay={14}
        fps={fps}
        compact={compact}
      />
    </div>
  );
};
