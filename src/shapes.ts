import { dist, pathFromPoints, rdp, uid } from './geometry';
import type { PathEl, ShapeKind } from './types';

export interface ShapeStyle {
  color: string;
  size: number;
  fill: string | null;
}

type P = [number, number];

function poly(n: number, cx: number, cy: number, rx: number, ry: number, start = -Math.PI / 2): P[] {
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

function ellipsePts(cx: number, cy: number, rx: number, ry: number, from = 0, to = Math.PI * 2): P[] {
  const steps = Math.max(24, Math.min(160, Math.round((Math.abs(rx) + Math.abs(ry)) / 3)));
  const out: P[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

function mk(pts: P[], closed: boolean, st: ShapeStyle, extra: Partial<PathEl> = {}): PathEl {
  return {
    id: uid(),
    type: 'path',
    style: 'shape',
    pts: pathFromPoints(pts, closed),
    color: st.color,
    size: st.size,
    opacity: 1,
    closed,
    fill: closed ? st.fill : null,
    ...extra,
  };
}

/**
 * Build the path elements for a shape dragged from (x1,y1) to (x2,y2).
 * `constrain` (shift) forces equal width/height or 45° lines.
 */
export function buildShape(kind: ShapeKind, x1: number, y1: number, x2: number, y2: number, st: ShapeStyle, constrain = false): PathEl[] {
  if (kind === 'square' || kind === 'circle') constrain = true;
  let w = x2 - x1, h = y2 - y1;
  const isLine = kind === 'line' || kind === 'arrow' || kind === 'dashed';
  if (constrain) {
    if (isLine) {
      const a = Math.round(Math.atan2(h, w) / (Math.PI / 4)) * (Math.PI / 4);
      const l = Math.hypot(w, h);
      w = Math.cos(a) * l;
      h = Math.sin(a) * l;
    } else {
      const m = Math.max(Math.abs(w), Math.abs(h));
      w = Math.sign(w || 1) * m;
      h = Math.sign(h || 1) * m;
    }
  }
  x2 = x1 + w;
  y2 = y1 + h;
  const l = Math.min(x1, x2), r = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2);
  const cx = (l + r) / 2, cy = (t + b) / 2, rx = (r - l) / 2, ry = (b - t) / 2;
  switch (kind) {
    case 'line':
      return [mk([[x1, y1], [x2, y2]], false, st)];
    case 'dashed':
      return [mk([[x1, y1], [x2, y2]], false, st, { dash: true })];
    case 'arrow':
      return [mk([[x1, y1], [x2, y2]], false, st, { arrow: 1 })];
    case 'rect':
    case 'square':
      return [mk([[l, t], [r, t], [r, b], [l, b]], true, st)];
    case 'ellipse':
    case 'circle':
      return [mk(ellipsePts(cx, cy, rx, ry), true, st)];
    case 'triangle':
      return [mk([[cx, t], [r, b], [l, b]], true, st)];
    case 'rtriangle':
      return [mk([[l, t], [l, b], [r, b]], true, st)];
    case 'diamond':
      return [mk([[cx, t], [r, cy], [cx, b], [l, cy]], true, st)];
    case 'pentagon':
      return [mk(poly(5, cx, cy, rx, ry), true, st)];
    case 'hexagon':
      return [mk(poly(6, cx, cy, rx, ry, 0), true, st)];
    case 'star': {
      const pts: P[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const k = i % 2 ? 0.42 : 1;
        pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
      }
      return [mk(pts, true, st)];
    }
    case 'parallelogram': {
      const o = (r - l) * 0.25;
      return [mk([[l + o, t], [r, t], [r - o, b], [l, b]], true, st)];
    }
    case 'cube': {
      const d = Math.min(r - l, b - t) * 0.3;
      const fr: P[] = [[l, t + d], [r - d, t + d], [r - d, b], [l, b]];
      const s2 = { ...st, fill: null };
      return [
        mk(fr, true, st),
        mk([[l, t + d], [l + d, t], [r, t], [r - d, t + d]], true, s2),
        mk([[r - d, t + d], [r, t], [r, b - d], [r - d, b]], true, s2),
        mk([[l, b], [l + d, b - d], [r, b - d]], false, s2, { dash: true }),
        mk([[l + d, t], [l + d, b - d]], false, s2, { dash: true }),
      ];
    }
    case 'cylinder': {
      const e = Math.max(6, ry * 0.25);
      const s2 = { ...st, fill: null };
      return [
        mk(ellipsePts(cx, t + e, rx, e), true, st),
        mk([[l, t + e], [l, b - e]], false, s2),
        mk([[r, t + e], [r, b - e]], false, s2),
        mk(ellipsePts(cx, b - e, rx, e, 0, Math.PI), false, s2),
        mk(ellipsePts(cx, b - e, rx, e, Math.PI, Math.PI * 2), false, s2, { dash: true }),
      ];
    }
    case 'cone': {
      const e = Math.max(6, ry * 0.2);
      const s2 = { ...st, fill: null };
      return [
        mk([[l, b - e], [cx, t], [r, b - e]], false, s2),
        mk(ellipsePts(cx, b - e, rx, e, 0, Math.PI), false, s2),
        mk(ellipsePts(cx, b - e, rx, e, Math.PI, Math.PI * 2), false, s2, { dash: true }),
        mk([[cx, t], [cx, b - e], [r, b - e]], false, s2, { dash: true }),
      ];
    }
    case 'sphere': {
      const rr = Math.min(rx, ry);
      const s2 = { ...st, fill: null };
      return [
        mk(ellipsePts(cx, cy, rr, rr), true, st),
        mk(ellipsePts(cx, cy, rr, rr * 0.3, 0, Math.PI), false, s2),
        mk(ellipsePts(cx, cy, rr, rr * 0.3, Math.PI, Math.PI * 2), false, s2, { dash: true }),
      ];
    }
    case 'arc': {
      // A half circle over the dragged line; bend it later with its handle.
      const dx = x2 - x1, dy = y2 - y1;
      const mx = (x1 + x2) / 2 + dy / 2, my = (y1 + y2) / 2 - dx / 2;
      return [mk(arcThrough(x1, y1, x2, y2, mx, my), false, { ...st, fill: null }, { arc: true })];
    }
    case 'axes2':
      return axes2(l, t, r, b, st);
    case 'axes3':
      return axes3(l, t, r, b, st);
  }
  return [];
}

/**
 * Points of the circular arc that starts at A, ends at B and passes
 * through M. (Nearly straight → a straight line with a middle point.)
 */
export function arcThrough(ax: number, ay: number, bx: number, by: number, mx: number, my: number): P[] {
  const d = 2 * (ax * (by - my) + bx * (my - ay) + mx * (ay - by));
  const chord = Math.hypot(bx - ax, by - ay) || 1;
  if (Math.abs(d) < 1e-6 * chord * chord) return [[ax, ay], [(ax + bx) / 2, (ay + by) / 2], [bx, by]];
  const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, m2 = mx * mx + my * my;
  const ux = (a2 * (by - my) + b2 * (my - ay) + m2 * (ay - by)) / d;
  const uy = (a2 * (mx - bx) + b2 * (ax - mx) + m2 * (bx - ax)) / d;
  const r = Math.hypot(ax - ux, ay - uy);
  // Almost flat (huge circle): draw it straight.
  if (r > chord * 60) return [[ax, ay], [(ax + bx) / 2, (ay + by) / 2], [bx, by]];
  const TAU = Math.PI * 2;
  const norm = (a: number) => ((a % TAU) + TAU) % TAU;
  const a0 = Math.atan2(ay - uy, ax - ux);
  const a1 = Math.atan2(by - uy, bx - ux);
  const am = Math.atan2(my - uy, mx - ux);
  const ccw = norm(a1 - a0);
  const sweep = norm(am - a0) < ccw ? ccw : ccw - TAU;
  const n = Math.max(16, Math.min(240, Math.round((Math.abs(sweep) * r) / 5)));
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (sweep * i) / n;
    out.push([ux + Math.cos(a) * r, uy + Math.sin(a) * r]);
  }
  out[0] = [ax, ay];
  out[n] = [bx, by];
  return out;
}

// ---------------------------------------------------------------------------
// Graph axes. Labels are drawn as strokes too, so the whole set scales,
// recolours and moves together like any other shape.

function letter(ch: string, cx: number, cy: number, s: number, st: ShapeStyle): PathEl[] {
  const h = s / 2;
  const ls = { ...st, fill: null, size: Math.max(1.5, st.size * 0.75) };
  switch (ch) {
    case 'x':
      return [mk([[cx - h, cy - h], [cx + h, cy + h]], false, ls), mk([[cx + h, cy - h], [cx - h, cy + h]], false, ls)];
    case 'y':
      return [mk([[cx - h, cy - h], [cx, cy + h * 0.15]], false, ls), mk([[cx + h, cy - h], [cx - h * 0.55, cy + h * 1.6]], false, ls)];
    case 'z':
      return [mk([[cx - h, cy - h], [cx + h, cy - h], [cx - h, cy + h], [cx + h, cy + h]], false, ls)];
    case 'O':
      return [mk(ellipsePts(cx, cy, h * 0.75, h), true, { ...ls, fill: null })];
  }
  return [];
}

function ticks(ax: number, ay: number, bx: number, by: number, n: number, len: number, st: ShapeStyle): PathEl[] {
  // Small marks across the segment a→b (excluding the ends).
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
  const nx = (-dy / L) * len, ny = (dx / L) * len;
  const ts = { ...st, fill: null, size: Math.max(1.2, st.size * 0.6) };
  const out: PathEl[] = [];
  for (let i = 1; i < n; i++) {
    const x = ax + (dx * i) / n, y = ay + (dy * i) / n;
    out.push(mk([[x - nx, y - ny], [x + nx, y + ny]], false, ts));
  }
  return out;
}

/** x–y axes through the middle of the box, with arrows, ticks and labels. */
function axes2(l: number, t: number, r: number, b: number, st: ShapeStyle): PathEl[] {
  const cx = (l + r) / 2, cy = (t + b) / 2;
  const s = Math.max(12, Math.min(36, Math.min(r - l, b - t) * 0.06));
  const a = { ...st, fill: null };
  const n = 5; // ticks per half axis
  return [
    mk([[l, cy], [r, cy]], false, a, { arrow: 2 }),
    mk([[cx, b], [cx, t]], false, a, { arrow: 2 }),
    ...ticks(cx, cy, r, cy, n, s * 0.22, a),
    ...ticks(cx, cy, l, cy, n, s * 0.22, a),
    ...ticks(cx, cy, cx, t, n, s * 0.22, a),
    ...ticks(cx, cy, cx, b, n, s * 0.22, a),
    ...letter('x', r - s * 0.5, cy + s * 1.1, s, st),
    ...letter('y', cx + s * 1.0, t + s * 0.5, s, st),
    ...letter('O', cx - s * 0.75, cy + s * 0.95, s * 0.9, st),
  ];
}

/** 3-D axes: z up, y to the right, x coming out towards the viewer. */
function axes3(l: number, t: number, r: number, b: number, st: ShapeStyle): PathEl[] {
  const w = r - l, h = b - t;
  const ox = l + w * 0.42, oy = t + h * 0.58;
  const s = Math.max(12, Math.min(36, Math.min(w, h) * 0.06));
  const a = { ...st, fill: null };
  // +x points down-left (towards the viewer); the hidden halves are dashed.
  const xx = l + w * 0.06, xy = b - h * 0.04;
  const k = 0.45;
  return [
    mk([[ox, oy], [r, oy]], false, a, { arrow: 1 }),
    mk([[ox, oy], [ox, t]], false, a, { arrow: 1 }),
    mk([[ox, oy], [xx, xy]], false, a, { arrow: 1 }),
    mk([[ox, oy], [ox - (r - ox) * k, oy]], false, a, { dash: true }),
    mk([[ox, oy], [ox, oy + (oy - t) * k]], false, a, { dash: true }),
    mk([[ox, oy], [ox + (ox - xx) * k, oy + (oy - xy) * k]], false, a, { dash: true }),
    ...letter('y', r - s * 0.4, oy + s * 1.2, s, st),
    ...letter('z', ox + s * 1.0, t + s * 0.5, s, st),
    ...letter('x', xx + s * 1.3, xy - s * 0.2, s, st),
    ...letter('O', ox + s * 0.8, oy + s * 0.95, s * 0.9, st),
  ];
}

/**
 * Recognise a hand-drawn stroke (flat x,y,p list) as a clean shape.
 * Returns replacement point list + closed flag, or null if nothing matched.
 */
export function recognize(flat: number[]): { pts: [number, number][]; closed: boolean } | null {
  const pts: P[] = [];
  for (let i = 0; i < flat.length; i += 3) pts.push([flat[i], flat[i + 1]]);
  if (pts.length < 4) return null;
  let len = 0;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    if (i) len += dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    x1 = Math.min(x1, pts[i][0]);
    y1 = Math.min(y1, pts[i][1]);
    x2 = Math.max(x2, pts[i][0]);
    y2 = Math.max(y2, pts[i][1]);
  }
  const diag = Math.hypot(x2 - x1, y2 - y1);
  if (diag < 12) return null;
  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];
  const gap = dist(sx, sy, ex, ey);

  // Straight line
  if (gap / len > 0.92) return { pts: [[sx, sy], [ex, ey]], closed: false };

  const closed = gap < Math.max(diag * 0.22, 14);
  if (!closed) return null;

  // Ellipse fit using the bounding box.
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = (x2 - x1) / 2, ry = (y2 - y1) / 2;
  let err = 0;
  for (const [x, y] of pts) {
    const v = Math.sqrt(((x - cx) / (rx || 1)) ** 2 + ((y - cy) / (ry || 1)) ** 2);
    err += Math.abs(v - 1);
  }
  err /= pts.length;

  // Polygon via corner detection
  const loop = pts.concat([pts[0]]);
  let simp = rdp(loop, diag * 0.075);
  if (simp.length > 2 && dist(simp[0][0], simp[0][1], simp[simp.length - 1][0], simp[simp.length - 1][1]) < diag * 0.15) {
    simp = simp.slice(0, -1);
  }
  const n = simp.length;

  if (err < 0.09 && (n > 5 || err < 0.05)) {
    // Snap near-circles to circles.
    let rrx = rx, rry = ry;
    if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.15) rrx = rry = (rx + ry) / 2;
    const out: P[] = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      out.push([cx + Math.cos(a) * rrx, cy + Math.sin(a) * rry]);
    }
    return { pts: out, closed: true };
  }

  if (n === 3) return { pts: simp, closed: true };
  if (n === 4) {
    // Check right angles → axis-aligned rectangle when nearly aligned.
    let rightish = true;
    for (let i = 0; i < 4; i++) {
      const a = simp[(i + 3) % 4], b = simp[i], c = simp[(i + 1) % 4];
      const v1x = a[0] - b[0], v1y = a[1] - b[1], v2x = c[0] - b[0], v2y = c[1] - b[1];
      const cos = (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y));
      if (Math.abs(cos) > 0.3) rightish = false;
    }
    if (rightish) {
      const ang = Math.atan2(simp[1][1] - simp[0][1], simp[1][0] - simp[0][0]);
      const mod = ((ang % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
      if (mod < 0.2 || mod > Math.PI / 2 - 0.2) {
        return { pts: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]], closed: true };
      }
    }
    return { pts: simp, closed: true };
  }
  if (n >= 5 && n <= 8) return { pts: simp, closed: true };
  if (err < 0.16) {
    const out: P[] = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return { pts: out, closed: true };
  }
  return null;
}
