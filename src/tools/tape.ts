import type { Board, Ptr, Tool } from '../board';
import { hitTest, uid } from '../geometry';
import { store } from '../store';
import type { El, TapeEl } from '../types';

// Tape (cover and reveal): drag across an answer to hide it under a strip
// of tape; tap the tape in class to show the answer, tap again to hide it.

const THICK = 46;

/** The top-most tape under a point. */
export function tapeAt(els: El[], x: number, y: number, tol: number): TapeEl | null {
  for (let i = els.length - 1; i >= 0; i--) {
    const e = els[i];
    if (e.type === 'tape' && hitTest(e, x, y, tol)) return e;
  }
  return null;
}

export function toggleTape(t: TapeEl): void {
  store.mapEls(new Set([t.id]), (e) => ({ ...e, open: !(e as TapeEl).open }) as TapeEl);
}

export class TapeTool implements Tool {
  cursor = 'crosshair';
  private start: { id: number; x: number; y: number; x2: number; y2: number; hit: TapeEl | null } | null = null;

  constructor(private board: Board) {}

  down(p: Ptr): void {
    if (this.start) return;
    this.start = { id: p.id, x: p.x, y: p.y, x2: p.x, y2: p.y, hit: tapeAt(store.page.els, p.x, p.y, 4 * this.board.px) };
  }

  move(p: Ptr): void {
    const s = this.start;
    if (!s || s.id !== p.id) return;
    s.x2 = p.x;
    s.y2 = p.y;
    this.board.invalidate('overlay');
  }

  private tape(): TapeEl | null {
    const s = this.start!;
    const dx = s.x2 - s.x, dy = s.y2 - s.y;
    const len = Math.hypot(dx, dy);
    if (len < 12 * this.board.px) return null;
    // Nearly level drags make a perfectly straight strip.
    let a = Math.atan2(dy, dx);
    if (Math.abs(Math.sin(a)) < 0.12) a = Math.cos(a) > 0 ? 0 : Math.PI;
    if (Math.abs(Math.cos(a)) < 0.12) a = Math.sign(Math.sin(a)) * Math.PI / 2;
    if (Math.cos(a) < -0.01) a += Math.PI;
    const w = len + THICK * 0.4;
    const cx = (s.x + s.x2) / 2, cy = (s.y + s.y2) / 2;
    return { id: uid(), type: 'tape', x: cx - w / 2, y: cy - THICK / 2, w, h: THICK, rot: a, color: store.tool.tapeColor };
  }

  up(p: Ptr): void {
    const s = this.start;
    if (!s || s.id !== p.id) return;
    const t = this.tape();
    this.start = null;
    if (t) store.addEls([t]);
    else if (s.hit) toggleTape(s.hit);
    this.board.invalidate('overlay');
  }

  cancel(): void {
    this.start = null;
    this.board.invalidate('overlay');
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (!this.start) return;
    const t = this.tape();
    if (!t) return;
    ctx.save();
    ctx.translate(t.x + t.w / 2, t.y + t.h / 2);
    ctx.rotate(t.rot);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = t.color;
    ctx.fillRect(-t.w / 2, -t.h / 2, t.w, t.h);
    ctx.restore();
  }
}
