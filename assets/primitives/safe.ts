/**
 * Safe content bounds for vertical 9:16 (1080×1920). Nothing a component draws
 * should exceed SAFE_W horizontally — long text wraps or shrinks to stay inside
 * the phone frame (Andrey, 2026-07-23: «границы, места хватает при рендере»).
 */
export const CANVAS_W = 1080;
export const SIDE_MARGIN = 70;
export const SAFE_W = CANVAS_W - SIDE_MARGIN * 2; // 940
