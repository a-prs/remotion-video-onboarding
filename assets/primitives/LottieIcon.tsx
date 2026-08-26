import { useEffect, useState } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
  delayRender,
  continueRender,
} from "remotion";
import { Lottie, LottieAnimationData } from "@remotion/lottie";
import { style } from "../stylekit";
import { SAFE_W } from "./safe";

/**
 * LottieIcon — a professionally-animated icon (gear, check, loader, …) from a
 * Lottie JSON. `src` = a name in `public/lottie/<name>.json`, or a full
 * https URL. Wrapped in delayRender/continueRender so the render waits for
 * the asset.
 *
 * This public repo ships NO bundled Lottie files — `public/lottie/` does
 * not exist by default, so the `src="gear"` default has nothing to load
 * unless the user's project has one. Either use a full `https://` URL to a
 * real Lottie JSON (e.g. from lottiefiles.com, with the user's OK), or drop
 * a JSON file into `public/lottie/` first — don't assume the named presets
 * already exist. On load failure this renders nothing instead of crashing
 * the render (see the catch below).
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
      .then((r) => {
        if (!r.ok) throw new Error(`lottie fetch ${r.status}: ${url}`);
        return r.json();
      })
      .then((json) => {
        setData(json);
        continueRender(handle);
      })
      .catch((err) => {
        // Fail SAFE, not loud: this repo ships no bundled Lottie files, so a
        // missing public/lottie/<name>.json is expected, not a crash-worthy
        // bug — render nothing instead of cancelRender()-ing the whole video.
        console.warn(`[LottieIcon] ${err} — skipping this icon`);
        continueRender(handle);
      });
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
