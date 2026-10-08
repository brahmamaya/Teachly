import type { Board, Ptr, Tool } from '../board';
import { dist, pathFromPoints, uid } from '../geometry';
import type { Snapper } from '../instruments';
import { freehandPath } from '../renderer';
import { recognize } from '../shapes';
import { store } from '../store';
import type { PathEl, PathStyle } from '../types';

interface Live {
  pts: number[];
  style: PathStyle;
  color: string;
  size: number;
  sim: boolean;
  snapper: Snapper | null;
  /** When set, the stroke was converted to a clean shape by holding still. */
  snapped: PathEl | null;
  holdTimer: number;
  lastX: number;
  lastY: number;
  predicted: number[];
}

const HOLD_MS = 550;

export class PenTool implements Tool {
  cursor = 'crosshair';
  private live = new Map<number, Live>();

  constructor(private board: Board) {}

  down(p: Ptr): void {
    if (this.live.size && p.type !== 'pen') return;
    const t = store.tool;
    const style: PathStyle = t.penStyle;
    const hl = style === 'highlighter';
    const snapper = this.board.instruments.snapAt(p.x, p.y);
    const [x, y] = snapper ? snapper.project(p.x, p.y) : [p.x, p.y];
    const l: Live = {
      pts: [x, y, p.p],
      style,
      color: hl ? t.hlColor : t.color,
      size: hl ? t.hlSize : t.size,
      sim: p.type !== 'pen',
      snapper,
      snapped: null,
      holdTimer: 0,
      lastX: x,
      lastY: y,
      predicted: [],
    };
    this.live.set(p.id, l);
    this.armHold(p.id, l);
    this.board.invalidate('overlay');
  }

  private armHold(id: number, l: Live): void {
    clearTimeout(l.holdTimer);
    if (l.snapper) return;
    l.holdTimer = window.setTimeout(() => {
      if (this.live.get(id) !== l || l.snapped) return;
      const shape = this.toShape(l);
      if (shape) {
        l.snapped = shape;
        navigator.vibrate?.(10);
        this.board.invalidate('overlay');
      }
    }, HOLD_MS);
  }

  private toShape(l: Live): PathEl | null {
    const r = recognize(l.pts);
    if (!r) return null;
    return {
      id: uid(),
      type: 'path',
      style: 'shape',
      pts: pathFromPoints(r.pts, r.closed),
      color: l.color,
      size: l.style === 'highlighter' ? l.size : Math.max(2, l.size * 0.9),
      opacity: l.style === 'highlighter' ? 0.4 : 1,
      closed: r.closed,
      fill: null,
    };
  }

  move(p: Ptr): void {
    const l = this.live.get(p.id);
    if (!l || l.snapped) return;
    const minD = 0.6 * this.board.px;
    for (const [sx, sy, sp] of p.samples) {
      const [x, y] = l.snapper ? l.snapper.project(sx, sy) : [sx, sy];
      if (dist(x, y, l.lastX, l.lastY) < minD) continue;
      l.pts.push(x, y, sp);
      l.lastX = x;
      l.lastY = y;
    }
    l.predicted = [];
    if (!l.snapper) for (const [x, y, pp] of p.predicted.slice(0, 2)) l.predicted.push(x, y, pp);
    // Re-arm hold detection only when the pen actually moved noticeably.
    const n = l.pts.length;
    if (n >= 6 && dist(l.pts[n - 3], l.pts[n - 2], l.pts[n - 6], l.pts[n - 5]) > 2 * this.board.px) this.armHold(p.id, l);
    this.board.invalidate('overlay');
  }

  up(p: Ptr): void {
    const l = this.live.get(p.id);
    if (!l) return;
    this.live.delete(p.id);
    clearTimeout(l.holdTimer);
    let el: PathEl | null = l.snapped;
    if (!el) {
      el = {
        id: uid(),
        type: 'path',
        style: l.snapper ? 'shape' : l.style,
        pts: l.snapper ? [l.pts[0], l.pts[1], 0.5, l.pts[l.pts.length - 3], l.pts[l.pts.length - 2], 0.5] : l.pts,
        color: l.color,
        size: l.size,
        opacity: l.snapper && l.style === 'highlighter' ? 0.4 : 1,
        sim: l.sim,
      };
      // Arcs along the protractor must keep every point.
      if (l.snapper && !this.isStraight(l.pts)) el.pts = l.pts;
    }
    store.addEls([el]);
    this.board.invalidate('overlay');
  }

  private isStraight(pts: number[]): boolean {
    const n = pts.length;
    if (n < 9) return true;
    const ax = pts[0], ay = pts[1], bx = pts[n - 3], by = pts[n - 2];
    const L = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = 3; i < n - 3; i += 3) {
      const d = Math.abs((bx - ax) * (ay - pts[i + 1]) - (ax - pts[i]) * (by - ay)) / L;
      if (d > 1) return false;
    }
    return true;
  }

  cancel(): void {
    for (const l of this.live.values()) clearTimeout(l.holdTimer);
    this.live.clear();
    this.board.invalidate('overlay');
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    for (const l of this.live.values()) {
      if (l.snapped) {
        ctx.globalAlpha = l.snapped.opacity;
        ctx.strokeStyle = l.color;
        ctx.lineWidth = l.snapped.size;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        const pts = l.snapped.pts;
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 3; i < pts.length; i += 3) ctx.lineTo(pts[i], pts[i + 1]);
        if (l.snapped.closed) ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      const pts = l.predicted.length ? l.pts.concat(l.predicted) : l.pts;
      ctx.globalAlpha = l.style === 'highlighter' ? 0.38 : 1;
      ctx.fillStyle = l.color;
      ctx.fill(freehandPath(pts, { style: l.snapper ? 'highlighter' : l.style, size: l.size, sim: l.sim }, false));
      ctx.globalAlpha = 1;
    }
  }
}
