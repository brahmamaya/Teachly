import { getStroke } from 'perfect-freehand';
import { bbox, rectsIntersect } from './geometry';
import type { BgPattern, BoxEl, Camera, El, PathEl, Rect, TableEl, TapeEl, TextEl } from './types';

// ---------------------------------------------------------------------------
// Stroke geometry

export function freehandOptions(el: Pick<PathEl, 'style' | 'size' | 'sim'>, last: boolean) {
  switch (el.style) {
    case 'highlighter':
      return { size: el.size, thinning: 0, smoothing: 0.7, streamline: 0.6, simulatePressure: false, last, start: { cap: true }, end: { cap: true } };
    case 'brush':
      // Soft brush: thick when slow, thin when fast, tapered ends.
      return {
        size: el.size * 2.6,
        thinning: 0.55,
        smoothing: 0.75,
        streamline: 0.55,
        simulatePressure: !!el.sim,
        last,
        start: { taper: el.size * 6, cap: true },
        end: { taper: el.size * 8, cap: true },
      };
    default:
      // Stylus: follows pressure closely. Finger / mouse / board touch: steadier,
      // nearly even width and more streamlining to hide touchscreen jitter.
      return el.sim
        ? { size: el.size, thinning: 0.18, smoothing: 0.68, streamline: 0.58, simulatePressure: true, last, start: { cap: true }, end: { cap: true } }
        : { size: el.size, thinning: 0.5, smoothing: 0.62, streamline: 0.4, simulatePressure: false, last, start: { cap: true }, end: { cap: true } };
  }
}

export function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D();
  const n = outline.length;
  if (n < 2) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < n; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % n];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}

/**
 * Calligraphy: a flat nib held at 45°. Every segment becomes a parallelogram
 * swept by the nib, so strokes are broad in one direction and hairline-thin
 * in the other — like a real italic pen.
 */
function calligraphyPath(pts: number[], size: number): Path2D {
  const path = new Path2D();
  const a = -Math.PI / 4;
  const nx = Math.cos(a) * size * 0.9, ny = Math.sin(a) * size * 0.9;
  // Light smoothing so hand jitter does not show in the broad strokes.
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < pts.length; i += 3) {
    const j = Math.max(0, i - 3), k = Math.min(pts.length - 3, i + 3);
    xs.push((pts[j] + pts[i] * 2 + pts[k]) / 4);
    ys.push((pts[j + 1] + pts[i + 1] * 2 + pts[k + 1]) / 4);
  }
  if (xs.length === 1) {
    xs.push(xs[0] + 0.1);
    ys.push(ys[0] + 0.1);
  }
  for (let i = 1; i < xs.length; i++) {
    const x0 = xs[i - 1], y0 = ys[i - 1], x1 = xs[i], y1 = ys[i];
    const q = [x0 - nx, y0 - ny, x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny];
    // Same winding for every quad so overlaps never cancel out (nonzero fill).
    const area = (q[2] - q[0]) * (q[5] - q[1]) - (q[4] - q[0]) * (q[3] - q[1]);
    const order = area >= 0 ? [0, 2, 4, 6] : [6, 4, 2, 0];
    path.moveTo(q[order[0]], q[order[0] + 1]);
    for (const o of order.slice(1)) path.lineTo(q[o], q[o + 1]);
    path.closePath();
  }
  return path;
}

export function freehandPath(pts: number[], el: Pick<PathEl, 'style' | 'size' | 'sim'>, last: boolean): Path2D {
  if (el.style === 'calligraphy') return calligraphyPath(pts, el.size);
  const input: number[][] = [];
  for (let i = 0; i < pts.length; i += 3) input.push([pts[i], pts[i + 1], pts[i + 2]]);
  return outlineToPath(getStroke(input, freehandOptions(el, last)));
}

const pathCache = new WeakMap<PathEl, Path2D>();

function shapePath(el: PathEl): Path2D {
  const p = new Path2D();
  const pts = el.pts;
  p.moveTo(pts[0], pts[1]);
  for (let i = 3; i < pts.length; i += 3) p.lineTo(pts[i], pts[i + 1]);
  if (el.closed) p.closePath();
  return p;
}

function getPath(el: PathEl): Path2D {
  let p = pathCache.get(el);
  if (!p) {
    p = el.style === 'shape' ? shapePath(el) : freehandPath(el.pts, el, true);
    pathCache.set(el, p);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Images

const images = new Map<string, HTMLImageElement>();
let onAssetLoad: () => void = () => {};

export function setAssetLoadCallback(fn: () => void): void {
  onAssetLoad = fn;
}

export function getImage(src: string): HTMLImageElement {
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.onload = () => onAssetLoad();
    img.src = src;
    images.set(src, img);
  }
  return img;
}


// ---------------------------------------------------------------------------
// Element drawing (ctx is already in world coordinates)

function drawArrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number): void {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.max(10, size * 4);
  ctx.beginPath();
  ctx.moveTo(x2 + Math.cos(a) * size * 0.5, y2 + Math.sin(a) * size * 0.5);
  ctx.lineTo(x2 - Math.cos(a - 0.45) * len, y2 - Math.sin(a - 0.45) * len);
  ctx.lineTo(x2 - Math.cos(a + 0.45) * len, y2 - Math.sin(a + 0.45) * len);
  ctx.closePath();
  ctx.fill();
}

export function drawPathEl(ctx: CanvasRenderingContext2D, el: PathEl): void {
  ctx.globalAlpha = el.style === 'highlighter' ? 0.38 * el.opacity : el.opacity;
  if (el.style === 'shape') {
    const p = getPath(el);
    if (el.fill && el.closed) {
      ctx.fillStyle = el.fill;
      ctx.fill(p);
    }
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.size;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (el.dash) ctx.setLineDash([el.size * 3, el.size * 2.5]);
    ctx.stroke(p);
    if (el.dash) ctx.setLineDash([]);
    if (el.arrow) {
      ctx.fillStyle = el.color;
      const n = el.pts.length;
      drawArrowHead(ctx, el.pts[n - 6], el.pts[n - 5], el.pts[n - 3], el.pts[n - 2], el.size);
      if (el.arrow === 2) drawArrowHead(ctx, el.pts[3], el.pts[4], el.pts[0], el.pts[1], el.size);
    }
  } else {
    // A filled freehand drawing: colour the area it encloses, under the ink.
    if (el.fill) {
      ctx.fillStyle = el.fill;
      ctx.fill(fillPath(el));
    }
    ctx.fillStyle = el.color;
    ctx.fill(getPath(el));
  }
  ctx.globalAlpha = 1;
}

const fillCache = new WeakMap<PathEl, Path2D>();

/** The area inside a hand-drawn stroke (its line, closed back to the start). */
function fillPath(el: PathEl): Path2D {
  let p = fillCache.get(el);
  if (!p) {
    p = new Path2D();
    const pts = el.pts;
    p.moveTo(pts[0], pts[1]);
    for (let i = 3; i < pts.length; i += 3) p.lineTo(pts[i], pts[i + 1]);
    p.closePath();
    fillCache.set(el, p);
  }
  return p;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (!para) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (line && ctx.measureText(test).width > maxW) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

export function textFont(el: Pick<TextEl, 'fontSize' | 'bold'>): string {
  return `${el.bold ? '700' : '500'} ${el.fontSize}px "Inter", "Noto Sans", "Noto Sans Devanagari", system-ui, sans-serif`;
}

function drawText(ctx: CanvasRenderingContext2D, el: TextEl): void {
  if (el.bg) {
    ctx.fillStyle = el.bg;
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    roundRect(ctx, 0, 0, el.w, el.h, 6);
    ctx.fill();
    ctx.shadowColor = 'transparent';
  }
  ctx.font = textFont(el);
  ctx.fillStyle = el.color;
  ctx.textBaseline = 'top';
  const pad = el.bg ? el.fontSize * 0.5 : 0;
  const lines = wrapText(ctx, el.text, el.w - pad * 2 + 1);
  const lh = el.fontSize * 1.3;
  lines.forEach((l, i) => ctx.fillText(l, pad, pad + i * lh));
}

/** Measure a text element's natural size (auto width up to maxW). */
export function measureText(text: string, fontSize: number, bold: boolean, maxW: number, padded: boolean): { w: number; h: number } {
  const c = document.createElement('canvas').getContext('2d')!;
  c.font = textFont({ fontSize, bold });
  const pad = padded ? fontSize * 0.5 : 0;
  let w = 0;
  for (const l of text.split('\n')) w = Math.max(w, c.measureText(l).width);
  w = Math.min(maxW, Math.max(fontSize, w)) + pad * 2 + 2;
  const lines = wrapText(c, text, w - pad * 2 + 1);
  return { w, h: lines.length * fontSize * 1.3 + pad * 2 };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawTable(ctx: CanvasRenderingContext2D, el: TableEl): void {
  const { rows, cols, w, h } = el;
  const cw = w / cols, rh = h / rows;
  if (el.fill) {
    ctx.fillStyle = el.fill;
    ctx.fillRect(0, 0, w, h);
  }
  if (el.header) {
    ctx.fillStyle = el.headerFill;
    ctx.fillRect(0, 0, w, rh);
  }
  ctx.strokeStyle = el.color;
  ctx.lineWidth = Math.max(1.5, el.fontSize / 14);
  ctx.beginPath();
  for (let r = 0; r <= rows; r++) {
    ctx.moveTo(0, r * rh);
    ctx.lineTo(w, r * rh);
  }
  for (let c = 0; c <= cols; c++) {
    ctx.moveTo(c * cw, 0);
    ctx.lineTo(c * cw, h);
  }
  ctx.stroke();
  ctx.fillStyle = el.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const pad = el.fontSize * 0.3;
  for (let r = 0; r < rows; r++) {
    ctx.font = textFont({ fontSize: el.fontSize, bold: el.header && r === 0 });
    for (let c = 0; c < cols; c++) {
      const text = el.cells[r]?.[c] ?? '';
      if (!text) continue;
      const lines = wrapText(ctx, text, cw - pad * 2);
      const lh = el.fontSize * 1.25;
      const maxLines = Math.max(1, Math.floor((rh - pad) / lh));
      const shown = lines.slice(0, maxLines);
      const y0 = r * rh + rh / 2 - ((shown.length - 1) * lh) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(c * cw, r * rh, cw, rh);
      ctx.clip();
      shown.forEach((l, k) => ctx.fillText(l, c * cw + cw / 2, y0 + k * lh));
      ctx.restore();
    }
  }
  ctx.textAlign = 'left';
}

function drawTape(ctx: CanvasRenderingContext2D, el: TapeEl): void {
  const r = Math.min(10, el.h / 4);
  ctx.beginPath();
  // (Hand-built rounded rectangle: works on older iPads too.)
  ctx.moveTo(r, 0);
  ctx.arcTo(el.w, 0, el.w, el.h, r);
  ctx.arcTo(el.w, el.h, 0, el.h, r);
  ctx.arcTo(0, el.h, 0, 0, r);
  ctx.arcTo(0, 0, el.w, 0, r);
  ctx.closePath();
  if (el.open) {
    ctx.strokeStyle = el.color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.fillStyle = el.color;
  ctx.fill();
  // Soft diagonal stripes so it reads as tape.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let x = -el.h; x < el.w + el.h; x += 22) {
    ctx.moveTo(x, el.h);
    ctx.lineTo(x + el.h, 0);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBox(ctx: CanvasRenderingContext2D, el: BoxEl): void {
  ctx.save();
  ctx.translate(el.x + el.w / 2, el.y + el.h / 2);
  if (el.rot) ctx.rotate(el.rot);
  ctx.translate(-el.w / 2, -el.h / 2);
  switch (el.type) {
    case 'text':
      drawText(ctx, el);
      break;
    case 'table':
      drawTable(ctx, el);
      break;
    case 'tape':
      drawTape(ctx, el);
      break;
    case 'image': {
      const img = getImage(el.src);
      if (img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, el.w, el.h);
      else {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 0, el.w, el.h);
      }
      break;
    }
  }
  ctx.restore();
}

export function drawEl(ctx: CanvasRenderingContext2D, el: El): void {
  if (el.type === 'path') drawPathEl(ctx, el);
  else drawBox(ctx, el);
}

/** Draw a list of elements, culled against the visible world rect. */
export function drawEls(ctx: CanvasRenderingContext2D, els: El[], view: Rect | null, skip?: Set<string>): void {
  for (const el of els) {
    if (skip?.has(el.id)) continue;
    if (view && !rectsIntersect(bbox(el), view)) continue;
    drawEl(ctx, el);
  }
}

// ---------------------------------------------------------------------------
// Backgrounds (drawn in screen space, aligned to world)

export function isDarkColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

/**
 * Board background. With `page`, the area around the page is shaded and the
 * page itself is drawn as a clear rectangle with an edge, so it is obvious
 * where the board ends.
 */
export function drawBackground(ctx: CanvasRenderingContext2D, bg: string, pattern: BgPattern, cam: Camera, w: number, h: number, page?: Rect): void {
  if (!page) return drawSurface(ctx, bg, pattern, cam, w, h);
  const dark = isDarkColor(bg);
  ctx.fillStyle = dark ? '#161616' : '#c9ccd1';
  ctx.fillRect(0, 0, w, h);
  const px = (page.x - cam.x) * cam.z, py = (page.y - cam.y) * cam.z;
  const pw = page.w * cam.z, ph = page.h * cam.z;
  // Soft lift so the page reads as a sheet on the desk.
  ctx.save();
  ctx.shadowColor = dark ? 'rgba(0,0,0,0.85)' : 'rgba(15,23,42,0.28)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = bg;
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  drawSurface(ctx, bg, pattern, cam, w, h);
  ctx.restore();
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, Math.round(pw) - 1, Math.round(ph) - 1);
}

function drawSurface(ctx: CanvasRenderingContext2D, bg: string, pattern: BgPattern, cam: Camera, w: number, h: number): void {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (pattern === 'none') return;
  const dark = isDarkColor(bg);
  const minor = dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)';
  const accent = dark ? 'rgba(248,113,113,0.55)' : 'rgba(220,38,38,0.45)';
  const blue = dark ? 'rgba(147,197,253,0.45)' : 'rgba(37,99,235,0.35)';
  const z = cam.z;
  const toSx = (x: number) => (x - cam.x) * z;
  const toSy = (y: number) => (y - cam.y) * z;
  const wx0 = cam.x, wy0 = cam.y, wx1 = cam.x + w / z, wy1 = cam.y + h / z;

  const hLines = (step: number, color: string, width = 1) => {
    if (step * z < 5) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let y = Math.floor(wy0 / step) * step; y <= wy1; y += step) {
      const sy = Math.round(toSy(y)) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();
  };
  const vLines = (step: number, color: string, width = 1) => {
    if (step * z < 5) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let x = Math.floor(wx0 / step) * step; x <= wx1; x += step) {
      const sx = Math.round(toSx(x)) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    ctx.stroke();
  };

  switch (pattern) {
    case 'grid':
      hLines(40, minor);
      vLines(40, minor);
      break;
    case 'lines':
      hLines(44, blue);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(toSx(-60), 0);
      ctx.lineTo(toSx(-60), h);
      ctx.stroke();
      break;
    case 'fourline': {
      // English handwriting practice: 4 lines per row (red base line).
      const gap = 18, row = gap * 3 + 40;
      if (gap * z < 3) return;
      for (let y = Math.floor(wy0 / row) * row; y <= wy1; y += row) {
        for (let k = 0; k < 4; k++) {
          ctx.strokeStyle = k === 2 ? accent : blue;
          ctx.lineWidth = k === 2 ? 1.6 : 1;
          ctx.setLineDash(k === 1 ? [6, 5] : []);
          const sy = Math.round(toSy(y + k * gap)) + 0.5;
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(w, sy);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      break;
    }
    case 'dots': {
      const step = 40;
      if (step * z < 8) return;
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.32)' : 'rgba(15,23,42,0.28)';
      const r = Math.max(1, Math.min(2.2, 1.6 * z));
      for (let y = Math.floor(wy0 / step) * step; y <= wy1; y += step) {
        const sy = toSy(y);
        for (let x = Math.floor(wx0 / step) * step; x <= wx1; x += step) ctx.fillRect(toSx(x) - r / 2, sy - r / 2, r, r);
      }
      break;
    }
    case 'graph':
      // Maths graph paper: fine squares with a stronger line every 5.
      hLines(20, dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)');
      vLines(20, dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)');
      hLines(100, dark ? 'rgba(147,197,253,0.30)' : 'rgba(37,99,235,0.25)');
      vLines(100, dark ? 'rgba(147,197,253,0.30)' : 'rgba(37,99,235,0.25)');
      break;
    case 'music': {
      // Music staves: 5 lines, then a gap.
      const gap = 14, row = gap * 4 + 70;
      if (gap * z < 3) return;
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.32)' : 'rgba(15,23,42,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = Math.floor(wy0 / row) * row + 50; y <= wy1; y += row) {
        for (let k = 0; k < 5; k++) {
          const sy = Math.round(toSy(y + k * gap)) + 0.5;
          ctx.moveTo(0, sy);
          ctx.lineTo(w, sy);
        }
      }
      ctx.stroke();
      break;
    }
    case 'cornell': {
      // Cornell notes: cue column on the left, summary box at the bottom.
      hLines(44, minor);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toSx(420), toSy(0));
      ctx.lineTo(toSx(420), toSy(700));
      ctx.moveTo(toSx(0), toSy(700));
      ctx.lineTo(toSx(1600), toSy(700));
      ctx.stroke();
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Off-screen rendering of a whole page (thumbnails, export)

export function contentBounds(els: El[]): Rect | null {
  if (!els.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const e of els) {
    const b = bbox(e);
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w);
    y2 = Math.max(y2, b.y + b.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function renderRegion(
  page: { bg: string; pattern: BgPattern; els: El[] },
  region: Rect,
  outW: number,
  outH: number,
  canvas: HTMLCanvasElement = document.createElement('canvas'),
): HTMLCanvasElement {
  canvas.width = Math.max(1, Math.round(outW));
  canvas.height = Math.max(1, Math.round(outH));
  const ctx = canvas.getContext('2d')!;
  const z = Math.min(outW / region.w, outH / region.h);
  const cam = { x: region.x - (outW / z - region.w) / 2, y: region.y - (outH / z - region.h) / 2, z };
  drawBackground(ctx, page.bg, page.pattern, cam, canvas.width, canvas.height);
  ctx.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z);
  drawEls(ctx, page.els, null);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}
