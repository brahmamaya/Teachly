import type { Board, Ptr, Tool } from '../board';
import { bbox, pointInPolygon } from '../geometry';
import { store } from '../store';
import type { PathEl } from '../types';

/**
 * Paint bucket: tap inside any closed shape or hand-drawn loop to colour it.
 * When drawings are nested, the smallest one under the finger is filled.
 */
export class FillTool implements Tool {
  cursor = 'cell';

  constructor(private board: Board) {}

  down(p: Ptr): void {
    let best: PathEl | null = null;
    let bestArea = Infinity;
    for (const el of store.page.els) {
      if (el.type !== 'path' || el.locked || el.style === 'highlighter') continue;
      if (el.style === 'shape' && !el.closed) continue;
      if (el.pts.length < 9) continue;
      const b = bbox(el);
      if (p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) continue;
      if (!pointInPolygon(p.x, p.y, el.pts, 3)) continue;
      const area = b.w * b.h;
      if (area < bestArea) {
        best = el;
        bestArea = area;
      }
    }
    if (!best) return;
    const color = store.tool.fillColor;
    const target = best;
    store.mapEls(new Set([target.id]), (el) => ({ ...el, fill: color === 'none' ? null : color }) as PathEl);
    this.board.invalidate('ink');
  }

  move(): void {}
  up(): void {}
  cancel(): void {}
}
