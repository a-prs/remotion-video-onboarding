import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { style } from "../../stylekit";
import { ZONES, LEGIBLE } from "../format";

/**
 * NeuralFlow — a vertical pipeline: input label at top, a descending chain of
 * small step nodes, output label at bottom, joined by a pulsing connecting spine
 * (a teal dot travels down the line). Flat teal/purple, NO neon. Fullscreen act.
 * No logo slot.
 */
type Props = {
  inputLabel: string;
  outputLabel: string;
  title?: string;
  pipelineSteps?: string[];
  delaySec?: number;
  compact?: boolean;
};

const DEFAULT_STEPS = ["Токенизация", "Контекст", "Модель", "Декодинг"];

export const NeuralFlow: React.FC<Props> = ({
  inputLabel,
  outputLabel,
  title,
  pipelineSteps = DEFAULT_STEPS,
  delaySec = 0,
  compact = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const local = Math.max(0, frame - start);
  const step = 10;

  // Compact (Mode-A overlay, top-third): tighter, smaller, fewer steps.
  const shownSteps = compact ? pipelineSteps.slice(0, 3) : pipelineSteps;

  // Build the ordered chain: input → steps → output.
  const rows = [
    { kind: "io" as const, label: inputLabel, accent: style.colors.accent },
    ...shownSteps.map((s) => ({ kind: "node" as const, label: s, accent: style.colors.primary })),
    { kind: "io" as const, label: outputLabel, accent: style.colors.accent },
  ];

  const spineH = compact ? 34 : 56; // height of each connecting spine segment
  const maxW = compact ? 600 : 760;
  const titleMb = compact ? 16 : 28;
  const spineMargin = compact ? "4px 0" : "6px 0";
  const ioPad = compact ? "16px 22px" : "26px 30px";
  const nodePad = compact ? "12px 20px" : "18px 26px";
  const ioFont = compact ? 36 : 48; // ≥ LEGIBLE.bodyMin (34)
  const nodeFont = compact ? 34 : 36;
  const ioSubFont = compact ? 18 : 22;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: maxW,
        margin: "0 auto",
        paddingLeft: ZONES.sideGutter,
        paddingRight: ZONES.sideGutter,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {title && (
        <div
          style={{
            fontFamily: style.fonts.mono,
            fontSize: LEGIBLE.caption,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: style.colors.textSecondary,
            marginBottom: titleMb,
            textAlign: "center",
          }}
        >
          {title}
        </div>
      )}

      {rows.map((r, i) => {
        const d = i * step;
        const enter = spring({ frame: local - d, fps, config: style.animation.spring.enter });
        const op = interpolate(local, [d, d + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const y = interpolate(enter, [0, 1], [30, 0]);

        // pulsing dot position along the spine segment that LEADS this row.
        const spineD = d - 5;
        const spineOp = interpolate(local, [spineD, spineD + 6], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        // dot travels 0→spineH on a loop once the spine is live.
        const cycle = 24; // frames per pulse
        const t = ((Math.max(0, local - spineD) % cycle) / cycle);
        const dotY = t * spineH;
        const dotFade = Math.sin(t * Math.PI); // bright in the middle of travel

        const isIO = r.kind === "io";
        return (
          <div
            key={i}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}
          >
            {/* connecting spine (not before the first row) */}
            {i > 0 && (
              <div
                style={{
                  position: "relative",
                  width: 3,
                  height: spineH,
                  margin: spineMargin,
                  background: "rgba(255,255,255,0.18)",
                  opacity: spineOp,
                }}
              >
                {/* travelling pulse dot */}
                <div
                  style={{
                    position: "absolute",
                    left: -3,
                    top: dotY - 4,
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: style.colors.accent,
                    opacity: dotFade,
                  }}
                />
              </div>
            )}
            {/* row node */}
            <div
              style={{
                width: isIO ? "100%" : "70%",
                padding: isIO ? ioPad : nodePad,
                textAlign: "center",
                background: style.colors.cardBg,
                border: `1px solid ${isIO ? r.accent : style.colors.cardBorder}`,
                borderRadius: style.radius,
                boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
                opacity: op,
                transform: `translateY(${y}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: isIO ? style.fonts.heading : style.fonts.mono,
                  fontWeight: isIO ? 900 : 400,
                  fontSize: isIO ? ioFont : nodeFont,
                  textTransform: isIO ? "none" : "uppercase",
                  letterSpacing: isIO ? -0.5 : 2,
                  color: isIO ? style.colors.textPrimary : style.colors.textPrimary,
                  lineHeight: 1.1,
                }}
              >
                {r.label}
              </div>
              {isIO && (
                <div
                  style={{
                    fontFamily: style.fonts.mono,
                    fontSize: ioSubFont,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    color: r.accent,
                    marginTop: 6,
                  }}
                >
                  {i === 0 ? "INPUT" : "OUTPUT"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
