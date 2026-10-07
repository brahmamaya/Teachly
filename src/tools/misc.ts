import type { Board, Ptr, Tool } from '../board';
import { uid } from '../geometry';
import { drawPathEl } from '../renderer';
import { buildShape } from '../shapes';
import { store } from '../store';
import type { PathEl } from '../types';

export class ShapeTool implements Tool {
  cursor = 'crosshair';
  private start: { id: number; x: number; y: number } | null = null;
  private preview: PathEl[] = [];

  constructor(private board: Board) {}

  private style() {
    const t = store.tool;
    return { color: t.color, size: Math.max(2, t.size), fill: t.shapeFill ? hexAlpha(t.color, 0.22) : null };
  }

  down(p: Ptr): void {
    if (this.start) return;
    const snap = this.board.instruments.snapAt(p.x, p.y);
    const [x, y] = snap ? snap.project(p.x, p.y) : [p.x, p.y];
    this.start = { id: p.id, x, y };
    this.preview = [];
  }

  move(p: Ptr): void {
    const s = this.start;
    if (!s || s.id !== p.id) return;
    this.preview = buildShape(store.tool.shape, s.x, s.y, p.x, p.y, this.style(), p.shift);
    this.board.invalidate('overlay');
  }

  up(p: Ptr): void {
    const s = this.start;
    if (!s || s.id !== p.id) return;
    this.start = null;
    let els = this.preview;
    if (Math.hypot(p.x - s.x, p.y - s.y) < 6 * this.board.px) {
      // Tap: drop a default-sized shape.
      const d = 140;
      const line = ['line', 'arrow', 'darrow', 'dashed'].includes(store.tool.shape);
      els = buildShape(store.tool.shape, s.x - d / 2, s.y - (line ? 0 : d / 2), s.x + d / 2, s.y + (line ? 0 : d / 2), this.style(), false);
    }
    this.preview = [];
    store.addEls(els);
  }

  cancel(): void {
    this.start = null;
    this.preview = [];
    this.board.invalidate('overlay');
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    for (const el of this.preview) drawPathEl(ctx, el);
  }
}

export function hexAlpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Laser pointer: glowing trail that fades away — never saved. */
export class LaserTool implements Tool {
  cursor = 'none';
  private trails = new Map<number, { x: number; y: number; t: number }[]>();
  private done: { x: number; y: number; t: number }[][] = [];
  private pos: { x: number; y: number } | null = null;

  constructor(private board: Board) {}

  down(p: Ptr): void {
    this.trails.set(p.id, [{ x: p.x, y: p.y, t: performance.now() }]);
    this.pos = { x: p.x, y: p.y };
    this.board.invalidate('overlay');
  }

  move(p: Ptr): void {
    const tr = this.trails.get(p.id);
    this.pos = { x: p.x, y: p.y };
    if (tr) for (const [x, y] of p.samples) tr.push({ x, y, t: performance.now() });
    this.board.invalidate('overlay');
  }

  up(p: Ptr): void {
    const tr = this.trails.get(p.id);
    if (tr) this.done.push(tr);
    this.trails.delete(p.id);
  }

  cancel(): void {
    this.trails.clear();
  }

  hover(p: Ptr | null): void {
    this.pos = p ? { x: p.x, y: p.y } : null;
  }

  drawOverlay(ctx: CanvasRenderingContext2D): boolean {
    const now = performance.now();
    const life = 900;
    const px = this.board.px;
    const all = [...this.done, ...this.trails.values()];
    this.done = this.done.filter((tr) => tr.length && now - tr[tr.length - 1].t < life);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    let alive = false;
    for (const tr of all) {
      for (let i = 1; i < tr.length; i++) {
        const age = (now - tr[i].t) / life;
        if (age >= 1) continue;
        alive = true;
        const a = 1 - age;
        ctx.strokeStyle = `rgba(239,68,68,${a})`;
        ctx.shadowColor = 'rgba(239,68,68,0.9)';
        ctx.shadowBlur = 14;
        ctx.lineWidth = (3 + 5 * a) * px;
        ctx.beginPath();
        ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
        ctx.lineTo(tr[i].x, tr[i].y);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
    if (this.pos && store.tool.tool === 'laser') {
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, 7 * px, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    return alive || this.trails.size > 0;
  }
}

export class PanTool implements Tool {
  cursor = 'grab';
  down(): void {}
  move(): void {}
  up(): void {}
  cancel(): void {}
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
          color: store.tool.color,
          size: Math.max(2, store.tool.size),
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
      ctx.strokeStyle = store.tool.color;
      ctx.lineWidth = Math.max(2, store.tool.size);
      ctx.beginPath();
      ctx.moveTo(this.arc[0], this.arc[1]);
      for (let i = 3; i < this.arc.length; i += 3) ctx.lineTo(this.arc[i], this.arc[i + 1]);
      ctx.stroke();
    }
  }
}
