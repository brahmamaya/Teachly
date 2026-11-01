import type { Rect } from './types';

/**
 * The writing area of every board page, in world units. It is always 1600
 * wide and takes the shape of the screen, so the page fills the whole
 * screen on a phone, a laptop and an 86" panel alike (toolbars float on it).
 */
export const PAGE: Rect = { x: 0, y: 0, w: 1600, h: 900 };

/** Match the page to the screen's shape. */
export function setPageSize(screenW: number, screenH: number): void {
  if (screenW > 0 && screenH > 0) PAGE.h = Math.round((PAGE.w * screenH) / screenW);
}

/** Fit a w×h picture inside the page (centred, keeping its proportions). */
export function fitInPage(w: number, h: number, margin = 0): Rect {
  const k = Math.min((PAGE.w - margin * 2) / w, (PAGE.h - margin * 2) / h);
  const fw = w * k, fh = h * k;
  return { x: PAGE.x + (PAGE.w - fw) / 2, y: PAGE.y + (PAGE.h - fh) / 2, w: fw, h: fh };
}
