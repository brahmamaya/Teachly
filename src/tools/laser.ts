import type { Board, Ptr, Tool } from '../board';
import { store } from '../store';

// Laser pointer: a glowing trail that fades away by itself. Nothing is
// written on the page, so it is perfect for pointing during a lesson.

const FADE_MS = 900;

interface Trail {
  pts: number[]; // x, y, time
  live: boolean;
}

export class LaserTool implements Tool {
  cursor = 'none';
  private trails: Trail[] = [];
  private cur = new Map<number, Trail>();
  private tip: [number, number] | null = null;

  constructor(private board: Board) {}

  down(p: Ptr): void {
    const t: Trail = { pts: [p.x, p.y, performance.now()], live: true };
    this.trails.push(t);
    this.cur.set(p.id, t);
    this.tip = [p.x, p.y];
    this.board.invalidate('overlay');
  }

  move(p: Ptr): void {
    this.tip = [p.x, p.y];
    const t = this.cur.get(p.id);
    if (t) {
      const now = performance.now();
      for (const [x, y] of p.samples) t.pts.push(x, y, now);
    }
    this.board.invalidate('overlay');
  }

  hover(p: Ptr | null): void {
    this.tip = p ? [p.x, p.y] : null;
    this.board.invalidate('overlay');
  }

  up(p: Ptr): void {
    const t = this.cur.get(p.id);
    if (t) t.live = false;
    this.cur.delete(p.id);
    if (p.type !== 'mouse') this.tip = null;
    this.board.invalidate('overlay');
  }

  cancel(): void {
    this.cur.clear();
    this.trails = [];
    this.tip = null;
    this.board.invalidate('overlay');
  }

  onDeactivate(): void {
    this.cancel();
  }

  drawOverlay(ctx: CanvasRenderingContext2D): boolean {
    const now = performance.now();
    const px = this.board.px;
    const color = store.tool.laserColor;
    // Drop points (and trails) that have faded out.
    for (const t of this.trails) {
      let i = 0;
      while (i < t.pts.length - 3 && now - t.pts[i + 2] > FADE_MS) i += 3;
      if (i) t.pts.splice(0, i);
    }
    this.trails = this.trails.filter((t) => t.live || now - t.pts[t.pts.length - 1] < FADE_MS);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const t of this.trails) {
      const p = t.pts;
      if (p.length < 6) continue;
      // The tail shortens as old points fade, so one smooth path is enough.
      const age = now - p[p.length - 1];
      const a = t.live ? 1 : Math.max(0, 1 - age / FADE_MS);
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      for (let i = 3; i < p.length - 3; i += 3) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 3]) / 2, (p[i + 1] + p[i + 4]) / 2);
      ctx.lineTo(p[p.length - 3], p[p.length - 2]);
      ctx.globalAlpha = a * 0.3;
      ctx.strokeStyle = color;
      ctx.lineWidth = 16 * px;
      ctx.stroke();
      ctx.globalAlpha = a * 0.85;
      ctx.lineWidth = 7 * px;
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5 * px;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (this.tip) {
      const [x, y] = this.tip;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 14 * px, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x, y, 6 * px, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 2.5 * px, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return this.trails.length > 0;
  }
}
