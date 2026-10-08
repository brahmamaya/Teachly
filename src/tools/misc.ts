import type { Board, Ptr, Tool } from '../board';
import { bbox, translateEl, uid, unionRects } from '../geometry';
import { drawGuides, type Guide, guideTargets, snapToGuides } from '../guides';
import { drawPathEl } from '../renderer';
import { buildShape } from '../shapes';
import { store } from '../store';
import { inkScale } from '../ui/scale';
import type { PathEl, Rect } from '../types';
import type { SelectTool } from './select';

/**
 * Shape tool. A newly drawn shape stays selected so its colour, thickness,
 * fill and size can be changed straight away; dragging the selected shape
 * moves / resizes it, dragging anywhere else draws the next shape.
 */
export class ShapeTool implements Tool {
  cursor = 'crosshair';
  private start: { id: number; x: number; y: number } | null = null;
  private preview: PathEl[] = [];
  private delegating = false;
  /** Smart guides for the shape being drawn. */
  private guides: Guide[] = [];
  private targets: Rect[] = [];

  constructor(private board: Board, private select: SelectTool) {}

  private style() {
    const t = store.tool;
    return { color: t.shapeColor, size: t.shapeSize * inkScale(), fill: t.shapeFill };
  }

  down(p: Ptr): void {
    if (this.start || this.delegating) return;
    if (store.selection.size && this.select.hitsSelection(p)) {
      this.delegating = true;
      this.select.down(p);
      return;
    }
    store.clearSelection();
    const snap = this.board.instruments.snapAt(p.x, p.y);
    const [x, y] = snap ? snap.project(p.x, p.y) : [p.x, p.y];
    this.start = { id: p.id, x, y };
    this.preview = [];
    this.targets = guideTargets(store.page.els, new Set());
  }

  move(p: Ptr): void {
    if (this.delegating) return this.select.move(p);
    const s = this.start;
    if (!s || s.id !== p.id) return;
    this.preview = buildShape(store.tool.shape, s.x, s.y, p.x, p.y, this.style(), p.shift);
    // Line the new shape up with what is already on the page (Alt = free).
    this.guides = [];
    const box = unionRects(this.preview.map(bbox));
    if (box && !p.alt) {
      const g = snapToGuides(box, this.targets, 8 * this.board.px);
      if (g.dx || g.dy) this.preview = this.preview.map((e) => translateEl(e, g.dx, g.dy));
      this.guides = g.guides;
    }
    this.board.invalidate('overlay');
  }

  up(p: Ptr): void {
    if (this.delegating) {
      this.delegating = false;
      return this.select.up(p);
    }
    const s = this.start;
    if (!s || s.id !== p.id) return;
    this.start = null;
    let els = this.preview;
    if (Math.hypot(p.x - s.x, p.y - s.y) < 6 * this.board.px) {
      // Tap: drop a default-sized shape.
      const axes = store.tool.shape === 'axes2' || store.tool.shape === 'axes3';
      const d = (axes ? 420 : 160) * inkScale(), dh = axes ? d * 0.8 : d;
      const line = ['line', 'arrow', 'dashed', 'arc'].includes(store.tool.shape);
      els = buildShape(store.tool.shape, s.x - d / 2, s.y - (line ? 0 : dh / 2), s.x + d / 2, s.y + (line ? 0 : dh / 2), this.style(), false);
    }
    this.preview = [];
    this.guides = [];
    // Shapes made of several lines (3-D shapes, axes) stay together.
    if (els.length > 1) {
      const group = uid();
      els = els.map((e) => ({ ...e, group }));
    }
    store.addEls(els);
    store.select(els.map((e) => e.id));
  }

  cancel(): void {
    if (this.delegating) this.select.cancel();
    this.delegating = false;
    this.start = null;
    this.preview = [];
    this.board.invalidate('overlay');
  }

  hover(p: Ptr | null): void {
    if (p && store.selection.size && this.select.hitsSelection(p)) this.select.hover(p);
    else this.board.overlay.style.cursor = 'crosshair';
  }

  hidden(): Set<string> | null {
    return this.select.hidden();
  }

  drawInk(ctx: CanvasRenderingContext2D): void {
    this.select.drawInk(ctx);
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    for (const el of this.preview) drawPathEl(ctx, el);
    if (this.start) drawGuides(ctx, this.guides, this.board.px);
  }
}

/**
 * Compass: drag from the centre to set the radius, then drag around to draw
 * an arc. Tap to reuse the previous radius at a new centre — handy for
 * geometric constructions.
 */
export class CompassTool implements Tool {
  cursor = 'crosshair';
  private phase: 'idle' | 'radius' | 'ready' | 'arc' = 'idle';
  private cx = 0;
  private cy = 0;
  private r = 0;
  private lastR = 0;
  private a0 = 0;
  private acc = 0;
  private prevA = 0;
  private arc: number[] = [];
  private pid = -1;
  private hoverPos: { x: number; y: number } | null = null;

  constructor(private board: Board) {}

  down(p: Ptr): void {
    this.pid = p.id;
    if (this.phase === 'ready') {
      this.phase = 'arc';
      this.a0 = this.prevA = Math.atan2(p.y - this.cy, p.x - this.cx);
      this.acc = 0;
      this.arc = [this.cx + Math.cos(this.a0) * this.r, this.cy + Math.sin(this.a0) * this.r, 0.5];
    } else {
      this.phase = 'radius';
      this.cx = p.x;
      this.cy = p.y;
      this.r = 0;
    }
    this.board.invalidate('overlay');
  }

  move(p: Ptr): void {
    if (p.id !== this.pid) return;
    if (this.phase === 'radius') {
      this.r = Math.hypot(p.x - this.cx, p.y - this.cy);
    } else if (this.phase === 'arc') {
      for (const [x, y] of p.samples) {
        const a = Math.atan2(y - this.cy, x - this.cx);
        let d = a - this.prevA;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        this.acc = Math.max(-Math.PI * 2, Math.min(Math.PI * 2, this.acc + d));
        this.prevA = a;
      }
      this.arc = [];
      const steps = Math.max(2, Math.ceil(Math.abs(this.acc) / (Math.PI / 90)));
      for (let i = 0; i <= steps; i++) {
        const a = this.a0 + (this.acc * i) / steps;
        this.arc.push(this.cx + Math.cos(a) * this.r, this.cy + Math.sin(a) * this.r, 0.5);
      }
    }
    this.hoverPos = { x: p.x, y: p.y };
    this.board.invalidate('overlay');
  }

  up(p: Ptr): void {
    if (p.id !== this.pid) return;
    if (this.phase === 'radius') {
      if (this.r < 4 * this.board.px) {
        if (this.lastR) {
          this.r = this.lastR;
          this.phase = 'ready';
        } else this.phase = 'idle';
      } else {
        this.lastR = this.r;
        this.phase = 'ready';
      }
    } else if (this.phase === 'arc') {
      if (this.arc.length >= 6 && Math.abs(this.acc) > 0.02) {
        const full = Math.abs(this.acc) >= Math.PI * 2 - 0.01;
        const el: PathEl = {
          id: uid(),
          type: 'path',
          style: 'shape',
          pts: this.arc,
          color: store.tool.shapeColor,
          size: store.tool.shapeSize * inkScale(),
          opacity: 1,
          closed: full,
          fill: null,
        };
        store.addEls([el]);
      }
      this.arc = [];
      this.phase = 'idle';
    }
    this.board.invalidate('overlay');
  }

  cancel(): void {
    this.phase = 'idle';
    this.arc = [];
  }

  hover(p: Ptr | null): void {
    this.hoverPos = p ? { x: p.x, y: p.y } : null;
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (store.tool.tool !== 'compass') return;
    const px = this.board.px;
    if (this.phase === 'idle') {
      if (this.hoverPos && this.lastR) {
        ctx.setLineDash([4 * px, 6 * px]);
        ctx.strokeStyle = 'rgba(100,116,139,0.6)';
        ctx.lineWidth = 1 * px;
        ctx.beginPath();
        ctx.arc(this.hoverPos.x, this.hoverPos.y, this.lastR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      return;
    }
    // Guide circle
    ctx.setLineDash([4 * px, 6 * px]);
    ctx.strokeStyle = 'rgba(100,116,139,0.6)';
    ctx.lineWidth = 1 * px;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Legs of the compass
    const a = this.phase === 'arc' ? this.prevA : this.hoverPos ? Math.atan2(this.hoverPos.y - this.cy, this.hoverPos.x - this.cx) : 0;
    const tx = this.cx + Math.cos(a) * this.r, ty = this.cy + Math.sin(a) * this.r;
    const mx = (this.cx + tx) / 2, my = (this.cy + ty) / 2;
    const nx = -(ty - this.cy), ny = tx - this.cx;
    const nl = Math.hypot(nx, ny) || 1;
    const hx = mx + (nx / nl) * this.r * 0.5 * (ny > 0 ? -1 : 1), hy = my + (ny / nl) * this.r * 0.5 * (ny > 0 ? -1 : 1);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4 * px;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.cx, this.cy);
    ctx.lineTo(hx, hy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(hx, hy, 6 * px, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 4 * px, 0, Math.PI * 2);
    ctx.fill();
    // Radius label
    ctx.fillStyle = '#0f172a';
    ctx.font = `600 ${13 * px}px system-ui`;
    ctx.fillText(`r = ${(this.r / 40).toFixed(1)} cm`, mx + 8 * px, my - 8 * px);
    if (this.arc.length) {
      ctx.strokeStyle = store.tool.shapeColor;
      ctx.lineWidth = store.tool.shapeSize * inkScale();
      ctx.beginPath();
      ctx.moveTo(this.arc[0], this.arc[1]);
      for (let i = 3; i < this.arc.length; i += 3) ctx.lineTo(this.arc[i], this.arc[i + 1]);
      ctx.stroke();
    }
  }
}

