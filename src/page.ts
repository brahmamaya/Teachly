import type { Rect } from './types';

/**
 * The writing area of every board page, in world units. It is always 1600
 * wide and takes the shape of the screen, so the page fills the whole
 * screen on a phone, a laptop and an 86" panel alike (toolbars float on it).
 */
export const PAGE: Rect = { x: 0, y: 0, w: 1600, h: 900 };

let screenShape = 9 / 16;
/** A fixed page shape (height / width) chosen for the notebook, or null = follow the screen. */
let fixedShape: number | null = null;

/** Match the page to the screen's shape (a notebook with a fixed shape keeps its own). */
export function setPageSize(screenW: number, screenH: number): void {
  if (screenW > 0 && screenH > 0) screenShape = screenH / screenW;
  if (fixedShape) return;
  PAGE.w = 1600;
  PAGE.h = Math.round(PAGE.w * screenShape);
}

/**
 * A vertical notebook has a tall page (3:4) whatever the screen; the others
 * follow the screen. The tall page is 900 wide so ink and tools look the
 * same size as on a wide page.
 */
export function setPageShape(ratio: number | null): void {
  fixedShape = ratio;
  if (ratio) {
    PAGE.w = 900;
    PAGE.h = Math.round(900 * ratio);
  } else {
    PAGE.w = 1600;
    PAGE.h = Math.round(PAGE.w * screenShape);
  }
}

/** Fit a w×h picture inside the page (centred, keeping its proportions). */
export function fitInPage(w: number, h: number, margin = 0): Rect {
  const k = Math.min((PAGE.w - margin * 2) / w, (PAGE.h - margin * 2) / h);
  const fw = w * k, fh = h * k;
  return { x: PAGE.x + (PAGE.w - fw) / 2, y: PAGE.y + (PAGE.h - fh) / 2, w: fw, h: fh };
}
