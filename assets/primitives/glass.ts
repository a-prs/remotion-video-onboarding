/**
 * Vertical glass tokens — flat terminal direction (Andrey, 2026-06-16).
 *
 * Dark NEUTRAL frosted panels (not colorful), thin light border, small radius.
 * Mode B is NOT a solid background — it's a BIG glass laid over the same
 * talking-head footage, blurred heavily, so the face stays faintly visible
 * (no hard background switch between Mode A and Mode B).
 */

export const V_GLASS = {
  // Mode A panel: neutral dark frost (white text pops; no purple tint, no glow).
  panelBg: "rgba(12,12,16,0.5)",
  panelBlur: 18,
  panelBorder: "rgba(255,255,255,0.14)",
  panelRadius: 12,
  innerHighlight: "rgba(255,255,255,0.06)",

  // Mode B "big glass over blurred footage".
  fullscreenBlur: 46,
  fullscreenTint:
    "linear-gradient(180deg, rgba(8,8,10,0.50) 0%, rgba(8,8,10,0.62) 100%)",
} as const;
