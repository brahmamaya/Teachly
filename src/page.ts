import type { Rect } from './types';

/**
 * The writing area of every board page: a fixed 16:9 rectangle in world
 * units. It is always fitted to the screen, so the board looks the same on
 * a phone, a laptop and an 86" panel, and PDFs / slides sit exactly on it.
 */
export const PAGE: Rect = { x: 0, y: 0, w: 1600, h: 900 };

/** Fit a w×h picture inside the page (centred, keeping its proportions). */
export function fitInPage(w: number, h: number, margin = 0): Rect {
  const k = Math.min((PAGE.w - margin * 2) / w, (PAGE.h - margin * 2) / h);
  const fw = w * k, fh = h * k;
  return { x: PAGE.x + (PAGE.w - fw) / 2, y: PAGE.y + (PAGE.h - fh) / 2, w: fw, h: fh };
}
