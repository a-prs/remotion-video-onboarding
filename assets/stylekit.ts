/**
 * StyleKit TEMPLATE — style tokens every primitive component reads instead of
 * hardcoding colors/fonts. This file ships with example values; the skill's
 * onboarding step (see SKILL.md "Стайлкит") is expected to REGENERATE the
 * `colors`/`fonts` values below based on what the user actually wants (their
 * stated colors, or a palette extracted from reference images they send) —
 * do not ship these example values as-is to a real user's project.
 *
 * The shape (which keys exist) must stay stable — the primitive components
 * import `style.colors.X` / `style.fonts.X` by these exact names.
 *
 * FLAT is a deliberate constraint, not a style choice to change per-user: no
 * gradients, no glow. That's what keeps this from reading as generic AI slop
 * regardless of which colors end up here — solid fills, thin borders, real
 * contrast. Push back gently if a user explicitly asks for a glow/gradient
 * look; it's fine if they insist, just don't default to it.
 *
 * retake-review: ask
 * ^ persisted user preference for retake/false-start cuts (SKILL.md Шаг 6 п.2):
 * "ask" = show found duplicates and confirm before cutting each video (default).
 * "auto" = just cut and report, don't wait for approval. Set once the user
 * answers the question in Шаг 6 п.2 — don't re-ask after that in this project.
 *
 * final-review: ask
 * ^ persisted user preference for the final report+preview gate before render
 * (SKILL.md Шаг 7): "ask" = show the decisions report (duplicates/pauses/
 * graphics) + preview, wait for confirmation before final render (default).
 * "auto" = skip the wait, still say the report out loud, then render. Set
 * once the user answers the question in Шаг 7 — don't re-ask after that in
 * this project.
 */
import { loadFont as loadSans } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadPixel } from "@remotion/google-fonts/Silkscreen";

// Cyrillic-safe: Montserrat (heavy grotesk headings + body) and JetBrains Mono
// (the terminal label/breadcrumb signature). Silkscreen is Latin-only — use it
// for Latin display tokens (AI, .agent, LIVE), never for Russian text.
const { fontFamily: SANS } = loadSans("normal", {
  weights: ["400", "500", "700", "900"],
  subsets: ["latin", "cyrillic"],
});
const { fontFamily: MONO } = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin", "cyrillic"],
});
const { fontFamily: PIXEL } = loadPixel("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

export const style = {
  colors: {
    // EXAMPLE default (dark graphite + one warm accent, no gradients) — the
    // onboarding step overwrites these two with the user's real choice.
    // Deliberately NOT purple: that's the generic-AI-tool look, and it's the
    // one thing this file should never default to silently.
    primary: "#c9704f", // terracotta — swap for the user's chosen/extracted accent
    primaryLight: "#dd9376",
    primaryDark: "#a85a3d",

    accent: "#5eead4", // teal — secondary accent, used sparingly
    accentLight: "#99f6e4",

    // Semantic signals — one place, so a restyle (or a whole alt theme) swaps the
    // meaning-colors everywhere at once (Andrey, 2026-07-27). Primitives must read
    // these instead of hardcoding hex.
    danger: "#f4485f", // negation / strike / error stamp
    success: "#34d399", // verdict OK / positive result
    positive: "#7CFFA0", // upbeat accent (kineticWord pos, growth)
    // macOS-style window traffic-lights (terminal / code windows chrome)
    winClose: "#ff5f57",
    winMin: "#febc2e",
    winMax: "#28c840",

    // Near-black base + flat elevated surfaces (no gradients).
    bg: "#0a0a0c",
    bgElevated: "#121215",
    bgGradient: "#0a0a0c", // kept as a key; now a flat color, not a gradient

    // Text
    textPrimary: "#f4f4f5",
    textSecondary: "rgba(244,244,245,0.5)",
    textMono: "rgba(244,244,245,0.65)",

    // Flat cards — thin light borders, no glow.
    cardBg: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(255,255,255,0.14)",
    cardBorderHover: "rgba(255,255,255,0.28)",
  },

  fonts: {
    heading: SANS, // Montserrat — heavy weight for big headlines
    body: SANS, // Montserrat — regular for body
    mono: MONO, // JetBrains Mono — labels, breadcrumbs, technical text
    pixel: PIXEL, // Silkscreen — Latin-only dot-matrix display accents
    headingWeight: 900,
    bodyWeight: 400,
  },

  radius: 12,

  // Kept for API compatibility; glow is OFF in the flat direction (intensity 0).
  glow: {
    color: "rgba(94,234,212,0.0)",
    colorStrong: "rgba(94,234,212,0.0)",
    blur: 0,
    blurLarge: 0,
  },

  glass: {
    // Dark neutral frosted — terminal panel, not colorful.
    bg: "rgba(14,14,18,0.55)",
    bgHover: "rgba(20,20,26,0.62)",
    blur: 18,
    border: "rgba(255,255,255,0.14)",
    innerHighlight: "rgba(255,255,255,0.06)",
  },

  animation: {
    enterFrom: 0.3,
    exitTo: 0.15,
    spring: {
      enter: { damping: 10, mass: 0.5, stiffness: 140 },
      gentle: { damping: 14, mass: 0.6, stiffness: 100 },
    },
  },

  contrast: {
    textOnPrimary: "#0a0a0c", // dark text on bright accent surfaces
    textOnAccent: "#0a0a0c",
    textShadowOnColor: "0 2px 12px rgba(0,0,0,0.7), 0 0 40px rgba(0,0,0,0.4)",
  },
};

/**
 * Accent text helper. In the flat direction we avoid gradients on headlines —
 * this returns a SOLID teal by default. (Kept as `gradientText` for API
 * compatibility with legacy 16:9 scenes; pass two colors for a real gradient.)
 */
export const gradientText = (
  from?: string,
  to?: string
): React.CSSProperties => {
  if (from && to) {
    return {
      background: `linear-gradient(135deg, ${from}, ${to})`,
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      color: "transparent",
    };
  }
  return { color: style.colors.accent };
};

// Solid bright text — for text on colorful surfaces or over footage.
export const textOnColor = (): React.CSSProperties => ({
  color: style.colors.textPrimary,
  textShadow: style.contrast.textShadowOnColor,
});

// Flat card/glass helper — thin border, subtle drop shadow, NO glow.
export const glassCard = (_glow: number = 0): React.CSSProperties => ({
  background: style.glass.bg,
  backdropFilter: `blur(${style.glass.blur}px)`,
  WebkitBackdropFilter: `blur(${style.glass.blur}px)`,
  border: `1px solid ${style.glass.border}`,
  borderRadius: style.radius,
  boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
});

// `brand` (channel name/tagline/handle for breadcrumb chrome) is intentionally
// NOT included in the template — that's the user's own identity, not ours.
// If a primitive wants brand chrome text, ask the user for it during
// onboarding and fill it in directly, rather than shipping a fixed object here.
