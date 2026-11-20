import type { PenKind } from '../types';

// The pen tray: white 3D pens standing tip up (only the top part shows, the bar's edge cuts them), each with its tip or
// band in the pen's own colour. Pure SVG: sharp at every zoom and screen, nothing downloaded.

/** Shared gradients for the round, lit look (one hidden svg at the top of the tray). */
export const PEN_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="pb-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9bac0"/><stop offset=".16" stop-color="#ececef"/><stop offset=".42" stop-color="#ffffff"/><stop offset=".72" stop-color="#f0f0f3"/><stop offset="1" stop-color="#aeafb5"/></linearGradient>
  <linearGradient id="pb-metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6f727a"/><stop offset=".28" stop-color="#d9dbe0"/><stop offset=".5" stop-color="#ffffff"/><stop offset=".76" stop-color="#a9abb2"/><stop offset="1" stop-color="#62656d"/></linearGradient>
  <linearGradient id="pb-shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset=".3" stop-color="#fff" stop-opacity=".28"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient>
</defs></svg>`;

/** A shape filled in the pen colour with the round shine over it. */
const tint = (d: string, col: string, op = 1) => `<path d="${d}" fill="${col}" fill-opacity="${op}"/><path d="${d}" fill="url(#pb-shade)"/>`;
/** The white body from height y down (the bar's edge hides the end). */
const body = (y: number) => `<rect x="4" y="${y}" width="24" height="${140 - y}" fill="url(#pb-body)"/>`;
/** A colour ring round the body. */
const band = (y: number, h: number, col: string) => tint(`M4 ${y}h24v${h}h-24z`, col);
/** White neck that narrows from the body to the tip. */
const neck = (y: number, top: number, w: number) => `<path d="M4 ${y} C4 ${y - 5} ${16 - w / 2 - 2} ${top + 3} ${16 - w / 2} ${top} H${16 + w / 2} C${16 + w / 2 + 2} ${top + 3} 28 ${y - 5} 28 ${y}Z" fill="url(#pb-body)"/>`;

/**
 * One pen standing tip up (viewBox 32 x 140). The colour the teacher chose for this pen tints its tip and band,
 * as on the iPad pen set; `num` is printed small on the pen in use (its size).
 */
export function penSvg(kind: PenKind, color: string, num = ''): string {
  const c = color;
  let g = '';
  switch (kind) {
    case 'pencil': {
      // hatched cone, coloured lead
      const id = `pb-hatch-${c.replace(/[^0-9a-z]/gi, '')}`;
      g = `<defs><pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)"><rect width="1.6" height="4" fill="${c}" fill-opacity=".5"/></pattern></defs>${body(44)}<path d="M4 44 L16 6 L28 44Z" fill="url(#pb-body)"/><path d="M4 44 L16 6 L28 44Z" fill="url(#${id})"/><path d="M12.7 16.5 L16 6 L19.3 16.5Z" fill="${c}"/>`;
      break;
    }
    case 'fineliner':
      g = `${body(48)}${neck(48, 34, 9)}<rect x="11.5" y="30" width="9" height="5" rx="1" fill="url(#pb-metal)"/><rect x="14.6" y="12" width="2.8" height="19" fill="url(#pb-metal)"/><rect x="15.2" y="6" width="1.6" height="7" rx=".6" fill="${c}"/>${band(64, 5, c)}`;
      break;
    case 'pen':
      // ball pen: silver cone, coloured ball
      g = `${body(42)}<path d="M4 42 L12.6 10 Q16 3 19.4 10 L28 42Z" fill="url(#pb-metal)"/><circle cx="16" cy="6.2" r="2" fill="${c}"/>${band(58, 3, c)}`;
      break;
    case 'crayon':
      g = `${body(40)}${tint('M6.5 40 L11.5 13 Q16 4 20.5 13 L25.5 40Z', c)}${band(40, 4, c)}${band(56, 7, c)}`;
      break;
    case 'fountain':
      g = `${body(46)}<path d="M5.5 46 C6 32 11.5 18 16 4 C20.5 18 26 32 26.5 46Z" fill="url(#pb-metal)"/><path d="M16 7 V28" stroke="#3a3c42" stroke-width=".7"/><circle cx="16" cy="29.5" r="1.7" fill="#3a3c42"/><path d="M14.6 5.6 L16 4 L17.4 5.6Z" fill="${c}"/>${band(60, 4.5, c)}`;
      break;
    case 'marker':
      g = `${body(44)}<path d="M4 44 C4 38 8 34 8.5 32 H23.5 C24 34 28 38 28 44Z" fill="url(#pb-body)"/>${tint('M9.5 32 V15 L22.5 7 V32Z', c)}${band(60, 8, c)}`;
      break;
    case 'watercolor':
      g = `${body(46)}${neck(46, 30, 10)}${tint('M11 30.5 C11 20 14 11 16 4 C18 11 21 20 21 30.5Z', c)}${band(58, 3, c)}`;
      break;
    case 'brush':
      g = `${body(50)}${neck(50, 42, 14)}<rect x="9" y="31" width="14" height="12" rx="1" fill="url(#pb-metal)"/><path d="M9 34.5 h14 M9 38.5 h14" stroke="#000" stroke-opacity=".18" stroke-width=".8"/>${tint('M9.6 31.5 C9 20 13 9 16 4.5 C19 9 23 20 22.4 31.5Z', c)}`;
      break;
    case 'calligraphy':
      g = `${body(46)}<path d="M5.5 46 L8.5 17 L24.5 8 L26.5 46Z" fill="url(#pb-metal)"/><path d="M8.5 17 L24.5 8" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/><path d="M16.5 14 V32" stroke="#3a3c42" stroke-width=".7"/><circle cx="16.5" cy="33" r="1.5" fill="#3a3c42"/>${band(60, 4.5, c)}`;
      break;
    case 'highlighter':
      g = `${body(42)}<path d="M4 42 C4 36 6 31 6.5 28 H25.5 C26 31 28 36 28 42Z" fill="url(#pb-body)"/>${tint('M7.5 28 V13 L24.5 5 V28Z', c, 0.9)}${band(56, 9, c)}`;
      break;
    default:
      g = body(10);
  }
  const label = num ? `<text x="16" y="86" text-anchor="middle" font-size="7.5" font-weight="600" font-family="system-ui,sans-serif" fill="#8e8e93">${num}</text>` : '';
  return `<svg class="pt-svg" viewBox="0 0 32 140" width="32" height="140" aria-hidden="true">${g}${label}</svg>`;
}

/** #rrggbb from hue (0-360), saturation and lightness (0-100). */
export function hslHex(h: number, s: number, l: number): string {
  const S = s / 100, L = l / 100, a = S * Math.min(L, 1 - L);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * The colour flower: rings of diamond petals, every hue around the circle (yellow at the top), pale near the white
 * centre and deep toward the edge. Each petal is a colour to tap. Built only when the teacher opens it.
 */
export function colorWheelSvg(current: string): string {
  const N = 36, K = 10, step = 360 / N, out: string[] = [];
  const pt = (r: number, deg: number) => {
    const t = (deg * Math.PI) / 180;
    return `${(100 + r * Math.sin(t)).toFixed(2)} ${(100 - r * Math.cos(t)).toFixed(2)}`;
  };
  let picked = '';
  for (let i = K - 1; i >= 0; i--) {
    const r = 11 + i * 9.4, half = 9.6 + i * 0.25, t = i / (K - 1);
    const L = t < 0.42 ? 94 - 44 * (t / 0.42) : 50 - 34 * ((t - 0.42) / 0.58);
    const S = t < 0.42 ? 92 : 100;
    const w = step * (0.62 + 0.1 * (1 - t)) * (i === 0 ? 1.4 : 1);
    for (let j = 0; j < N; j++) {
      const a = j * step + i * (step / 2) + i * 2.2;
      const col = hslHex((60 + a) % 360, S, L);
      const d = `M${pt(r - half, a)} L${pt(r, a - w)} L${pt(r + half, a)} L${pt(r, a + w)}Z`;
      out.push(`<path d="${d}" fill="${col}" data-wc="${col}"/>`);
      if (col === current.toLowerCase()) picked = `<path d="${d}" fill="none" stroke="#fff" stroke-width="1.6" pointer-events="none"/>`;
    }
  }
  return `<svg class="pt-flower" viewBox="0 0 200 200" role="img" aria-label="Colour flower: tap a colour">${out.join('')}<circle cx="100" cy="100" r="4.5" fill="#ffffff" data-wc="#ffffff"/>${picked}</svg>`;
}
