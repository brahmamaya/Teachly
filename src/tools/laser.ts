import type { Board, Ptr, Tool } from '../board';
import { store } from '../store';

// Laser pen (red by default): draw to point things out. The drawing stays
// while you keep pointing, then disappears by itself 3 seconds after the
// last stroke. Nothing is written on the page.

// After lifting: a short pause, then a smooth fade — gone in 1.5 s.
const HOLD_MS = 300;
const FADE_MS = 1200;

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
        // Ease-out fade: dims gently, no sudden drop.
        const k = (since - HOLD_MS) / FADE_MS;
        alpha = 1 - k * k * (3 - 2 * k);
        fading = true;
      }
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const t of this.trails) {
      const p = smooth(t.pts);
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      if (p.length === 2) ctx.lineTo(p[0] + 0.01, p[1]);
      // Smooth curve through the midpoints.
      for (let i = 2; i < p.length - 2; i += 2) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
      if (p.length > 2) ctx.lineTo(p[p.length - 2], p[p.length - 1]);
      // Thin and clean: a soft halo, a slim coloured line, a bright core.
      ctx.globalAlpha = alpha * 0.25;
      ctx.strokeStyle = color;
      ctx.lineWidth = 9 * px;
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3.4 * px;
      ctx.stroke();
      ctx.strokeStyle = '#fff5f5';
      ctx.lineWidth = 1.2 * px;
      ctx.stroke();
    }
    if (this.tip) {
      const [x, y] = this.tip;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 9 * px, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x, y, 4 * px, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 1.6 * px, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Animate only during the short fade-out.
    return fading;
  }
}

/** Gentle smoothing of the trail (two light passes), ends kept in place. */
function smooth(p: number[]): number[] {
  if (p.length < 8) return p;
  let a = p;
  for (let pass = 0; pass < 2; pass++) {
    const b = a.slice();
    for (let i = 2; i < a.length - 2; i += 2) {
      b[i] = (a[i - 2] + a[i] * 2 + a[i + 2]) / 4;
      b[i + 1] = (a[i - 1] + a[i + 1] * 2 + a[i + 3]) / 4;
    }
    a = b;
  }
  return a;
}
