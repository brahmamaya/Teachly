import type { BoxEl, El, PathEl, Rect } from './types';

export type Mat = [number, number, number, number, number, number];

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

let idCounter = 0;
export function uid(): string {
  idCounter = (idCounter + 1) % 1e6;
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + idCounter.toString(36);
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function pointInPolygon(px: number, py: number, poly: number[], stride = 2): boolean {
  let inside = false;
  const n = poly.length / stride;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * stride], yi = poly[i * stride + 1];
    const xj = poly[j * stride], yj = poly[j * stride + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function boxCorners(b: BoxEl): number[] {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  const out: number[] = [];
  for (const [dx, dy] of [[-b.w / 2, -b.h / 2], [b.w / 2, -b.h / 2], [b.w / 2, b.h / 2], [-b.w / 2, b.h / 2]]) {
    out.push(cx + dx * c - dy * s, cy + dx * s + dy * c);
  }
  return out;
}

const bboxCache = new WeakMap<El, Rect>();

export function bbox(el: El): Rect {
  let r = bboxCache.get(el);
  if (r) return r;
  if (el.type === 'path') {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const p = el.pts;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < x1) x1 = p[i];
      if (p[i] > x2) x2 = p[i];
      if (p[i + 1] < y1) y1 = p[i + 1];
      if (p[i + 1] > y2) y2 = p[i + 1];
    }
    const pad = el.size / 2 + (el.arrow ? el.size * 3 : 0);
    r = { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 };
  } else if (el.rot) {
    const c = boxCorners(el);
    const xs = [c[0], c[2], c[4], c[6]], ys = [c[1], c[3], c[5], c[7]];
    const x1 = Math.min(...xs), y1 = Math.min(...ys);
    r = { x: x1, y: y1, w: Math.max(...xs) - x1, h: Math.max(...ys) - y1 };
  } else {
    r = { x: el.x, y: el.y, w: el.w, h: el.h };
  }
  bboxCache.set(el, r);
  return r;
}

/** Does the world point hit the element (with tolerance in world units)? */
export function hitTest(el: El, px: number, py: number, tol: number): boolean {
  const b = bbox(el);
  if (px < b.x - tol || px > b.x + b.w + tol || py < b.y - tol || py > b.y + b.h + tol) return false;
  if (el.type === 'path') {
    const p = el.pts;
    const r = el.size / 2 + tol;
    if (p.length === 3) return dist(px, py, p[0], p[1]) <= r;
    for (let i = 3; i < p.length; i += 3) {
      if (distToSegment(px, py, p[i - 3], p[i - 2], p[i], p[i + 1]) <= r) return true;
    }
    if (el.closed) {
      const n = p.length;
      if (distToSegment(px, py, p[n - 3], p[n - 2], p[0], p[1]) <= r) return true;
      if (el.fill && pointInPolygon(px, py, p, 3)) return true;
    }
    // Filled freehand drawings can be grabbed anywhere inside.
    if (el.fill && el.style !== 'shape' && pointInPolygon(px, py, p, 3)) return true;
    return false;
  }
  // Box: move the point into the box's local frame.
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  const c = Math.cos(-el.rot), s = Math.sin(-el.rot);
  const lx = (px - cx) * c - (py - cy) * s;
  const ly = (px - cx) * s + (py - cy) * c;
  return Math.abs(lx) <= el.w / 2 + tol && Math.abs(ly) <= el.h / 2 + tol;
}

/** Fraction-based test: is the element mostly inside the lasso polygon? */
export function insideLasso(el: El, lasso: number[]): boolean {
  if (el.type === 'path') {
    const p = el.pts;
    const step = Math.max(1, Math.floor(p.length / 3 / 40)) * 3;
    let inside = 0, total = 0;
    for (let i = 0; i < p.length; i += step) {
      total++;
      if (pointInPolygon(p[i], p[i + 1], lasso)) inside++;
    }
    return total > 0 && inside / total >= 0.5;
  }
  return pointInPolygon(el.x + el.w / 2, el.y + el.h / 2, lasso);
}

export function matMul(a: Mat, b: Mat): Mat {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function applyMat(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Similarity transform: rotate by `rot` and scale by `s` around (px,py), then translate (tx,ty). */
export function similarity(px: number, py: number, s: number, rot: number, tx: number, ty: number): Mat {
  const c = Math.cos(rot) * s, n = Math.sin(rot) * s;
  return [c, n, -n, c, px - c * px + n * py + tx, py - n * px - c * py + ty];
}

export function matScale(m: Mat): number {
  return Math.hypot(m[0], m[1]);
}

export function matRotation(m: Mat): number {
  return Math.atan2(m[1], m[0]);
}

/** Bake a similarity transform into an element, returning a new element. */
export function transformEl<T extends El>(el: T, m: Mat): T {
  const s = matScale(m);
  if (el.type === 'path') {
    const pts = el.pts.slice();
    for (let i = 0; i < pts.length; i += 3) {
      const [x, y] = applyMat(m, pts[i], pts[i + 1]);
      pts[i] = x;
      pts[i + 1] = y;
    }
    return { ...el, pts, size: el.size * s } as T;
  }
  const [cx, cy] = applyMat(m, el.x + el.w / 2, el.y + el.h / 2);
  const w = el.w * s, h = el.h * s;
  const out = { ...el, x: cx - w / 2, y: cy - h / 2, w, h, rot: el.rot + matRotation(m) } as BoxEl;
  if (out.type === 'text' || out.type === 'table') out.fontSize = (el as unknown as { fontSize: number }).fontSize * s;
  return out as T;
}

export function translateEl<T extends El>(el: T, dx: number, dy: number): T {
  return transformEl(el, [1, 0, 0, 1, dx, dy]);
}

/** Ramer–Douglas–Peucker simplification on [x,y] pairs. */
export function rdp(points: [number, number][], eps: number): [number, number][] {
  if (points.length < 3) return points.slice();
  let maxD = 0, idx = 0;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = distToSegment(points[i][0], points[i][1], ax, ay, bx, by);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > eps) {
    const left = rdp(points.slice(0, idx + 1), eps);
    const right = rdp(points.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

export function pathFromPoints(pts: [number, number][], closed: boolean): number[] {
  const out: number[] = [];
  for (const [x, y] of pts) out.push(x, y, 0.5);
  if (closed && pts.length) out.push(pts[0][0], pts[0][1], 0.5);
  return out;
}

export function isPath(el: El): el is PathEl {
  return el.type === 'path';
}

/**
 * Stretch an element by (sx, sy) around the anchor (ax, ay). Line thickness
 * is kept, so resizing a diagram never makes its outline fatter or thinner.
 */
export function resizeEl<T extends El>(el: T, ax: number, ay: number, sx: number, sy: number): T {
  if (el.type === 'path') {
    const pts = el.pts.slice();
    for (let i = 0; i < pts.length; i += 3) {
      pts[i] = ax + (pts[i] - ax) * sx;
      pts[i + 1] = ay + (pts[i + 1] - ay) * sy;
    }
    return { ...el, pts } as T;
  }
  const x1 = ax + (el.x - ax) * sx, x2 = ax + (el.x + el.w - ax) * sx;
  const y1 = ay + (el.y - ay) * sy, y2 = ay + (el.y + el.h - ay) * sy;
  const out = { ...el, x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) } as BoxEl;
  if (out.type === 'text') out.fontSize = (el as unknown as { fontSize: number }).fontSize * Math.abs(sx);
  return out as T;
}

/** Give copied pieces fresh group ids (so copies are separate groups). */
export function regroup<T extends El>(els: T[]): T[] {
  const map = new Map<string, string>();
  return els.map((e) => {
    if (!e.group) return e;
    let g = map.get(e.group);
    if (!g) map.set(e.group, (g = uid()));
    return { ...e, group: g };
  });
}
