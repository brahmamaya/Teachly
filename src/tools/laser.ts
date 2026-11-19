import type { Board, Ptr, Tool } from '../board';
import { store } from '../store';

// Laser pen (red by default): draw to point things out. The drawing stays
// while you keep pointing, then fades away by itself after you lift.
// Nothing is written on the page.

// Timing and look measured from the owner's reference recording:
// after lifting, the line stays fully bright for 0.8 s, then the whole line
// fades evenly (linear) over 0.7 s, gone 1.5 s after lifting.
/** Default hold; the teacher can change it (Laser menu → Stays for). */
const holdMs = () => Math.max(0.2, store.tool.laserStay ?? 0.8) * 1000;
const FADE_MS = 700;
/** The reference red (default laser colour is drawn in exactly this red). */
const REF_RED = '#e00812';
/** Soft white-pink core in the middle of the line. */
const CORE = '#fff6f2';

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
    this.timer = window.setTimeout(() => this.board.invalidate('overlay'), holdMs() + 16);
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
    const chosen = store.tool.laserColor;
    const color = chosen.toLowerCase() === '#ef4444' ? REF_RED : chosen;
    let alpha = 1;
    let fading = false;
    const HOLD = holdMs();
    if (this.trails.length && !this.cur.size) {
      const since = performance.now() - this.lastUp;
      if (since > HOLD + FADE_MS) this.trails = [];
      else if (since > HOLD) {
        // Even (linear) fade of the whole line, as in the reference.
        alpha = 1 - (since - HOLD) / FADE_MS;
        fading = true;
      }
    }
    // Blink: a calm pulse (2 per second) while the laser is shown.
    const blink = store.tool.laserBlink && (this.trails.length > 0 || !!this.tip);
    if (blink) alpha *= 0.55 + 0.45 * (0.5 + 0.5 * Math.cos((performance.now() / 500) * Math.PI * 2));
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
      // Measured from the reference (screen points): a 2.9 pt white-pink core,
      // a 1.5 pt coloured rim on each side, and a glow ~4 pt on each side
      // (three light layers, cheaper than a blur).
      ctx.strokeStyle = color;
      for (const [w, a] of [
        [15.5, 0.12],
        [11, 0.2],
        [8.5, 0.32],
      ] as const) {
        ctx.globalAlpha = alpha * a;
        ctx.lineWidth = w * px;
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 6 * px;
      ctx.stroke();
      ctx.strokeStyle = CORE;
      ctx.lineWidth = 2.9 * px;
      ctx.stroke();
    }
    if (this.tip) {
      const [x, y] = this.tip;
      // The tip: same glow, red dot and white-pink core as the line.
      ctx.fillStyle = color;
      for (const [r, a] of [
        [7, 0.12],
        [5.5, 0.2],
        [4.25, 0.32],
        [3, 1],
      ] as const) {
        ctx.globalAlpha = a * (blink ? alpha : 1);
        ctx.beginPath();
        ctx.arc(x, y, r * px, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = CORE;
      ctx.beginPath();
      ctx.arc(x, y, 1.45 * px, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Animate only during the short fade-out (or while blinking).
    return fading || blink;
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
