import type { Board, Ptr, Tool } from '../board';
import { applyMat, bbox, hitTest, IDENTITY, insideLasso, type Mat, pathFromPoints, resizeEl, similarity, transformEl } from '../geometry';
import { drawEl, isDarkColor } from '../renderer';
import { ui } from '../ui/scale';
import { toggleTape } from './tape';
import { store } from '../store';
import type { El, PathEl, Rect, TextEl } from '../types';
import { arcThrough } from '../shapes';
import { drawGuides, type Guide, guideTargets, snapToGuides } from '../guides';
import { cellAt, type TableEditor } from './table';
import type { TextEditor } from './text';

type Mode =
  | { k: 'move'; sx: number; sy: number; moved: boolean; clicked: El | null; r0: Rect | null; targets: Rect[] | null }
  /** hx / hy: which side is dragged (-1 left/top, 1 right/bottom, 0 untouched). */
  | { k: 'resize'; r: Rect; hx: number; hy: number; keep: boolean }
  | { k: 'rotate'; cx: number; cy: number; a0: number }
  | { k: 'lasso'; pts: number[]; add: boolean }
  /** Bending an arc by its middle handle. */
  | { k: 'bend'; el: PathEl; preview: PathEl | null };

const HANDLE = 10;

type Handle = { x: number; y: number; hx: number; hy: number };

export class SelectTool implements Tool {
  cursor = 'default';
  private mode: Mode | null = null;
  private pid = -1;
  private mat: Mat = IDENTITY;
  private lastTap = { t: 0, id: '' };
  /** Alignment guides shown while moving. */
  private guides: Guide[] = [];
  /** Anchor and stretch factors while resizing. */
  private resizeArgs: [number, number, number, number] | null = null;

  /** Set by the app: typing into table cells. */
  tableEditor: TableEditor | null = null;

  constructor(private board: Board, private editor: TextEditor) {}

  private bounds(): Rect | null {
    return this.board.selectionBounds();
  }

  /** Can the selection be stretched in one direction (no text, pictures or rotated items)? */
  private stretchable(): boolean {
    return store.selectedEls().every((e) => e.type === 'path' || e.type === 'table');
  }

  private handles(r: Rect): { grips: Handle[]; rot: [number, number] } {
    const px = this.board.px;
    const grips: Handle[] = [];
    for (const hy of [-1, 0, 1])
      for (const hx of [-1, 0, 1]) {
        if (!hx && !hy) continue;
        if ((!hx || !hy) && !this.stretchable()) continue;
        grips.push({ x: r.x + ((hx + 1) / 2) * r.w, y: r.y + ((hy + 1) / 2) * r.h, hx, hy });
      }
    return { grips, rot: [r.x + r.w / 2, r.y - 40 * px] };
  }

  private gripAt(p: Ptr, r: Rect): Handle | null {
    const hr = this.hitRadius(p);
    let best: Handle | null = null;
    let bd = hr;
    for (const g of this.handles(r).grips) {
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    return best;
  }

  /** The one selected arc (its bend handle is shown). */
  private selectedArc(): PathEl | null {
    const els = store.selectedEls();
    const e = els.length === 1 ? els[0] : null;
    return e && e.type === 'path' && e.arc && !e.locked && e.pts.length >= 9 ? e : null;
  }

  private arcHandle(e: PathEl): [number, number] {
    const n = e.pts.length / 3;
    const i = Math.floor(n / 2) * 3;
    return [e.pts[i], e.pts[i + 1]];
  }

  private hitsArcHandle(p: Ptr): PathEl | null {
    const e = this.selectedArc();
    if (!e) return null;
    const [x, y] = this.arcHandle(e);
    return Math.hypot(p.x - x, p.y - y) < this.hitRadius(p) * 1.2 ? e : null;
  }

  private hitRadius(p: Ptr): number {
    return HANDLE * 2 * this.board.px * ui() * (p.type === 'touch' ? 1.6 : 1);
  }

  private topHit(x: number, y: number): El | null {
    const els = store.page.els;
    const tol = 6 * this.board.px;
    for (let i = els.length - 1; i >= 0; i--) {
      if (!els[i].locked && hitTest(els[i], x, y, tol)) return els[i];
    }
    // A group (e.g. a graph) can be grabbed anywhere inside its outline.
    const boxes = new Map<string, { r: Rect; el: El; z: number }>();
    els.forEach((e, z) => {
      if (!e.group || e.locked) return;
      const b = bbox(e), cur = boxes.get(e.group);
      if (!cur) boxes.set(e.group, { r: { ...b }, el: e, z });
      else {
        const x1 = Math.min(cur.r.x, b.x), y1 = Math.min(cur.r.y, b.y);
        cur.r = { x: x1, y: y1, w: Math.max(cur.r.x + cur.r.w, b.x + b.w) - x1, h: Math.max(cur.r.y + cur.r.h, b.y + b.h) - y1 };
        cur.z = z;
      }
    });
    let best: { el: El; z: number } | null = null;
    for (const g of boxes.values()) {
      if (x >= g.r.x && x <= g.r.x + g.r.w && y >= g.r.y && y <= g.r.y + g.r.h && (!best || g.z > best.z)) best = g;
    }
    return best?.el ?? null;
  }

  /** Does the pointer land on the current selection or one of its handles? */
  hitsSelection(p: Ptr): boolean {
    const r = this.bounds();
    if (!r) return false;
    if (this.hitsArcHandle(p)) return true;
    const h = this.handles(r);
    if (Math.hypot(p.x - h.rot[0], p.y - h.rot[1]) < this.hitRadius(p)) return true;
    if (this.gripAt(p, r)) return true;
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  get busy(): boolean {
    return !!this.mode;
  }

  down(p: Ptr): void {
    if (this.mode) return;
    this.pid = p.id;
    this.mat = IDENTITY;
    const arc = this.hitsArcHandle(p);
    if (arc) {
      this.mode = { k: 'bend', el: arc, preview: null };
      return;
    }
    const r = this.bounds();
    if (r) {
      const h = this.handles(r);
      if (Math.hypot(p.x - h.rot[0], p.y - h.rot[1]) < this.hitRadius(p)) {
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        this.mode = { k: 'rotate', cx, cy, a0: Math.atan2(p.y - cy, p.x - cx) };
        return;
      }
      const g = this.gripAt(p, r);
      if (g) {
        this.mode = { k: 'resize', r, hx: g.hx, hy: g.hy, keep: !this.stretchable() };
        return;
      }
    }
    const hit = this.topHit(p.x, p.y);
    if (hit) {
      if (p.shift) {
        const sel = new Set(store.selection);
        if (sel.has(hit.id)) sel.delete(hit.id);
        else sel.add(hit.id);
        store.select(sel);
      } else if (!store.selection.has(hit.id)) store.select([hit.id]);
      this.mode = { k: 'move', sx: p.x, sy: p.y, moved: false, clicked: hit, r0: null, targets: null };
      return;
    }
    if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      this.mode = { k: 'move', sx: p.x, sy: p.y, moved: false, clicked: null, r0: null, targets: null };
      return;
    }
    if (!p.shift) store.clearSelection();
    this.mode = { k: 'lasso', pts: [p.x, p.y], add: p.shift };
  }

  move(p: Ptr): void {
    const m = this.mode;
    if (!m || p.id !== this.pid) return;
    switch (m.k) {
      case 'move': {
        let dx = p.x - m.sx, dy = p.y - m.sy;
        if (!m.moved && Math.hypot(dx, dy) < 3 * this.board.px) return;
        m.moved = true;
        // Smart guides: line up with other drawings and the page (Alt = free move).
        m.r0 ??= this.bounds();
        m.targets ??= guideTargets(store.page.els, store.selection);
        this.guides = [];
        if (m.r0 && !p.alt) {
          const g = snapToGuides({ ...m.r0, x: m.r0.x + dx, y: m.r0.y + dy }, m.targets, 8 * this.board.px);
          dx += g.dx;
          dy += g.dy;
          this.guides = g.guides;
        }
        this.mat = [1, 0, 0, 1, dx, dy];
        break;
      }
      case 'resize': {
        const { r, hx, hy } = m;
        const min = 6 * this.board.px;
        // The opposite side stays put.
        const ax = hx > 0 ? r.x : r.x + r.w, ay = hy > 0 ? r.y : r.y + r.h;
        let sx = hx ? Math.max(min, (p.x - ax) * hx) / r.w : 1;
        let sy = hy ? Math.max(min, (p.y - ay) * hy) / r.h : 1;
        if (m.keep) sx = sy = Math.max(hx ? sx : 0, hy ? sy : 0);
        this.mat = [sx, 0, 0, sy, ax - ax * sx, ay - ay * sy];
        this.resizeArgs = [ax, ay, sx, sy];
        break;
      }
      case 'rotate': {
        let a = Math.atan2(p.y - m.cy, p.x - m.cx) - m.a0;
        const step = Math.PI / 12;
        if (!p.alt && Math.abs(a - Math.round(a / step) * step) < 0.06) a = Math.round(a / step) * step;
        this.mat = similarity(m.cx, m.cy, 1, a, 0, 0);
        break;
      }
      case 'lasso':
        for (const [x, y] of p.samples) m.pts.push(x, y);
        break;
      case 'bend': {
        const q = m.el.pts, n = q.length;
        m.preview = { ...m.el, pts: pathFromPoints(arcThrough(q[0], q[1], q[n - 3], q[n - 2], p.x, p.y), false) };
        break;
      }
    }
    this.board.invalidate('ink', 'overlay');
  }

  up(p: Ptr): void {
    const m = this.mode;
    if (!m || p.id !== this.pid) return;
    this.mode = null;
    if (m.k === 'bend') {
      const pv = m.preview;
      if (pv) store.mapEls(new Set([m.el.id]), () => pv);
    } else if (m.k === 'lasso') {
      if (m.pts.length > 6) {
        const ids = store.page.els.filter((e) => !e.locked && insideLasso(e, m.pts)).map((e) => e.id);
        store.select(m.add ? [...store.selection, ...ids] : ids);
      }
    } else if (m.k === 'move' && !m.moved) {
      const el = m.clicked;
      if (el) {
        const now = performance.now();
        const dbl = this.lastTap.id === el.id && now - this.lastTap.t < 400;
        this.lastTap = { t: now, id: el.id };
        if (el.type === 'tape') {
          toggleTape(el);
          store.clearSelection();
        } else if (dbl && el.type === 'text') {
          store.clearSelection();
          this.editor.open(el as TextEl, false);
        } else if (dbl && el.type === 'table' && !el.rot && this.tableEditor) {
          const cell = cellAt(el, p.x, p.y);
          if (cell) this.tableEditor.open(el, cell[0], cell[1]);
        }
      }
    } else if (m.k === 'resize' && this.resizeArgs) {
      const [ax, ay, sx, sy] = this.resizeArgs;
      store.mapEls(store.selection, (e) => resizeEl(e, ax, ay, sx, sy));
    } else if (this.mat !== IDENTITY) {
      const mat = this.mat;
      store.mapEls(store.selection, (e) => transformEl(e, mat));
    }
    this.mat = IDENTITY;
    this.resizeArgs = null;
    this.guides = [];
    this.board.invalidate('ink', 'overlay');
  }

  cancel(): void {
    this.mode = null;
    this.mat = IDENTITY;
    this.resizeArgs = null;
    this.guides = [];
    this.board.invalidate('ink', 'overlay');
  }

  hidden(): Set<string> | null {
    if (this.mode?.k === 'bend' && this.mode.preview) return store.selection;
    return this.mat !== IDENTITY ? store.selection : null;
  }

  drawInk(ctx: CanvasRenderingContext2D): void {
    if (this.mode?.k === 'bend' && this.mode.preview) return drawEl(ctx, this.mode.preview);
    if (this.mat === IDENTITY) return;
    if (this.resizeArgs) {
      const [ax, ay, sx, sy] = this.resizeArgs;
      for (const el of store.selectedEls()) drawEl(ctx, resizeEl(el, ax, ay, sx, sy));
      return;
    }
    ctx.save();
    ctx.transform(...this.mat);
    for (const el of store.selectedEls()) drawEl(ctx, el);
    ctx.restore();
  }

  hover(p: Ptr | null): void {
    if (store.tool.tool !== 'select' && !(store.tool.tool === 'shape' && store.selection.size)) return;
    if (!p) return;
    const r = this.bounds();
    let cursor = 'default';
    if (r) {
      const h = this.handles(r);
      const g = this.gripAt(p, r);
      if (this.hitsArcHandle(p)) cursor = 'pointer';
      else if (Math.hypot(p.x - h.rot[0], p.y - h.rot[1]) < this.hitRadius(p)) cursor = 'grab';
      else if (g) cursor = !g.hx ? 'ns-resize' : !g.hy ? 'ew-resize' : g.hx === g.hy ? 'nwse-resize' : 'nesw-resize';
      else if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) cursor = 'move';
    }
    if (cursor === 'default' && this.topHit(p.x, p.y)) cursor = 'move';
    this.board.overlay.style.cursor = cursor;
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (store.tool.tool !== 'select' && store.tool.tool !== 'shape') return;
    // Monochrome (Physica style): white on dark boards, near-black on light ones.
    const ink = isDarkColor(store.page.bg) ? '#ffffff' : '#111111';
    const inkSoft = isDarkColor(store.page.bg) ? 'rgba(255,255,255,0.45)' : 'rgba(17,17,17,0.45)';
    const inkFill = isDarkColor(store.page.bg) ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)';
    const px = this.board.px;
    // Handles are sized for fingers on big panels too.
    const hp = px * ui();
    const m = this.mode;
    if (m?.k === 'lasso' && m.pts.length > 2) {
      ctx.beginPath();
      ctx.moveTo(m.pts[0], m.pts[1]);
      for (let i = 2; i < m.pts.length; i += 2) ctx.lineTo(m.pts[i], m.pts[i + 1]);
      ctx.closePath();
      ctx.fillStyle = inkFill;
      ctx.fill();
      ctx.setLineDash([6 * px, 5 * px]);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5 * px;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    drawGuides(ctx, this.guides, px);
    const r = this.bounds();
    if (!r) return;
    const mat = this.mat;
    // Outline of each selected element (subtle).
    ctx.strokeStyle = inkSoft;
    ctx.lineWidth = 1 * px;
    const sel = store.selectedEls();
    // One group (a graph): just the outer frame, no box around every piece.
    const oneGroup = sel.length > 1 && !!sel[0].group && sel.every((e) => e.group === sel[0].group);
    if (store.selection.size > 1 && !oneGroup) {
      for (const el of sel) {
        const b = bbox(el);
        this.polyRect(ctx, b, mat);
        ctx.stroke();
      }
    }
    const pad = 6 * px;
    const R = { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5 * px;
    ctx.setLineDash([5 * px, 4 * px]);
    this.polyRect(ctx, R, mat);
    ctx.stroke();
    ctx.setLineDash([]);
    const h = this.handles(r);
    const full = mat;
    const [tx, ty] = applyMat(full, r.x + r.w / 2, r.y);
    // While resizing the knob follows the top edge; otherwise it moves/rotates with the selection.
    const [rx, ry2] = this.resizeArgs ? [tx, ty - 40 * hp] : applyMat(full, h.rot[0], h.rot[1]);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(rx, ry2);
    ctx.stroke();
    const handle = (x: number, y: number, round: boolean) => {
      ctx.beginPath();
      if (round) ctx.arc(x, y, HANDLE * hp, 0, Math.PI * 2);
      else ctx.rect(x - HANDLE * 0.8 * hp, y - HANDLE * 0.8 * hp, HANDLE * 1.6 * hp, HANDLE * 1.6 * hp);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 2 * px;
      ctx.strokeStyle = ink;
      ctx.stroke();
    };
    for (const g of h.grips) {
      const [x, y] = applyMat(full, g.x, g.y);
      if (g.hx && g.hy) handle(x, y, false);
      else {
        // Edge grip: a pill along the side.
        const w = (g.hx ? 7 : 22) * hp, hh = (g.hx ? 22 : 7) * hp;
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - hh / 2, w, hh, 4 * hp);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 2 * px;
        ctx.strokeStyle = ink;
        ctx.stroke();
      }
    }
    handle(rx, ry2, true);
    // Arc: a coloured bend handle at its middle.
    const arc = this.selectedArc();
    if (arc && mat === IDENTITY) {
      const m2 = this.mode;
      const [ax, ay] = m2?.k === 'bend' && m2.preview ? this.arcHandle(m2.preview) : this.arcHandle(arc);
      ctx.beginPath();
      ctx.arc(ax, ay, HANDLE * 1.15 * hp, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();
      ctx.lineWidth = 2.5 * px;
      ctx.strokeStyle = isDarkColor(store.page.bg) ? '#000' : '#fff';
      ctx.stroke();
    }
    ctx.fillStyle = ink;
    ctx.font = `700 ${12 * hp}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⟳', rx, ry2 + 0.5 * hp);
    ctx.textAlign = 'left';
  }

  private polyRect(ctx: CanvasRenderingContext2D, r: Rect, m: Mat): void {
    const pts = [
      applyMat(m, r.x, r.y),
      applyMat(m, r.x + r.w, r.y),
      applyMat(m, r.x + r.w, r.y + r.h),
      applyMat(m, r.x, r.y + r.h),
    ];
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (const q of pts.slice(1)) ctx.lineTo(...q);
    ctx.closePath();
  }
}
