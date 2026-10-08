import type { Board, Ptr, Tool } from '../board';
import { applyMat, bbox, hitTest, IDENTITY, insideLasso, type Mat, matMul, similarity, transformEl } from '../geometry';
import { drawEl } from '../renderer';
import { store } from '../store';
import type { El, Rect, TextEl } from '../types';
import type { TextEditor } from './text';

type Mode =
  | { k: 'move'; sx: number; sy: number; moved: boolean; clicked: El | null }
  | { k: 'scale'; px: number; py: number; d0: number }
  | { k: 'rotate'; cx: number; cy: number; a0: number }
  | { k: 'lasso'; pts: number[]; add: boolean };

const HANDLE = 9;

export class SelectTool implements Tool {
  cursor = 'default';
  private mode: Mode | null = null;
  private pid = -1;
  private mat: Mat = IDENTITY;
  private lastTap = { t: 0, id: '' };

  constructor(private board: Board, private editor: TextEditor) {}

  private bounds(): Rect | null {
    return this.board.selectionBounds();
  }

  private handles(r: Rect): { corners: [number, number][]; rot: [number, number] } {
    const px = this.board.px;
    return {
      corners: [
        [r.x, r.y],
        [r.x + r.w, r.y],
        [r.x + r.w, r.y + r.h],
        [r.x, r.y + r.h],
      ],
      rot: [r.x + r.w / 2, r.y - 34 * px],
    };
  }

  private topHit(x: number, y: number): El | null {
    const els = store.page.els;
    const tol = 6 * this.board.px;
    for (let i = els.length - 1; i >= 0; i--) {
      if (!els[i].locked && hitTest(els[i], x, y, tol)) return els[i];
    }
    return null;
  }

  /** Does the pointer land on the current selection or one of its handles? */
  hitsSelection(p: Ptr): boolean {
    const r = this.bounds();
    if (!r) return false;
    const hr = HANDLE * 1.8 * this.board.px * (p.type === 'touch' ? 1.6 : 1);
    const h = this.handles(r);
    if (Math.hypot(p.x - h.rot[0], p.y - h.rot[1]) < hr) return true;
    if (h.corners.some(([x, y]) => Math.hypot(p.x - x, p.y - y) < hr)) return true;
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  get busy(): boolean {
    return !!this.mode;
  }

  down(p: Ptr): void {
    if (this.mode) return;
    this.pid = p.id;
    this.mat = IDENTITY;
    const r = this.bounds();
    const px = this.board.px;
    const hr = HANDLE * 1.8 * px * (p.type === 'touch' ? 1.6 : 1);
    if (r) {
      const h = this.handles(r);
      if (Math.hypot(p.x - h.rot[0], p.y - h.rot[1]) < hr) {
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        this.mode = { k: 'rotate', cx, cy, a0: Math.atan2(p.y - cy, p.x - cx) };
        return;
      }
      for (let i = 0; i < 4; i++) {
        const [hx, hy] = h.corners[i];
        if (Math.hypot(p.x - hx, p.y - hy) < hr) {
          const [ox, oy] = h.corners[(i + 2) % 4];
          this.mode = { k: 'scale', px: ox, py: oy, d0: Math.hypot(hx - ox, hy - oy) || 1 };
          return;
        }
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
      this.mode = { k: 'move', sx: p.x, sy: p.y, moved: false, clicked: hit };
      return;
    }
    if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      this.mode = { k: 'move', sx: p.x, sy: p.y, moved: false, clicked: null };
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
        const dx = p.x - m.sx, dy = p.y - m.sy;
        if (!m.moved && Math.hypot(dx, dy) < 3 * this.board.px) return;
        m.moved = true;
        this.mat = [1, 0, 0, 1, dx, dy];
        break;
      }
      case 'scale': {
        const s = Math.max(0.02, Math.hypot(p.x - m.px, p.y - m.py) / m.d0);
        this.mat = similarity(m.px, m.py, s, 0, 0, 0);
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
    }
    this.board.invalidate('ink', 'overlay');
  }

  up(p: Ptr): void {
    const m = this.mode;
    if (!m || p.id !== this.pid) return;
    this.mode = null;
    if (m.k === 'lasso') {
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
        if (dbl && el.type === 'text') {
          store.clearSelection();
          this.editor.open(el as TextEl, false);
        }
      }
    } else if (this.mat !== IDENTITY) {
      const mat = this.mat;
      store.mapEls(store.selection, (e) => transformEl(e, mat));
    }
    this.mat = IDENTITY;
    this.board.invalidate('ink', 'overlay');
  }

  cancel(): void {
    this.mode = null;
    this.mat = IDENTITY;
    this.board.invalidate('ink', 'overlay');
  }

  hidden(): Set<string> | null {
    return this.mat !== IDENTITY ? store.selection : null;
  }

  drawInk(ctx: CanvasRenderingContext2D): void {
    if (this.mat === IDENTITY) return;
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
      const hr = HANDLE * 1.8 * this.board.px;
      if (Math.hypot(p.x - h.rot[0], p.y - h.rot[1]) < hr) cursor = 'grab';
      else if (h.corners.some(([x, y], i) => Math.hypot(p.x - x, p.y - y) < hr && (cursor = i % 2 ? 'nesw-resize' : 'nwse-resize'))) {
        /* cursor set */
      } else if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) cursor = 'move';
    }
    if (cursor === 'default' && this.topHit(p.x, p.y)) cursor = 'move';
    this.board.overlay.style.cursor = cursor;
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (store.tool.tool !== 'select' && store.tool.tool !== 'shape') return;
    const px = this.board.px;
    const m = this.mode;
    if (m?.k === 'lasso' && m.pts.length > 2) {
      ctx.beginPath();
      ctx.moveTo(m.pts[0], m.pts[1]);
      for (let i = 2; i < m.pts.length; i += 2) ctx.lineTo(m.pts[i], m.pts[i + 1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(59,130,246,0.08)';
      ctx.fill();
      ctx.setLineDash([6 * px, 5 * px]);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5 * px;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const r = this.bounds();
    if (!r) return;
    const mat = this.mat;
    // Outline of each selected element (subtle).
    ctx.strokeStyle = 'rgba(59,130,246,0.45)';
    ctx.lineWidth = 1 * px;
    if (store.selection.size > 1) {
      for (const el of store.selectedEls()) {
        const b = bbox(el);
        this.polyRect(ctx, b, mat);
        ctx.stroke();
      }
    }
    const pad = 6 * px;
    const R = { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5 * px;
    ctx.setLineDash([5 * px, 4 * px]);
    this.polyRect(ctx, R, mat);
    ctx.stroke();
    ctx.setLineDash([]);
    const h = this.handles(r);
    const full = matMul(mat, IDENTITY);
    const [tx, ty] = applyMat(full, r.x + r.w / 2, r.y);
    const [rx, ry] = applyMat(full, h.rot[0], h.rot[1]);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    const handle = (x: number, y: number, round: boolean) => {
      ctx.beginPath();
      if (round) ctx.arc(x, y, HANDLE * px, 0, Math.PI * 2);
      else ctx.rect(x - HANDLE * 0.8 * px, y - HANDLE * 0.8 * px, HANDLE * 1.6 * px, HANDLE * 1.6 * px);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 2 * px;
      ctx.strokeStyle = '#3b82f6';
      ctx.stroke();
    };
    for (const [x, y] of h.corners) handle(...applyMat(full, x, y), false);
    handle(rx, ry, true);
    ctx.fillStyle = '#3b82f6';
    ctx.font = `700 ${12 * px}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⟳', rx, ry + 0.5 * px);
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
