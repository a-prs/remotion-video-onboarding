import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";
import { useState } from "react";
import { style } from "../stylekit";

/**
 * LogoMark — renders a brand logo SVG from `public/logos/<slug>.svg`.
 *
 * This public repo ships NO logo files — `public/logos/` does not exist by
 * default. `brand=` is only useful once the user (or you, on their behalf)
 * has actually placed a matching `<slug>.svg` under `public/logos/` in
 * their project — third-party brand marks aren't bundled here on purpose
 * (redistribution/trademark risk), so don't suggest `brand=` as if a logo
 * bank already exists. If asked for a brand icon and no SVG is on disk,
 * either fetch/create one with the user's OK and drop it in `public/logos/`
 * first, or skip the logo and let the caller's emoji/text fallback carry it.
 * Fails safe either way: a missing/broken SVG renders nothing (see
 * `onError` below), not a broken-image icon.
 *
 * Two uses:
 *  1. Standalone act — a centered mark with an optional caption (brand name).
 *  2. Injected into another component's icon slot (ChapterCards, HeroCard,
 *     DiagramFlow nodes, IconTitle…) via `<LogoMark brand="openai" size={64}
 *     inline />` — replaces the generic emoji with the actual logo.
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
  const [broken, setBroken] = useState(false);

  const src = staticFile(`logos/${(brand || "").toLowerCase()}.svg`);
  if (broken) return null;
  const img = (
    <Img
      src={src}
      style={{ height: size, width: "auto", objectFit: "contain" }}
      onError={() => setBroken(true)}
    />
  );

  if (inline) {
    return img;
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
      {img}
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
