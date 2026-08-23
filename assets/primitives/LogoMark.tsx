import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";
import { style } from "../stylekit";

/**
 * LogoMark — renders a real brand logo from the office logo bank
 * (public/logos/<slug>.svg, pre-recolored for the dark flat theme).
 *
 * Two uses:
 *  1. Standalone act — a centered mark with an optional caption (brand name).
 *  2. Injected into another component's icon slot (ChapterCards, HeroCard,
 *     DiagramFlow nodes, IconTitle…) via `<LogoMark brand="openai" size={64}
 *     inline />` — replaces the generic emoji with the actual logo.
 *
 * `brand` is a bank slug (openai, anthropic, claude, google, github, n8n,
 * youtube, telegram, googlegemini…). Unknown slugs render nothing (caller
 * should fall back to an emoji icon).
 */

type Props = {
  brand: string;
  /** Mark height in px (width auto). */
  size?: number;
  /** Seconds into the scene before the mark appears. */
  delaySec?: number;
  /** Brand-name caption under the mark (standalone act only). */
  caption?: string;
  /** Entrance flavor. "pop" = spring scale (fullscreen), "fade" = gentle. */
  effect?: "pop" | "fade";
  /** Inline (in an icon slot): no entrance animation, no caption, just the mark. */
  inline?: boolean;
};

export const LogoMark: React.FC<Props> = ({
  brand,
  size = 96,
  delaySec = 0,
  caption,
  effect = "pop",
  inline = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);
  const local = Math.max(0, frame - start);

  const src = staticFile(`logos/${(brand || "").toLowerCase()}.svg`);

  if (inline) {
    return <Img src={src} style={{ height: size, width: "auto", objectFit: "contain" }} />;
  }

  if (frame < start) return null;

  const enter = spring({
    frame: local,
    fps,
    config: effect === "pop" ? style.animation.spring.enter : style.animation.spring.gentle,
  });
  const scale = interpolate(enter, [0, 1], [effect === "pop" ? 0.6 : 0.92, 1]);
  const opacity = interpolate(local, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 22,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <Img src={src} style={{ height: size, width: "auto", objectFit: "contain" }} />
      {caption && (
        <div
          style={{
            fontFamily: style.fonts.heading,
            fontWeight: 900,
            fontSize: 44,
            color: style.colors.textPrimary,
            letterSpacing: -0.5,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
};
