import { GState, jsPDF, type jsPDF as JsPDF } from 'jspdf';
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

/**
 * Write board elements into the current PDF page (sized to the page region
 * `r`): the background first when `bg`, then each element in order.
 */
function drawLayer(pdf: JsPDF, page: Page, r: Rect, els: El[], bg: boolean, k: number): void {
  // Background colour and its lines / grid / dots, lined up as on the board
  // (drawn in coordinates that already start at the region's corner).
  if (bg) drawBackground(new PdfCtx(pdf, 0, 0) as unknown as CanvasRenderingContext2D, page.bg, page.pattern, { x: r.x, y: r.y, z: 1 }, r.w, r.h);
  const e2d = new PdfCtx(pdf, r.x, r.y) as unknown as CanvasRenderingContext2D;
  const pics = new Map<string, string>();
  for (const el of els) {
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

/** A page of an opened PDF whose original file is kept: reused as it is. */
type SrcPage = { key: string; page: number; el: El & { type: 'image' } };

/**
 * The whole notebook as one PDF.
 * Pages without opened-PDF pages: written directly (vector writing, stored
 * pictures). Pages with them: the board's layers are written the same way
 * and the original PDF page is put between them, so a book stays as small
 * and sharp as the original file.
 */
export async function makePdf(pages: Page[], k: number): Promise<{ blob: Blob; pictures: number }> {
  const { loadSource } = await import('./library');
  // Which original files can be used (still on this device, readable).
  const keys = new Set<string>();
  for (const p of pages) for (const e of p.els) if (e.type === 'image' && e.pdf && !e.rot) keys.add(e.pdf.src);
  const sources = new Map<string, ArrayBuffer>();
  for (const key of keys) {
    const b = await loadSource(key);
    if (b) sources.set(key, b);
  }
  // Opened-PDF pages that have no kept original (opened before this version, or on another device).
  let pictures = 0;
  for (const p of pages) for (const e of p.els) if (e.type === 'image' && e.locked && !(e.pdf && sources.has(e.pdf.src))) pictures++;
  const usable = (e: El): e is El & { type: 'image' } => e.type === 'image' && !!e.pdf && !e.rot && sources.has(e.pdf.src);

  // 1. Board layers with jsPDF. A board page with original pages becomes
  //    several layers: [background + what lies under] [what lies over] …
  const pdf = new jsPDF({ unit: 'px', format: [100, 100], hotfixes: ['px_scaling'], compress: true, floatPrecision: 2 });
  type Plan = { r: Rect; parts: ({ layer: number } | SrcPage)[] };
  const plan: Plan[] = [];
  let layers = 0;
  const newLayer = (r: Rect) => {
    if (layers) pdf.addPage([r.w, r.h], r.w >= r.h ? 'landscape' : 'portrait');
    else {
      pdf.deletePage(1);
      pdf.addPage([r.w, r.h], r.w >= r.h ? 'landscape' : 'portrait');
    }
    return layers++;
  };
  for (const page of pages) {
    const r = pageRegion(page.els);
    const parts: Plan['parts'] = [];
    let run: El[] = [];
    let first = true;
    const flush = () => {
      if (!first && !run.length) return;
      const n = newLayer(r);
      drawLayer(pdf, page, r, run, first, k);
      parts.push({ layer: n });
      first = false;
      run = [];
    };
    for (const el of page.els) {
      if (usable(el)) {
        flush();
        parts.push({ key: el.pdf!.src, page: el.pdf!.page, el });
      } else run.push(el);
    }
    flush();
    plan.push({ r, parts });
    await new Promise((ok) => setTimeout(ok, 0)); // let the screen breathe between pages
  }
  const board = pdf.output('arraybuffer');
  if (!sources.size) return { blob: new Blob([board], { type: 'application/pdf' }), pictures };

  // 2. Put the layers and the original pages together with pdf-lib.
  const { PDFDocument, rgb } = await import('pdf-lib');
  const out = await PDFDocument.create();
  const layerPages = await out.embedPdf(board, [...Array(layers).keys()]);
  const embedded = new Map<string, Awaited<ReturnType<typeof out.embedPdf>>>();
  for (const [key, bytes] of sources) {
    try {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      if (src.isEncrypted) throw new Error('locked');
      const want = new Set<number>();
      for (const p of plan) for (const part of p.parts) if ('key' in part && part.key === key && part.page < src.getPageCount() && !src.getPage(part.page).getRotation().angle) want.add(part.page);
      const list = [...want].sort((a, b) => a - b);
      const emb = await out.embedPages(list.map((i) => src.getPage(i)));
      const byPage = new Array(src.getPageCount());
      list.forEach((i, j) => (byPage[i] = emb[j]));
      embedded.set(key, byPage);
    } catch {
      /* locked or damaged file: its pages go in as the stored pictures */
    }
  }
  for (const p of plan) {
    const s = layerPages[(p.parts.find((x) => 'layer' in x) as { layer: number }).layer];
    const pt = s.width / p.r.w; // board units → PDF points
    const pg = out.addPage([s.width, s.height]);
    for (const part of p.parts) {
      if ('layer' in part) {
        pg.drawPage(layerPages[part.layer], { x: 0, y: 0, width: s.width, height: s.height });
        continue;
      }
      const e = part.el;
      const x = (e.x - p.r.x) * pt, w = e.w * pt, h = e.h * pt, y = s.height - (e.y - p.r.y) * pt - h;
      const orig = embedded.get(part.key)?.[part.page];
      if (orig) {
        // PDF pages are see-through; on the board they sit on white paper.
        pg.drawRectangle({ x, y, width: w, height: h, color: rgb(1, 1, 1) });
        pg.drawPage(orig, { x, y, width: w, height: h });
      }
      else {
        pictures++;
        // This page could not be reused: its stored picture instead.
        let data: string | ArrayBuffer = e.src;
        if (e.src.startsWith('pdfp:')) {
          const pic = await (await import('./pdfpages')).pagePicture(e.src);
          if (!pic) continue;
          data = await pic.arrayBuffer();
        }
        const img = typeof data === 'string' && data.startsWith('data:image/png') ? await out.embedPng(data) : await out.embedJpg(data);
        pg.drawImage(img, { x, y, width: w, height: h });
      }
    }
  }
  const bytes = await out.save({ useObjectStreams: true });
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), pictures };
}
