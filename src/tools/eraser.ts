import type { Board, Ptr, Tool } from '../board';
import { bbox, distToSegment, uid } from '../geometry';
import { drawEl } from '../renderer';
import { store } from '../store';
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

  constructor(private board: Board) {}

  private radius(p: Ptr): number {
    if (this.palm) return (Math.max(p.width, p.height, 60) / 2) * this.board.px * 1.4;
    return (store.tool.eraserSize / 2) * this.board.px;
  }

  private mode() {
    return this.palm ? 'point' : store.tool.eraserMode;
  }

  down(p: Ptr): void {
    if (this.active) return;
    this.changes.clear();
    const r = this.radius(p);
    this.active = { id: p.id, lx: p.x, ly: p.y, r };
    this.pos = { x: p.x, y: p.y, r };
    this.eraseSegment(p.x, p.y, p.x, p.y, r);
    this.board.invalidate('ink', 'overlay');
  }

  move(p: Ptr): void {
    const a = this.active;
    if (!a || a.id !== p.id) return;
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
      if (changed) this.changes.set(orig.id, next);
    }
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
    const pts = el.style === 'shape' ? densify(el.closed ? p.concat([p[0], p[1], p[2]]) : p, Math.max(1, r)) : p;
    for (let i = 0; i < pts.length; i += 3) {
      if (distToSegment(pts[i], pts[i + 1], ax, ay, bx, by) <= rr) return true;
    }
    return false;
  }

  up(p: Ptr): void {
    if (!this.active || this.active.id !== p.id) return;
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
    if (this.pos && active) {
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
