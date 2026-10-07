import { getStroke } from 'perfect-freehand';
import { bbox, rectsIntersect } from './geometry';
import { compile } from './mathexpr';
import type { BgPattern, BoxEl, Camera, ChemEl, El, GraphEl, PathEl, Rect, TextEl } from './types';
import { CATEGORY_COLORS, ELEMENTS } from './widgets/elements-data';

// ---------------------------------------------------------------------------
// Stroke geometry

export function freehandOptions(el: Pick<PathEl, 'style' | 'size' | 'sim'>, last: boolean) {
  switch (el.style) {
    case 'highlighter':
      return { size: el.size, thinning: 0, smoothing: 0.6, streamline: 0.55, simulatePressure: false, last, start: { cap: true }, end: { cap: true } };
    case 'brush':
      return { size: el.size * 1.8, thinning: 0.85, smoothing: 0.6, streamline: 0.45, simulatePressure: !!el.sim, last, start: { taper: el.size * 2, cap: true }, end: { taper: el.size * 3, cap: true } };
    default:
      return { size: el.size, thinning: el.sim ? 0.45 : 0.6, smoothing: 0.55, streamline: 0.42, simulatePressure: !!el.sim, last, start: { cap: true }, end: { cap: true } };
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

export function freehandPath(pts: number[], el: Pick<PathEl, 'style' | 'size' | 'sim'>, last: boolean): Path2D {
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
// Images & videos

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

const videos = new Map<string, HTMLVideoElement>();

export function getVideo(id: string, src: string): HTMLVideoElement {
  let v = videos.get(id);
  if (!v) {
    v = document.createElement('video');
    v.src = src;
    v.playsInline = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    v.addEventListener('loadeddata', () => onAssetLoad());
    v.addEventListener('pause', () => onAssetLoad());
    videos.set(id, v);
  }
  return v;
}

export function anyVideoPlaying(): boolean {
  for (const v of videos.values()) if (!v.paused && !v.ended) return true;
  return false;
}

export function pauseAllVideos(): void {
  for (const v of videos.values()) v.pause();
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
    ctx.fillStyle = el.color;
    ctx.fill(getPath(el));
  }
  ctx.globalAlpha = 1;
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

function niceStep(range: number): number {
  const raw = range / 10;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
}

const GRAPH_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

const compiledCache = new Map<string, ((v: Record<string, number>) => number) | null>();
function compiled(expr: string) {
  if (!compiledCache.has(expr)) {
    try {
      compiledCache.set(expr, compile(expr));
    } catch {
      compiledCache.set(expr, null);
    }
  }
  return compiledCache.get(expr)!;
}

function drawGraph(ctx: CanvasRenderingContext2D, el: GraphEl): void {
  const { w, h, xmin, xmax, ymin, ymax } = el;
  const sx = (x: number) => ((x - xmin) / (xmax - xmin)) * w;
  const sy = (y: number) => h - ((y - ymin) / (ymax - ymin)) * h;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  const fs = Math.max(10, Math.min(w, h) / 32);
  ctx.font = `${fs}px system-ui, sans-serif`;
  const stepX = niceStep(xmax - xmin), stepY = niceStep(ymax - ymin);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#e2e8f0';
  ctx.fillStyle = '#64748b';
  for (let x = Math.ceil(xmin / stepX) * stepX; x <= xmax; x += stepX) {
    ctx.beginPath();
    ctx.moveTo(sx(x), 0);
    ctx.lineTo(sx(x), h);
    ctx.stroke();
    if (Math.abs(x) > stepX / 2) ctx.fillText(String(+x.toFixed(6)), sx(x) + 3, Math.min(h - fs - 2, Math.max(2, sy(0) + 3)));
  }
  for (let y = Math.ceil(ymin / stepY) * stepY; y <= ymax; y += stepY) {
    ctx.beginPath();
    ctx.moveTo(0, sy(y));
    ctx.lineTo(w, sy(y));
    ctx.stroke();
    if (Math.abs(y) > stepY / 2) ctx.fillText(String(+y.toFixed(6)), Math.min(w - fs * 3, Math.max(2, sx(0) + 4)), sy(y) + 2);
  }
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx(0), 0);
  ctx.lineTo(sx(0), h);
  ctx.moveTo(0, sy(0));
  ctx.lineTo(w, sy(0));
  ctx.stroke();
  el.exprs.forEach((expr, i) => {
    const f = compiled(expr);
    if (!f) return;
    ctx.strokeStyle = GRAPH_COLORS[i % GRAPH_COLORS.length];
    ctx.lineWidth = Math.max(2.5, Math.min(w, h) / 160);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false;
    let prevY = 0;
    const steps = Math.max(200, Math.round(w * 1.5));
    for (let k = 0; k <= steps; k++) {
      const x = xmin + ((xmax - xmin) * k) / steps;
      let y: number;
      try {
        y = f({ x });
      } catch {
        y = NaN;
      }
      const py = sy(y);
      if (!Number.isFinite(y) || (pen && Math.abs(py - prevY) > h * 2)) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(sx(x), py);
      else ctx.moveTo(sx(x), py);
      pen = true;
      prevY = py;
    }
    ctx.stroke();
  });
  ctx.restore();
  // Legend
  ctx.font = `600 ${fs * 1.15}px system-ui, sans-serif`;
  el.exprs.forEach((expr, i) => {
    ctx.fillStyle = GRAPH_COLORS[i % GRAPH_COLORS.length];
    ctx.fillText(`y = ${expr}`, 8, 8 + i * fs * 1.5 + fs);
  });
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, 0, w, h);
}

function drawChem(ctx: CanvasRenderingContext2D, el: ChemEl): void {
  const e = ELEMENTS[el.z - 1];
  if (!e) return;
  const { w, h } = el;
  ctx.fillStyle = CATEGORY_COLORS[e.cat];
  roundRect(ctx, 0, 0, w, h, w * 0.06);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(1, w / 80);
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `600 ${w * 0.13}px system-ui, sans-serif`;
  ctx.fillText(String(e.z), w * 0.08, w * 0.07);
  ctx.textAlign = 'center';
  ctx.font = `800 ${w * 0.38}px system-ui, sans-serif`;
  ctx.fillText(e.sym, w / 2, h * 0.24);
  ctx.font = `500 ${w * 0.11}px system-ui, sans-serif`;
  ctx.fillText(e.name, w / 2, h * 0.66, w * 0.9);
  ctx.font = `400 ${w * 0.1}px system-ui, sans-serif`;
  ctx.fillText(e.mass, w / 2, h * 0.81);
  ctx.textAlign = 'left';
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
    case 'image': {
      const img = getImage(el.src);
      if (img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, el.w, el.h);
      else {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 0, el.w, el.h);
      }
      break;
    }
    case 'video': {
      const v = getVideo(el.id, el.src);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, el.w, el.h);
      if (v.readyState >= 2) ctx.drawImage(v, 0, 0, el.w, el.h);
      if (v.paused) {
        const r = Math.min(el.w, el.h) * 0.12;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(el.w / 2, el.h / 2, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(el.w / 2 - r * 0.35, el.h / 2 - r * 0.5);
        ctx.lineTo(el.w / 2 + r * 0.55, el.h / 2);
        ctx.lineTo(el.w / 2 - r * 0.35, el.h / 2 + r * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'graph':
      drawGraph(ctx, el);
      break;
    case 'chem':
      drawChem(ctx, el);
      break;
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

export function drawBackground(ctx: CanvasRenderingContext2D, bg: string, pattern: BgPattern, cam: Camera, w: number, h: number): void {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (pattern === 'none') return;
  const dark = isDarkColor(bg);
  const minor = dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)';
  const major = dark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.18)';
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
    case 'graph':
      hLines(10, minor);
      vLines(10, minor);
      hLines(50, major);
      vLines(50, major);
      break;
    case 'dots': {
      const step = 32;
      if (step * z < 6) return;
      ctx.fillStyle = major;
      const r = Math.max(1, 1.6 * Math.min(z, 2));
      for (let x = Math.floor(wx0 / step) * step; x <= wx1; x += step)
        for (let y = Math.floor(wy0 / step) * step; y <= wy1; y += step) ctx.fillRect(toSx(x) - r / 2, toSy(y) - r / 2, r, r);
      break;
    }
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
    case 'music': {
      const gap = 12, row = gap * 4 + 70;
      if (gap * z < 3) return;
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = Math.floor(wy0 / row) * row; y <= wy1; y += row) {
        for (let k = 0; k < 5; k++) {
          const sy = Math.round(toSy(y + k * gap)) + 0.5;
          ctx.moveTo(0, sy);
          ctx.lineTo(w, sy);
        }
      }
      ctx.stroke();
      break;
    }
    case 'isometric': {
      const step = 40;
      if (step * z < 6) return;
      hLines(step * Math.sin(Math.PI / 3), minor);
      ctx.strokeStyle = minor;
      ctx.lineWidth = 1;
      const t = Math.tan(Math.PI / 3);
      const dx = step;
      ctx.beginPath();
      const H = (wy1 - wy0) / t;
      for (let x = Math.floor((wx0 - H) / dx) * dx; x <= wx1 + H; x += dx) {
        ctx.moveTo(toSx(x), toSy(wy0));
        ctx.lineTo(toSx(x + (wy1 - wy0) / t), toSy(wy1));
        ctx.moveTo(toSx(x), toSy(wy0));
        ctx.lineTo(toSx(x - (wy1 - wy0) / t), toSy(wy1));
      }
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
