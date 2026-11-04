import type { Board, Ptr, Tool } from '../board';
import { bbox, dist, hitTest, pathFromPoints, uid } from '../geometry';
import type { Snapper } from '../instruments';
import { freehandPath, isMarker, markerPath } from '../renderer';
import { recognize } from '../shapes';
import { store } from '../store';
import { inkScale } from '../ui/scale';
import { tapeAt, toggleTape } from './tape';
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
  t0: number;
  /** Finger / board-touch pen: drawn bit by bit on the wet-ink layer. */
  marker: boolean;
  /** Last real finger position (the steadied line catches up to it on lift). */
  rawX?: number;
  rawY?: number;
  /** Where the wet line has been drawn up to (midpoint of the last two samples). */
  midX: number;
  midY: number;
  drawnTo: number;
}

// Hold still this long at the end of a drawing to snap it into a shape.
const HOLD_MS = 800;

export class PenTool implements Tool {
  cursor = 'crosshair';
  private live = new Map<number, Live>();

  constructor(private board: Board) {}

  down(p: Ptr): void {
    if (this.live.size && p.type !== 'pen' && !store.settings.multiWrite) return;
    const t = store.tool;
    const style: PathStyle = t.penStyle;
    const hl = style === 'highlighter';
    const snapper = this.board.instruments.snapAt(p.x, p.y);
    const [x, y] = snapper ? snapper.project(p.x, p.y) : [p.x, p.y];
    const l: Live = {
      pts: [x, y, p.p],
      style,
      color: hl ? t.hlColor : t.color,
      size: (hl ? t.hlSize : t.size) * inkScale(),
      sim: p.type !== 'pen',
      snapper,
      snapped: null,
      holdTimer: 0,
      lastX: x,
      lastY: y,
      predicted: [],
      t0: performance.now(),
      marker: !snapper && isMarker({ style, sim: p.type !== 'pen' }),
      midX: x,
      midY: y,
      drawnTo: 0,
    };
    this.live.set(p.id, l);
    if (l.marker) {
      const ctx = this.wetStyle(l);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.01, y);
      ctx.stroke();
    }
    this.armHold(p.id, l);
    this.board.invalidate('overlay');
  }

  private armHold(id: number, l: Live): void {
    clearTimeout(l.holdTimer);
    // Off unless chosen in the menu: on big boards touch events can pause
    // mid-line, and the writing must stay exactly as written.
    if (l.snapper || !store.settings.holdShapes) return;
    l.holdTimer = window.setTimeout(() => {
      if (this.live.get(id) !== l || l.snapped) return;
      // Ignore small marks (letters, dots) so handwriting is never turned into shapes.
      if (!this.bigEnough(l)) return;
      const shape = this.toShape(l);
      if (shape) {
        l.snapped = shape;
        if (l.marker) this.board.renderWet();
        navigator.vibrate?.(10);
        this.board.invalidate('overlay');
      }
    }, HOLD_MS);
  }

  private wetStyle(l: Live): CanvasRenderingContext2D {
    const ctx = this.board.wetBegin();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = l.color;
    ctx.lineWidth = l.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  }

  /** Add only the new part of a marker line to the wet layer (cheap per move). */
  private drawWet(l: Live): void {
    const n = l.pts.length / 3;
    if (n - 1 <= l.drawnTo) return;
    const ctx = this.wetStyle(l);
    ctx.beginPath();
    ctx.moveTo(l.midX, l.midY);
    for (let k = Math.max(1, l.drawnTo + 1); k < n; k++) {
      const px = l.pts[(k - 1) * 3], py = l.pts[(k - 1) * 3 + 1];
      const x = l.pts[k * 3], y = l.pts[k * 3 + 1];
      const mx = (px + x) / 2, my = (py + y) / 2;
      if (k === 1) ctx.lineTo(mx, my);
      else ctx.quadraticCurveTo(px, py, mx, my);
      l.midX = mx;
      l.midY = my;
    }
    // Reach the pen tip too (the next curve starts from the midpoint again).
    ctx.lineTo(l.pts[(n - 1) * 3], l.pts[(n - 1) * 3 + 1]);
    ctx.stroke();
    l.drawnTo = n - 1;
  }

  /** The wet layer was cleared (a line finished, or the view moved): draw the lines still being written. */
  redrawWet(ctx: CanvasRenderingContext2D): boolean {
    let any = false;
    for (const l of this.live.values()) {
      if (!l.marker || l.snapped) continue;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(markerPath(l.pts));
      l.drawnTo = l.pts.length / 3 - 1;
      const n = l.pts.length;
      if (n >= 6) {
        l.midX = (l.pts[n - 6] + l.pts[n - 3]) / 2;
        l.midY = (l.pts[n - 5] + l.pts[n - 2]) / 2;
      }
      any = true;
    }
    return any;
  }

  private tiny(l: Live): boolean {
    for (let i = 3; i < l.pts.length; i += 3) {
      if (dist(l.pts[i], l.pts[i + 1], l.pts[0], l.pts[1]) > 8 * this.board.px) return false;
    }
    return true;
  }

  private bigEnough(l: Live): boolean {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (let i = 0; i < l.pts.length; i += 3) {
      x1 = Math.min(x1, l.pts[i]);
      x2 = Math.max(x2, l.pts[i]);
      y1 = Math.min(y1, l.pts[i + 1]);
      y2 = Math.max(y2, l.pts[i + 1]);
    }
    return Math.max(x2 - x1, y2 - y1) / this.board.px > 70;
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
      let [x, y] = l.snapper ? l.snapper.project(sx, sy) : [sx, sy];
      // Finger / board touch: steady the hand (1-euro style). Slow, careful
      // movement is smoothed more (the touch panel's jitter goes away),
      // fast strokes follow the finger almost exactly (no lag).
      const lvl = store.tool.smooth ?? 2;
      if (!l.snapper && (l.sim || lvl === 2)) {
        const d = dist(x, y, l.lastX, l.lastY) / this.board.px;
        // [floor, speed]: how much a slow move is smoothed, and how fast the
        // line catches up when the hand moves quickly. Stylus: gentler.
        const [f, k] = l.sim ? ([[0.35, 18], [0.22, 45], [0.12, 80]] as const)[lvl] : ([0.45, 30] as const);
        const a = Math.min(1, f + d / k);
        x = l.lastX + (x - l.lastX) * a;
        y = l.lastY + (y - l.lastY) * a;
        l.rawX = sx;
        l.rawY = sy;
      }
      if (dist(x, y, l.lastX, l.lastY) < minD) continue;
      l.pts.push(x, y, sp);
      l.lastX = x;
      l.lastY = y;
    }
    l.predicted = [];
    if (l.marker) {
      // Marker: the wet layer alone shows the line — no full-screen redraw per move.
      this.drawWet(l);
      const n2 = l.pts.length;
      if (n2 >= 6 && dist(l.pts[n2 - 3], l.pts[n2 - 2], l.pts[n2 - 6], l.pts[n2 - 5]) > 2 * this.board.px) this.armHold(p.id, l);
      return;
    }
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
    // A quick tap on a tape strip reveals / hides it instead of making a dot.
    if (!l.snapped && !l.snapper && performance.now() - l.t0 < 350 && this.tiny(l)) {
      const t = tapeAt(store.page.els, l.pts[0], l.pts[1], 2 * this.board.px);
      if (t) {
        toggleTape(t);
        if (l.marker) this.board.renderWet();
        this.board.invalidate('overlay');
        return;
      }
    }
    // The steadied line ends exactly where the finger lifted.
    if (!l.snapper && !l.snapped && l.rawX !== undefined && l.rawY !== undefined && dist(l.rawX, l.rawY, l.lastX, l.lastY) > 0.5 * this.board.px) {
      l.pts.push(l.rawX, l.rawY, l.pts[l.pts.length - 1]);
      if (l.marker) this.drawWet(l);
    }
    let el: PathEl | null = l.snapped;
    if (!el) {
      el = {
        id: uid(),
        type: 'path',
        style: l.snapper ? 'shape' : l.style,
        // Pen: exactly where the hand went. Brush / calligraphy: lightly smoothed.
        pts: l.snapper ? [l.pts[0], l.pts[1], 0.5, l.pts[l.pts.length - 3], l.pts[l.pts.length - 2], 0.5] : l.style === 'pen' || l.style === 'highlighter' ? l.pts : smoothPts(l.pts),
        color: l.color,
        size: l.size,
        opacity: l.snapper && l.style === 'highlighter' ? 0.4 : 1,
        sim: l.sim,
      };
      // Arcs along the protractor must keep every point.
      if (l.snapper && !this.isStraight(l.pts)) el.pts = l.pts;
    }
    // Scribble to erase: a quick back-and-forth scribble over writing rubs
    // that writing out (and leaves no ink of its own).
    if (!l.snapped && !l.snapper && store.settings.scribbleErase !== false && this.scribbleErase(l)) {
      if (l.marker) this.board.renderWet();
      this.board.invalidate('overlay');
      return;
    }
    store.addEls([el]);
    this.board.invalidate('overlay');
  }

  /** Is this stroke a fast scribble? If it covers writing, erase that writing. */
  private scribbleErase(l: Live): boolean {
    const p = l.pts, n = p.length / 3;
    if (n < 8) return false;
    const ms = performance.now() - l.t0;
    let len = 0, turns = 0, prevAng: number | null = null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    // Direction changes measured between points a few pixels apart, so
    // jitter does not count.
    const step = 6 * this.board.px;
    let ax = p[0], ay = p[1];
    for (let i = 0; i < n; i++) {
      const x = p[i * 3], y = p[i * 3 + 1];
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      if (i) len += dist(x, y, p[i * 3 - 3], p[i * 3 - 2]);
      if (dist(x, y, ax, ay) < step) continue;
      const a = Math.atan2(y - ay, x - ax);
      if (prevAng !== null) {
        let d = Math.abs(a - prevAng);
        if (d > Math.PI) d = 2 * Math.PI - d;
        if (d > 2.3) turns++;
      }
      prevAng = a;
      ax = x;
      ay = y;
    }
    const diag = Math.hypot(x1 - x0, y1 - y0);
    // Rubbing on one spot: many back-and-forth turns, a lot of line packed
    // into a small area, done quickly.
    if (turns < 7 || diag < 8 * this.board.px || len < diag * 5 || ms > 1800) return false;
    const tol = Math.max(l.size, 4 * this.board.px);
    const near = store.page.els.filter((el) => {
      if (el.locked || el.type === 'tape' || el.type === 'image') return false;
      const b = bbox(el);
      return !(b.x > x1 + tol || b.x + b.w < x0 - tol || b.y > y1 + tol || b.y + b.h < y0 - tol);
    });
    if (!near.length) return false;
    // Most of the scribble must lie over writing that is already there (new
    // writing next to or across old writing is never taken for rubbing).
    const hits = new Set<string>();
    let onInk = 0, samples = 0;
    for (let i = 0; i < n; i += 2) {
      samples++;
      const x = p[i * 3], y = p[i * 3 + 1];
      let inArea = false;
      for (const el of near) {
        const b = bbox(el);
        if (x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol) inArea = true;
        if (el.type === 'path' ? hitTest(el, x, y, tol) : x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h) hits.add(el.id);
      }
      if (inArea) onInk++;
    }
    if (onInk / Math.max(1, samples) < 0.35) return false;
    if (!hits.size) return false;
    // A graph or other group goes as a whole.
    const groups = new Set(store.page.els.filter((e) => hits.has(e.id) && e.group).map((e) => e.group));
    for (const e of store.page.els) if (e.group && groups.has(e.group)) hits.add(e.id);
    store.replaceEls(hits, []);
    return true;
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
    this.board.renderWet();
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
      // Same smoothing as the finished stroke, so the line does not jump
      // when the pen is lifted.
      if (l.marker) continue; // drawn on the wet-ink layer
      const raw = l.predicted.length ? l.pts.concat(l.predicted) : l.pts;
      const pts = l.snapper || l.style === 'pen' || l.style === 'highlighter' ? raw : smoothPts(raw);
      ctx.globalAlpha = l.style === 'highlighter' ? 0.38 : 1;
      ctx.fillStyle = l.color;
      ctx.fill(freehandPath(pts, { style: l.snapper ? 'highlighter' : l.style, size: l.size, sim: l.sim }, false));
      ctx.globalAlpha = 1;
    }
  }
}

/**
 * Gentle smoothing of a finished stroke (two [1 2 1] passes). It irons out the
 * small zig-zags touch screens add without rounding off real corners much;
 * the end points stay exactly where the pen was.
 */
export function smoothPts(pts: number[]): number[] {
  if (pts.length < 12) return pts;
  let a = pts;
  for (let pass = 0; pass < 2; pass++) {
    const b = a.slice();
    for (let i = 3; i < a.length - 3; i += 3) {
      b[i] = (a[i - 3] + a[i] * 2 + a[i + 3]) / 4;
      b[i + 1] = (a[i - 2] + a[i + 1] * 2 + a[i + 4]) / 4;
    }
    a = b;
  }
  return a;
}
