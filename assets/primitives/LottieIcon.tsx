import { useEffect, useState } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
  delayRender,
  continueRender,
  cancelRender,
} from "remotion";
import { Lottie, LottieAnimationData } from "@remotion/lottie";
import { style } from "../../stylekit";
import { SAFE_W } from "./safe";

/**
 * LottieIcon — a professionally-animated icon (gear, check, loader, …) from a
 * Lottie JSON, instead of hand-drawing every icon primitive (bank v2,
 * 2026-07-27). Loads a bundled JSON from public/lottie by name, or a remote URL.
 * Wrapped in delayRender/continueRender so the render waits for the asset.
 *
 * Plan act {type:"lottieIcon", props:{ src, size?, caption?, loop? }}.
 * `src` = a name in public/lottie (e.g. "gear") or a full https URL.
 */
type Props = {
  src?: string;
  size?: number;
  caption?: string;
  loop?: boolean;
  delaySec?: number;
};

export const LottieIcon: React.FC<Props> = ({
  src = "gear",
  size = 320,
  caption,
  loop = true,
  delaySec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  const [handle] = useState(() => delayRender("Loading Lottie: " + src));
  const [data, setData] = useState<LottieAnimationData | null>(null);

  useEffect(() => {
    const url = src.startsWith("http") ? src : staticFile(`lottie/${src}.json`);
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        setData(json);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle, src]);

  const enter = spring({
    frame: Math.max(0, frame - start),
    fps,
    config: style.animation.spring.enter,
  });

  if (!data) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 26,
        maxWidth: SAFE_W,
        transform: `scale(${interpolate(enter, [0, 1], [0.6, 1])})`,
        opacity: enter,
      }}
    >
      <Lottie animationData={data} loop={loop} style={{ width: size, height: size }} />
      {caption && (
        <div
          style={{
            fontFamily: style.fonts.heading,
            fontWeight: 900,
            fontSize: 54,
            color: style.colors.textPrimary,
            textAlign: "center",
            maxWidth: SAFE_W - 60,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
};
