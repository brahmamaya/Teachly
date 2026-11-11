import { GState, type jsPDF as JsPDF } from 'jspdf';
import { bbox } from '../geometry';
import { drawBackground, drawEl, drawPathEl, pageRegion, withPathMaker } from '../renderer';
import type { El, Page, Rect } from '../types';

// Small, sharp PDFs. Instead of one big photo per page, the page goes into
// the PDF the way it was made:
// - writing, shapes, fills and the ruled / grid background as vector lines
//   (perfectly sharp at any zoom and print size, and tiny);
// - pictures and imported PDF pages as their own stored picture (not
//   photographed again, so no quality is lost and nothing grows);
// - only text boxes, tables, tape and turned pictures as small sharp
//   pictures of just that item.

type Op = [0, number, number] | [1, number, number] | [2, number, number, number, number] | [3];

/** A path that remembers its pieces, so they can be written into the PDF. */
class RecPath {
  ops: Op[] = [];
  moveTo(x: number, y: number): void {
    this.ops.push([0, x, y]);
  }
  lineTo(x: number, y: number): void {
    this.ops.push([1, x, y]);
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.ops.push([2, cx, cy, x, y]);
  }
  closePath(): void {
    this.ops.push([3]);
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  }
}

// Any CSS colour → r, g, b and alpha (the browser does the parsing).
const probe = document.createElement('canvas').getContext('2d')!;
const colorCache = new Map<string, [number, number, number, number]>();
function rgba(c: string): [number, number, number, number] {
  let v = colorCache.get(c);
  if (v) return v;
  probe.fillStyle = '#000000';
  probe.fillStyle = c;
  const s = String(probe.fillStyle);
  const m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    v = [n >> 16, (n >> 8) & 255, n & 255, 1];
  } else {
    const p = (/rgba?\(([^)]+)\)/.exec(s)?.[1] ?? '0,0,0,1').split(',').map(Number);
    v = [p[0], p[1], p[2], p[3] ?? 1];
  }
  colorCache.set(c, v);
  return v;
}

/**
 * Just enough of a canvas drawing context for the board's own drawing code
 * (strokes, shapes, arrows, backgrounds), writing vector paths into the PDF.
 */
class PdfCtx {
  globalAlpha = 1;
  fillStyle = '#000';
  strokeStyle = '#000';
  lineWidth = 1;
  lineCap = 'round';
  lineJoin = 'round';
  private path = new RecPath();
  private dash: number[] = [];

  constructor(
    private pdf: JsPDF,
    private dx: number,
    private dy: number,
  ) {}

  setLineDash(d: number[]): void {
    this.dash = d;
  }
  beginPath(): void {
    this.path = new RecPath();
  }
  moveTo(x: number, y: number): void {
    this.path.moveTo(x, y);
  }
  lineTo(x: number, y: number): void {
    this.path.lineTo(x, y);
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.path.quadraticCurveTo(cx, cy, x, y);
  }
  closePath(): void {
    this.path.closePath();
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.path.rect(x, y, w, h);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    const p = new RecPath();
    p.rect(x, y, w, h);
    this.fill(p as unknown as Path2D);
  }
  save(): void {}
  restore(): void {}
  clip(): void {}

  fill(p?: Path2D | CanvasFillRule, rule?: CanvasFillRule): void {
    const path = p instanceof RecPath ? p : this.path;
    const r = typeof p === 'string' ? p : rule;
    if (!this.trace(path, this.fillStyle, false)) return;
    if (r === 'evenodd') this.pdf.fillEvenOdd();
    else this.pdf.fill();
  }
  stroke(p?: Path2D): void {
    const path = p instanceof RecPath ? p : this.path;
    if (!this.trace(path, this.strokeStyle, true)) return;
    this.pdf.stroke();
  }

  /** Colour, transparency and line style, then the path itself. */
  private trace(path: RecPath, color: string, line: boolean): boolean {
    if (!path.ops.length) return false;
    const [r, g, b, a0] = rgba(color);
    const a = Math.round(a0 * this.globalAlpha * 100) / 100;
    if (a <= 0) return false;
    const pdf = this.pdf;
    if (line) {
      pdf.setDrawColor(r, g, b);
      pdf.setLineWidth(this.lineWidth);
      pdf.setLineCap(this.lineCap as 'round');
      pdf.setLineJoin(this.lineJoin as 'round');
      pdf.setLineDashPattern(this.dash, 0);
    } else pdf.setFillColor(r, g, b);
    setAlpha(pdf, a);
    let x0 = 0, y0 = 0, sx = 0, sy = 0;
    const X = (x: number) => x - this.dx, Y = (y: number) => y - this.dy;
    for (const o of path.ops) {
      if (o[0] === 0) {
        pdf.moveTo(X(o[1]), Y(o[2]));
        [x0, y0, sx, sy] = [o[1], o[2], o[1], o[2]];
      } else if (o[0] === 1) {
        pdf.lineTo(X(o[1]), Y(o[2]));
        [x0, y0] = [o[1], o[2]];
      } else if (o[0] === 2) {
        // A quadratic curve is the cubic with control points 2/3 of the way to its handle.
        const [, cx, cy, x, y] = o;
        pdf.curveTo(X(x0 + ((cx - x0) * 2) / 3), Y(y0 + ((cy - y0) * 2) / 3), X(x + ((cx - x) * 2) / 3), Y(y + ((cy - y) * 2) / 3), X(x), Y(y));
        [x0, y0] = [x, y];
      } else {
        pdf.close();
        [x0, y0] = [sx, sy];
      }
    }
    return true;
  }
}

/** Transparency for what is drawn next (one shared setting per value). */
const docStates = new WeakMap<JsPDF, Map<number, GState>>();
function setAlpha(pdf: JsPDF, a: number): void {
  let states = docStates.get(pdf);
  if (!states) docStates.set(pdf, (states = new Map()));
  let st = states.get(a);
  if (!st) states.set(a, (st = new GState({ opacity: a, 'stroke-opacity': a })));
  pdf.setGState(st);
}

/** The stored picture of an image element, if it can go into the PDF as it is. */
function ownPicture(el: El): { src: string; fmt: 'JPEG' | 'PNG' } | null {
  if (el.type !== 'image' || el.rot) return null;
  if (el.src.startsWith('data:image/jpeg')) return { src: el.src, fmt: 'JPEG' };
  if (el.src.startsWith('data:image/png')) return { src: el.src, fmt: 'PNG' };
  return null;
}

/** One item drawn alone, sharp (3x), with a see-through background. */
function itemPicture(el: El, k: number): { url: string; r: Rect } | null {
  const b = bbox(el);
  const pad = 4;
  const r = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  const s = Math.min(k, Math.sqrt(8_000_000 / Math.max(1, r.w * r.h)));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.w * s));
  c.height = Math.max(1, Math.round(r.h * s));
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(s, 0, 0, s, -r.x * s, -r.y * s);
  drawEl(ctx, el);
  const url = c.toDataURL('image/png');
  c.width = c.height = 1;
  return { url, r };
}

/** Write one board page into the PDF (the PDF page is already added and sized to `r`). */
export function drawPageVector(pdf: JsPDF, page: Page, k: number): void {
  const r = pageRegion(page.els);
  // Background colour and its lines / grid / dots, lined up as on the board
  // (drawn in coordinates that already start at the region's corner).
  drawBackground(new PdfCtx(pdf, 0, 0) as unknown as CanvasRenderingContext2D, page.bg, page.pattern, { x: r.x, y: r.y, z: 1 }, r.w, r.h);
  const e2d = new PdfCtx(pdf, r.x, r.y) as unknown as CanvasRenderingContext2D;
  const pics = new Map<string, string>();
  for (const el of page.els) {
    if (el.type === 'path') {
      withPathMaker(
        () => new RecPath() as unknown as Path2D,
        () => drawPathEl(e2d, el),
      );
      continue;
    }
    const own = ownPicture(el);
    if (own) {
      // The same picture used twice is stored once.
      let alias = pics.get(own.src);
      if (!alias) pics.set(own.src, (alias = `img${pics.size}_${el.id}`));
      setAlpha(pdf, 1);
      pdf.addImage(own.src, own.fmt, el.x - r.x, el.y - r.y, el.w, el.h, alias, 'NONE');
      continue;
    }
    const pic = itemPicture(el, k);
    if (pic) {
      setAlpha(pdf, 1);
      pdf.addImage(pic.url, 'PNG', pic.r.x - r.x, pic.r.y - r.y, pic.r.w, pic.r.h, undefined, 'FAST');
    }
  }
}
