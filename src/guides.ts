import { bbox } from './geometry';
import { PAGE } from './page';
import type { El, Rect } from './types';

/**
 * Smart guides: while a drawing is moved (or a new shape is dragged out),
 * its edges and centre are compared with every other drawing on the page
 * and with the page itself. When they line up, the moving item snaps into
 * line and a dotted guide shows where it is aligned.
 */

export interface Guide {
  /** 'v' = vertical line at x, 'h' = horizontal line at y. */
  dir: 'v' | 'h';
  at: number;
  from: number;
  to: number;
}

export interface GuideResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

function stops(r: Rect, axis: 'x' | 'y'): number[] {
  return axis === 'x' ? [r.x, r.x + r.w / 2, r.x + r.w] : [r.y, r.y + r.h / 2, r.y + r.h];
}

/** Rects of everything the moving items could line up with. */
export function guideTargets(els: El[], exclude: Set<string>): Rect[] {
  const out: Rect[] = [PAGE];
  for (const e of els) if (!exclude.has(e.id)) out.push(bbox(e));
  return out;
}

/**
 * Work out how far to nudge `moving` (already moved by the user) so it
 * lines up, and which guides to draw. `tol` is the snap distance in world units.
 */
export function snapToGuides(moving: Rect, targets: Rect[], tol: number): GuideResult {
  const res: GuideResult = { dx: 0, dy: 0, guides: [] };
  for (const axis of ['x', 'y'] as const) {
    const mine = stops(moving, axis);
    let best = tol + 1;
    let shift = 0;
    for (const t of targets) {
      for (const s of stops(t, axis)) {
        for (const m of mine) {
          const d = s - m;
          if (Math.abs(d) < Math.abs(best)) {
            best = d;
            shift = d;
          }
        }
      }
    }
    if (Math.abs(best) > tol) continue;
    if (axis === 'x') res.dx = shift;
    else res.dy = shift;
  }
  // Collect every line that matches after snapping (there can be several).
  const snapped = { ...moving, x: moving.x + res.dx, y: moving.y + res.dy };
  for (const axis of ['x', 'y'] as const) {
    const seen = new Set<number>();
    for (const t of targets) {
      for (const s of stops(t, axis)) {
        if (seen.has(Math.round(s))) continue;
        if (!stops(snapped, axis).some((m) => Math.abs(s - m) < 0.5)) continue;
        seen.add(Math.round(s));
        const lo = axis === 'x' ? Math.min(t.y, snapped.y) : Math.min(t.x, snapped.x);
        const hi = axis === 'x' ? Math.max(t.y + t.h, snapped.y + snapped.h) : Math.max(t.x + t.w, snapped.x + snapped.w);
        res.guides.push({ dir: axis === 'x' ? 'v' : 'h', at: s, from: lo, to: hi });
      }
    }
  }
  return res;
}

/** Draw the dotted guides (world coordinates; `px` = world units per screen pixel). */
export function drawGuides(ctx: CanvasRenderingContext2D, guides: Guide[], px: number): void {
  if (!guides.length) return;
  ctx.save();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 1.5 * px;
  ctx.setLineDash([6 * px, 5 * px]);
  ctx.beginPath();
  for (const g of guides) {
    const pad = 24 * px;
    if (g.dir === 'v') {
      ctx.moveTo(g.at, g.from - pad);
      ctx.lineTo(g.at, g.to + pad);
    } else {
      ctx.moveTo(g.from - pad, g.at);
      ctx.lineTo(g.to + pad, g.at);
    }
  }
  ctx.stroke();
  ctx.restore();
}
