import type { Board, Ptr, Tool } from '../board';
import { bbox, distToSegment, insideLasso, pointInPolygon, uid } from '../geometry';
import { drawEl } from '../renderer';
import { store } from '../store';
import { ui } from '../ui/scale';
import type { El, PathEl } from '../types';

/** Densify a polyline so no segment is longer than `step`. */
function densify(pts: number[], step: number): number[] {
  const out: number[] = [pts[0], pts[1], pts[2]];
  for (let i = 3; i < pts.length; i += 3) {
    const ax = pts[i - 3], ay = pts[i - 2], bx = pts[i], by = pts[i + 1];
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.ceil(d / step);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t, pts[i - 1] + (pts[i + 2] - pts[i - 1]) * t);
    }
    out.push(bx, by, pts[i + 2]);
  }
  return out;
}

/** Split a path, removing points within radius r of segment (ax,ay)-(bx,by). */
export function splitPath(el: PathEl, ax: number, ay: number, bx: number, by: number, r: number): PathEl[] | null {
  // Rubbing out lines leaves paint-bucket fills alone (Object eraser removes them).
  if (el.region) return null;
  let pts = el.pts;
  if (el.closed) pts = pts.concat([pts[0], pts[1], pts[2]]);
  pts = densify(pts, Math.max(1, r / 2));
  const runs: number[][] = [];
  let cur: number[] = [];
  let removed = false;
  const rr = r + el.size / 2;
  for (let i = 0; i < pts.length; i += 3) {
    if (distToSegment(pts[i], pts[i + 1], ax, ay, bx, by) <= rr) {
      removed = true;
      if (cur.length) runs.push(cur);
      cur = [];
    } else cur.push(pts[i], pts[i + 1], pts[i + 2]);
  }
  if (cur.length) runs.push(cur);
  if (!removed) return null;
  return runs
    .filter((run) => run.length >= 6)
    .map((run) => ({ ...el, id: uid(), pts: run, closed: false, fill: null, arrow: 0 as const }));
}

export class EraserTool implements Tool {
  cursor = 'none';
  palm = false;
  private active: { id: number; lx: number; ly: number; r: number } | null = null;
  /** id → replacement pieces ([] = deleted) */
  private changes = new Map<string, El[]>();
  private pos: { x: number; y: number; r: number } | null = null;
  /** Area mode: the loop being drawn. */
  private lasso: number[] | null = null;

  constructor(private board: Board) {}

  private radius(p: Ptr): number {
    if (this.palm) return (Math.max(p.width, p.height, 60) / 2) * this.board.px * 1.4;
    // The eraser is sized on screen (a finger / duster), bigger on big panels.
    return (store.tool.eraserSize / 2) * this.board.px * Math.max(1, ui());
  }

  private mode() {
    return this.palm ? 'point' : store.tool.eraserMode;
  }

  down(p: Ptr): void {
    if (this.active) return;
    this.changes.clear();
    if (this.mode() === 'area') {
      this.active = { id: p.id, lx: p.x, ly: p.y, r: 0 };
      this.lasso = [p.x, p.y];
      this.board.invalidate('overlay');
      return;
    }
    const r = this.radius(p);
    this.active = { id: p.id, lx: p.x, ly: p.y, r };
    this.pos = { x: p.x, y: p.y, r };
    this.eraseSegment(p.x, p.y, p.x, p.y, r);
    this.board.invalidate('ink', 'overlay');
  }

  move(p: Ptr): void {
    const a = this.active;
    if (!a || a.id !== p.id) return;
    if (this.lasso) {
      for (const [x, y] of p.samples) this.lasso.push(x, y);
      this.board.invalidate('overlay');
      return;
    }
    if (this.palm) a.r = Math.max(a.r, this.radius(p));
    this.pos = { x: p.x, y: p.y, r: a.r };
    for (const [x, y] of p.samples) {
      this.eraseSegment(a.lx, a.ly, x, y, a.r);
      a.lx = x;
      a.ly = y;
    }
    this.board.invalidate('ink', 'overlay');
  }

  /** Current working list of elements (original minus changes plus pieces). */
  private working(): El[] {
    const out: El[] = [];
    for (const e of store.page.els) {
      const c = this.changes.get(e.id);
      if (c) out.push(...c);
      else out.push(e);
    }
    return out;
  }

  private eraseSegment(ax: number, ay: number, bx: number, by: number, r: number): void {
    const mode = this.mode();
    const minX = Math.min(ax, bx) - r, maxX = Math.max(ax, bx) + r;
    const minY = Math.min(ay, by) - r, maxY = Math.max(ay, by) + r;
    // Iterate originals; for already split ones, iterate their pieces.
    for (const orig of store.page.els) {
      if (orig.locked) continue;
      const current = this.changes.get(orig.id) ?? [orig];
      if (!current.length) continue;
      let changed = false;
      const next: El[] = [];
      for (const el of current) {
        const b = bbox(el);
        if (b.x > maxX || b.x + b.w < minX || b.y > maxY || b.y + b.h < minY) {
          next.push(el);
          continue;
        }
        if (mode === 'point' && el.type === 'path') {
          const pieces = splitPath(el, ax, ay, bx, by, r);
          if (pieces) {
            next.push(...pieces);
            changed = true;
          } else next.push(el);
        } else if (this.segmentHits(el, ax, ay, bx, by, r)) {
          changed = true;
        } else next.push(el);
      }
      if (changed) {
        this.changes.set(orig.id, next);
        // Object mode: a graph or 3-D shape goes as one piece.
        if (mode !== 'point' && orig.group) this.removeGroup(orig.group);
      }
    }
  }

  private removeGroup(group: string): void {
    for (const e of store.page.els) if (e.group === group && !e.locked) this.changes.set(e.id, []);
  }

  private segmentHits(el: El, ax: number, ay: number, bx: number, by: number, r: number): boolean {
    if (el.type !== 'path') {
      // Boxes: sample along the eraser segment.
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / Math.max(1, r)));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        const b = bbox(el);
        if (x >= b.x - r && x <= b.x + b.w + r && y >= b.y - r && y <= b.y + b.h + r) return true;
      }
      return false;
    }
    const p = el.pts;
    const rr = r + el.size / 2;
    if (p.length === 3) return distToSegment(p[0], p[1], ax, ay, bx, by) <= rr;
    // Touching anywhere inside a closed or filled shape counts too.
    if ((el.closed || el.fill) && p.length >= 9 && (pointInPolygon(ax, ay, p, 3) || pointInPolygon(bx, by, p, 3))) return true;
    const pts = el.style === 'shape' ? densify(el.closed ? p.concat([p[0], p[1], p[2]]) : p, Math.max(1, r)) : p;
    for (let i = 0; i < pts.length; i += 3) {
      if (distToSegment(pts[i], pts[i + 1], ax, ay, bx, by) <= rr) return true;
    }
    return false;
  }

  up(p: Ptr): void {
    if (!this.active || this.active.id !== p.id) return;
    if (this.lasso) {
      // Area mode: everything (mostly) inside the loop goes.
      const loop = this.lasso;
      this.lasso = null;
      if (loop.length > 6) {
        for (const e of store.page.els) {
          if (e.locked || !insideLasso(e, loop)) continue;
          this.changes.set(e.id, []);
          if (e.group) this.removeGroup(e.group);
        }
      }
    }
    if (this.changes.size) {
      store.setEls(this.working());
    }
    this.reset();
  }

  cancel(): void {
    this.reset();
  }

  private reset(): void {
    this.active = null;
    this.lasso = null;
    this.changes.clear();
    if (this.palm) this.pos = null;
    this.board.invalidate('ink', 'overlay');
  }

  hover(p: Ptr | null): void {
    this.pos = p ? { x: p.x, y: p.y, r: this.radius(p) } : null;
  }

  hidden(): Set<string> | null {
    return this.changes.size ? new Set(this.changes.keys()) : null;
  }

  drawInk(ctx: CanvasRenderingContext2D): void {
    for (const pieces of this.changes.values()) for (const el of pieces) drawEl(ctx, el);
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    const px = this.board.px;
    const active = store.tool.tool === 'eraser' || this.palm;
    if (this.lasso && this.lasso.length > 2) {
      const l = this.lasso;
      ctx.beginPath();
      ctx.moveTo(l[0], l[1]);
      for (let i = 2; i < l.length; i += 2) ctx.lineTo(l[i], l[i + 1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(239,68,68,0.12)';
      ctx.fill();
      ctx.setLineDash([6 * px, 5 * px]);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2 * px;
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    if (this.pos && active && this.mode() !== 'area') {
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.pos.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(15,23,42,0.6)';
      ctx.lineWidth = 1.2 * px;
      ctx.stroke();
    }
  }
}
