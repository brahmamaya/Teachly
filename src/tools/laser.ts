import type { Board, Ptr, Tool } from '../board';
import { store } from '../store';

// Laser pen (red by default): draw to point things out. The drawing stays
// while you keep pointing, then disappears by itself 3 seconds after the
// last stroke. Nothing is written on the page.

const HOLD_MS = 3000;
const FADE_MS = 450;

interface Trail {
  pts: number[];
}

export class LaserTool implements Tool {
  cursor = 'none';
  private trails: Trail[] = [];
  private cur = new Map<number, Trail>();
  private tip: [number, number] | null = null;
  /** When the last stroke ended (the 3 second countdown starts here). */
  private lastUp = 0;
  private timer = 0;

  constructor(private board: Board) {}

  down(p: Ptr): void {
    const t: Trail = { pts: [p.x, p.y] };
    this.trails.push(t);
    this.cur.set(p.id, t);
    this.tip = [p.x, p.y];
    this.board.invalidate('overlay');
  }

  move(p: Ptr): void {
    this.tip = [p.x, p.y];
    const t = this.cur.get(p.id);
    if (t) {
      const min = 0.8 * this.board.px;
      for (const [x, y] of p.samples) {
        const n = t.pts.length;
        if (Math.hypot(x - t.pts[n - 2], y - t.pts[n - 1]) >= min) t.pts.push(x, y);
      }
    }
    this.board.invalidate('overlay');
  }

  hover(p: Ptr | null): void {
    this.tip = p ? [p.x, p.y] : null;
    this.board.invalidate('overlay');
  }

  up(p: Ptr): void {
    this.cur.delete(p.id);
    this.lastUp = performance.now();
    // No redraws needed while it waits; wake up when it is time to fade.
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.board.invalidate('overlay'), HOLD_MS + 16);
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
    const px = this.board.px;
    const color = store.tool.laserColor;
    let alpha = 1;
    let fading = false;
    if (this.trails.length && !this.cur.size) {
      const since = performance.now() - this.lastUp;
      if (since > HOLD_MS + FADE_MS) this.trails = [];
      else if (since > HOLD_MS) {
        alpha = 1 - (since - HOLD_MS) / FADE_MS;
        fading = true;
      }
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const t of this.trails) {
      const p = t.pts;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      if (p.length === 2) ctx.lineTo(p[0] + 0.01, p[1]);
      // Smooth curve through the midpoints.
      for (let i = 2; i < p.length - 2; i += 2) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
      if (p.length > 2) ctx.lineTo(p[p.length - 2], p[p.length - 1]);
      // Soft glow, coloured body and a bright core, like a real laser.
      ctx.globalAlpha = alpha * 0.25;
      ctx.strokeStyle = color;
      ctx.lineWidth = 18 * px;
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 7 * px;
      ctx.stroke();
      ctx.strokeStyle = '#ffe4e4';
      ctx.lineWidth = 2.5 * px;
      ctx.stroke();
    }
    if (this.tip) {
      const [x, y] = this.tip;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 16 * px, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x, y, 6.5 * px, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 2.5 * px, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Animate only during the short fade-out.
    return fading;
  }
}
