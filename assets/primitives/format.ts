/**
 * Vertical 9:16 format constants + zone geometry.
 *
 * Reels / Shorts / Stories. Background is ALWAYS the talking-head video
 * (operator's face) + an image; remocn elements render ON TOP.
 *
 * Spec (Andrey, 2026-06-16):
 *  - Mode A (overlay, default — talking to camera, minimal animation):
 *      content lives in the TOP THIRD only; glass plates (backdrop-blur)
 *      with animation over the footage; movement kept minimal.
 *  - Mode B (fullscreen takeover — explaining a process/technique):
 *      scene expands to full screen.
 *  - Bottom ~10% is a SAFE ZONE reserved for the social-network UI
 *      (comments, buttons) — nothing renders there in either mode.
 *  - Sizing follows mobile-web logic: everything readable must be legible
 *      on a phone. Horizontal block rows reflow TOP→BOTTOM, not left→right.
 */

export const VERTICAL = {
  width: 1080,
  height: 1920,
  fps: 30,
} as const;

/**
 * Zone geometry in pixels (for 1080×1920).
 * Use these instead of magic numbers so the spec stays in one place.
 */
export const ZONES = {
  // Top status-bar breathing room (clock/notch area on a real phone).
  topInset: 96,
  // Mode A content band = top third. Content sits between topInset and topThird.
  topThird: Math.round(VERTICAL.height / 3), // 640
  // Bottom 10% — social UI. Nothing here.
  bottomSafe: Math.round(VERTICAL.height * 0.1), // 192
  // Largest y a normal element may reach (height - bottomSafe).
  get contentBottom() {
    return VERTICAL.height - this.bottomSafe; // 1728
  },
  // Side gutters — mobile-web padding.
  sideGutter: 56,
} as const;

/** Minimum legible font sizes on a phone (px @ 1080 wide). */
export const LEGIBLE = {
  // Smallest body text we allow — anything smaller is unreadable on a phone.
  bodyMin: 34,
  body: 40,
  // Default heading / hook size.
  heading: 84,
  headingHero: 120,
  // Captions / labels.
  caption: 30,
} as const;
