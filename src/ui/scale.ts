// Interface scale. Buttons should feel the same size under a finger on a
// phone, a tablet, a desktop and an 86" classroom panel, so the chrome is
// scaled from the screen size (and the teacher's own preference).

let current = 1;

export type UiSize = 'xsmall' | 'small' | 'normal' | 'large';

const PREF: Record<UiSize, number> = { xsmall: 0.68, small: 0.85, normal: 1, large: 1.3 };

/** Current interface scale factor. */
export function ui(): number {
  return current;
}

function isTouchScreen(): boolean {
  return navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
}

/**
 * Work out the scale. `toolbarWidth` is the toolbar's natural (unscaled)
 * width, so phones can shrink it just enough to fit.
 */
export function computeUiScale(size: UiSize, toolbarWidth: number, avail = window.innerWidth): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  let s: number;
  if (isTouchScreen() && w >= 1280) {
    // Interactive panels: grow with the screen (1920 → ~1.35, 3840 → 2.4).
    s = Math.min(2.4, Math.max(1, Math.min(w / 1420, h / 800)));
  } else if (isTouchScreen()) {
    // Phones and tablets: full finger-size buttons.
    s = 1;
  } else {
    s = Math.min(1.15, Math.max(0.8, Math.min(w / 1500, h / 820)));
  }
  s *= PREF[size] ?? 1;
  // Never let the toolbar overflow the screen.
  if (toolbarWidth > 0) s = Math.min(s, (avail - 16) / toolbarWidth);
  current = Math.max(0.5, Math.round(s * 100) / 100);
  document.documentElement.style.setProperty('--ui', String(current));
  return current;
}

/**
 * Ink scale. The board is a fixed page fitted to the screen, so ink sizes are
 * already relative to the page and look the same on every screen.
 */
export function inkScale(): number {
  return 1;
}

/** Apply the scale to an absolutely positioned floating element. */
export function scaleFloating(el: HTMLElement): void {
  el.style.transformOrigin = '0 0';
  el.style.transform = `scale(${current})`;
}
