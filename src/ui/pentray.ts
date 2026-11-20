import type { PenKind } from '../types';

/** Shade a colour toward black (k<0) or white (k>0) so each pen gets its own darker and lighter tones. */
function shade(hex: string, k: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Shared gradients for the 3D look (one hidden svg at the top of the tray). */
export const PEN_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="pt-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".75" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>
  <linearGradient id="pt-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f4f6"/><stop offset=".45" stop-color="#b9bcc4"/><stop offset="1" stop-color="#6d7079"/></linearGradient>
  <linearGradient id="pt-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".5" stop-color="#e0b43c"/><stop offset="1" stop-color="#9a6f12"/></linearGradient>
  <linearGradient id="pt-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dcb0"/><stop offset="1" stop-color="#c8985a"/></linearGradient>
</defs></svg>`;

/** The name printed on each pen (short, so it fits on the visible part). */
const SHORT: Record<string, string> = { pen: 'Ball pen', fineliner: 'Liner', pencil: 'Pencil', crayon: 'Crayon', fountain: 'Fountain', marker: 'Marker', watercolor: 'Water', brush: 'Brush', calligraphy: 'Callig.', highlighter: 'Highlight' };

/** A tiny rounded bar with the 3D shine laid over it. */
const bar = (x: number, y: number, w: number, h: number, fill: string, r = 3): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#pt-shade)"/>`;

/**
 * One pen lying sideways, tip on the left (viewBox 170 x 30, turned upright at the end). The colour the teacher chose tints the tip, band or
 * body, as on a real pen set. Pure SVG, so it stays sharp at every zoom and screen size.
 */
export function penSvg(kind: PenKind, color: string, label = ''): string {
  const dark = shade(color, -0.35);
  let g = '';
  switch (kind) {
    case 'pen':
      g = `<path d="M3 15 L26 9 V21 Z" fill="url(#pt-metal)"/><path d="M3 15 L9 13.5 V16.5 Z" fill="${color}"/>${bar(26, 8, 112, 14, '#f4f4f6')}${bar(26, 8, 22, 14, color)}${bar(138, 9, 26, 12, '#2b2d33', 5)}<rect x="60" y="6" width="70" height="3" rx="1.5" fill="url(#pt-metal)"/>`;
      break;
    case 'fineliner':
      g = `<path d="M3 15 L22 11 V19 Z" fill="${color}"/>${bar(22, 10, 18, 10, dark)}${bar(40, 9, 110, 12, '#fff')}${bar(40, 9, 30, 12, color)}${bar(150, 10, 14, 10, dark, 4)}`;
      break;
    case 'pencil':
      g = `<path d="M3 15 L36 6 V24 Z" fill="url(#pt-wood)"/><path d="M3 15 L12 12.5 V17.5 Z" fill="${dark}"/>${bar(36, 6, 104, 18, color, 2)}${bar(140, 6, 10, 18, '#c9ccd3', 1)}${bar(150, 6, 14, 18, '#f29aa8', 6)}<path d="M36 12 H140 M36 18 H140" stroke="#000" stroke-opacity=".12"/>`;
      break;
    case 'crayon':
      g = `<path d="M3 15 Q4 9 20 8 L28 8 V22 L20 22 Q4 21 3 15Z" fill="${color}"/><rect x="3" y="8" width="25" height="14" fill="url(#pt-shade)" rx="6"/>${bar(28, 7, 128, 16, color, 2)}<rect x="28" y="7" width="128" height="16" fill="#fff" opacity=".18"/><path d="M44 7 V23 M140 7 V23" stroke="#000" stroke-opacity=".25" stroke-width="2"/>${bar(156, 8, 8, 14, dark, 3)}`;
      break;
    case 'marker':
      g = `<path d="M3 11 L22 8 V22 L3 19 Z" fill="#2b2d33"/>${bar(22, 6, 14, 18, dark)}${bar(36, 5, 100, 20, '#fff')}${bar(36, 5, 100, 20, color)}<rect x="36" y="5" width="100" height="20" fill="#fff" opacity=".12" rx="3"/>${bar(136, 7, 28, 16, '#2b2d33', 5)}`;
      break;
    case 'fountain':
      g = `<path d="M3 15 L30 7 Q36 15 30 23 Z" fill="url(#pt-gold)"/><path d="M3 15 L22 15" stroke="#7a5510" stroke-width="1"/><circle cx="22" cy="15" r="1.4" fill="#7a5510"/>${bar(30, 8, 16, 14, '#1d1f24')}${bar(46, 7, 118, 16, dark, 6)}<rect x="62" y="9" width="80" height="2.6" rx="1.3" fill="url(#pt-gold)"/><rect x="146" y="7" width="3" height="16" fill="url(#pt-gold)"/>`;
      break;
    case 'watercolor':
      g = `<path d="M2 15 Q10 6 30 9 L38 10 V20 L30 21 Q10 24 2 15Z" fill="${color}"/><path d="M2 15 Q10 6 30 9 L38 10 V20 L30 21 Q10 24 2 15Z" fill="url(#pt-shade)"/>${bar(38, 9, 22, 12, 'url(#pt-metal)', 2)}<rect x="44" y="9" width="2" height="12" fill="#000" opacity=".18"/><rect x="52" y="9" width="2" height="12" fill="#000" opacity=".18"/><path d="M60 11 H162 Q166 15 162 19 H60 Z" fill="${dark}"/><path d="M60 11 H162 Q166 15 162 19 H60 Z" fill="url(#pt-shade)"/>`;
      break;
    case 'brush':
      g = `<path d="M3 16 Q4 9 18 8 L34 8 V22 L18 22 Q6 22 3 16Z" fill="#6b4a2b"/><path d="M3 16 Q4 12 9 10 L12 10 Q8 14 9 20 Q4 20 3 16Z" fill="${color}"/><path d="M3 16 Q4 9 18 8 L34 8 V22 L18 22 Q6 22 3 16Z" fill="url(#pt-shade)"/>${bar(34, 8, 22, 14, 'url(#pt-metal)', 2)}${bar(56, 10, 108, 10, '#1d1f24', 5)}`;
      break;
    case 'calligraphy':
      g = `<path d="M3 21 L10 8 L30 8 L26 22 Z" fill="url(#pt-gold)"/><path d="M5 20 L22 14" stroke="#7a5510" stroke-width="1"/>${bar(28, 8, 14, 14, '#1d1f24')}${bar(42, 7, 122, 16, dark, 6)}<rect x="60" y="9" width="70" height="2.6" rx="1.3" fill="url(#pt-gold)"/><rect x="136" y="7" width="3" height="16" fill="${color}"/>`;
      break;
    case 'highlighter':
      g = `<path d="M3 12 L20 6 L24 6 V24 L20 24 L3 18 Z" fill="${color}"/><path d="M3 12 L20 6 L24 6 V24 L20 24 L3 18 Z" fill="url(#pt-shade)"/>${bar(24, 5, 14, 20, '#e9eaee', 2)}${bar(38, 4, 96, 22, color, 4)}<rect x="38" y="4" width="96" height="22" rx="4" fill="#fff" opacity=".35"/>${bar(134, 6, 30, 18, '#2b2d33', 6)}`;
      break;
    default:
      g = bar(3, 8, 160, 14, color);
  }
  // Standing upright, tip up (the drawing above lies sideways with the tip on the left); the pen's name is printed small on its body.
  const short = SHORT[kind] ?? label;
  const tx = kind === 'pencil' ? 40 : 37, tl = Math.round(short.length * 3.3);
  const text = label ? `<rect x="${tx - 2}" y="9.6" width="${tl + 4}" height="10.8" rx="2.4" fill="#14161c"/><text x="${tx}" y="17.2" font-size="5.6" font-weight="700" font-family="system-ui,sans-serif" fill="#fff" textLength="${tl}" lengthAdjust="spacingAndGlyphs">${short}</text>` : '';
  return `<svg class="pt-svg" viewBox="0 0 30 170" width="30" height="170" aria-hidden="true"><g transform="translate(30 0) rotate(90)">${g}${text}</g></svg>`;
}
