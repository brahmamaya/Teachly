import { pathFromPoints } from '../geometry';
import type { El, PathEl, TextEl } from '../types';

// Angle marks stay true: when a wedge (a triangle) is stretched, the arc and the number at its corner
// are redrawn for the new angle. A mark is a path or a text carrying `ang: { v }` in the same group
// as the triangle; `v` is the corner. A number the teacher typed over (like θ) is left alone.

type Pt = [number, number];

/** The three corners of a closed three-cornered outline. */
function corners(t: PathEl): Pt[] | null {
  const p = t.pts;
  const n = p.length / 3;
  const last = n > 1 && p[0] === p[(n - 1) * 3] && p[1] === p[(n - 1) * 3 + 1] ? n - 1 : n;
  if (!t.closed || last !== 3) return null;
  return [0, 1, 2].map((i): Pt => [p[i * 3], p[i * 3 + 1]]);
}

const same = (a: number[], b: number[]): boolean => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.01);

/** The same elements with every angle mark made true again (the very same array when nothing changed). */
export function refreshAngles(els: El[]): El[] {
  // (Wedges placed before angle marks were tagged are recognised by their look: a degree number or a 15-point arc next to a corner.)
  const isNumber = (e: El): boolean => e.type === 'text' && /^\d+(\.\d+)?°$/.test(e.text);
  if (!els.some((e) => (e as { ang?: unknown }).ang || isNumber(e))) return els;
  const tri = new Map<string, Pt[]>();
  for (const e of els) if (e.type === 'path' && e.group && e.closed && !tri.has(e.group)) {
    const c = corners(e);
    if (c) tri.set(e.group, c);
  }
  let changed = false;
  const out = els.map((e) => {
    let ang = (e as { ang?: { v: number } }).ang;
    const c = e.group ? tri.get(e.group) : undefined;
    if (!c) return e;
    if (!ang) {
      // An older wedge: the corner nearest to its number or arc.
      const [px, py] = e.type === 'text' ? [e.x + e.w / 2, e.y + e.h / 2] : e.type === 'path' && !e.closed && !e.surf && e.pts.length === 45 ? [e.pts[0], e.pts[1]] : [NaN, NaN];
      if (Number.isNaN(px) || (e.type === 'text' && !isNumber(e))) return e;
      const near = c.map((q, i) => ({ i, d: Math.hypot(q[0] - px, q[1] - py) })).sort((a, b) => a.d - b.d)[0];
      if (near.d > (e.type === 'text' ? 260 : 90)) return e;
      ang = { v: near.i };
    }
    const V = c[ang.v], A = c[(ang.v + 1) % 3], B = c[(ang.v + 2) % 3];
    const a1 = Math.atan2(A[1] - V[1], A[0] - V[0]), a2 = Math.atan2(B[1] - V[1], B[0] - V[0]);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta <= -Math.PI) delta += 2 * Math.PI;
    const theta = Math.abs(delta);
    const shortest = Math.min(Math.hypot(A[0] - V[0], A[1] - V[1]), Math.hypot(B[0] - V[0], B[1] - V[1]));
    const ra = Math.min(70, shortest * 0.3);
    let next: El = e;
    if (e.type === 'path') {
      const pts: Pt[] = [];
      for (let i = 0; i <= 14; i++) pts.push([V[0] + Math.cos(a1 + (delta * i) / 14) * ra, V[1] + Math.sin(a1 + (delta * i) / 14) * ra]);
      const flat = pathFromPoints(pts, false);
      if (!same(flat, e.pts)) next = { ...e, pts: flat, ang };
    } else if (e.type === 'text' && /^\d+(\.\d+)?°$/.test(e.text)) {
      const t = e as TextEl;
      const text = `${Math.round((theta * 180) / Math.PI)}°`;
      const d = Math.min(Math.max(ra + 52, 28 / Math.max(0.2, Math.sin(theta / 2))), shortest * 0.9);
      const mid = a1 + delta / 2;
      // The number keeps its size however the wedge is stretched (stretching shrinks writing, which made it vanish).
      const fs = 30, k = fs / t.fontSize;
      const w = t.w * k * (text.length / t.text.length), h = t.h * k;
      const x = V[0] + Math.cos(mid) * d - w / 2, y = V[1] + Math.sin(mid) * d - h / 2;
      if (text !== t.text || Math.abs(fs - t.fontSize) > 0.01 || Math.abs(x - t.x) > 0.01 || Math.abs(y - t.y) > 0.01) next = { ...t, text, fontSize: fs, w, h, x, y, ang };
    }
    if (next !== e) changed = true;
    return next;
  });
  return changed ? out : els;
}
