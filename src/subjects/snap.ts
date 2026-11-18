import { similarity, type Mat } from '../geometry';
import type { El, PathEl } from '../types';

// Auto set: a block put near a surface (ground, table, the slope of a wedge, the top of another block)
// turns to lie along it and sits on it. Surfaces are the lines and outlines marked `surf`.

export interface Surface {
  ax: number;
  ay: number;
  /** Unit vector along the surface (pointing to the right). */
  ux: number;
  uy: number;
  /** Unit vector away from the surface, upwards. */
  nx: number;
  ny: number;
  len: number;
}

/** The upward-facing edges of everything marked `surf` (skipping `skip`). */
export function surfaces(els: El[], skip?: Set<string>): Surface[] {
  const out: Surface[] = [];
  for (const e of els) {
    if (e.type !== 'path' || !e.surf || skip?.has(e.id)) continue;
    const p = e.pts;
    const n = p.length / 3;
    const pt = (i: number): [number, number] => [p[i * 3], p[i * 3 + 1]];
    // A closed outline repeats its first point at the end.
    const last = e.closed && n > 1 && p[0] === p[(n - 1) * 3] && p[1] === p[(n - 1) * 3 + 1] ? n - 1 : n;
    let cx = 0, cy = 0;
    for (let i = 0; i < last; i++) {
      cx += p[i * 3];
      cy += p[i * 3 + 1];
    }
    cx /= last || 1;
    cy /= last || 1;
    for (let i = 0; i + 1 < n; i++) {
      const a = pt(i), b = pt(i + 1);
      let ux = b[0] - a[0], uy = b[1] - a[1];
      const len = Math.hypot(ux, uy);
      if (len < 20) continue;
      ux /= len;
      uy /= len;
      let ax = a[0], ay = a[1];
      if (ux < 0) {
        ux = -ux;
        uy = -uy;
        ax = b[0];
        ay = b[1];
      }
      if (Math.abs(uy) > 0.97) continue; // a wall, not a floor
      let nx = uy, ny = -ux; // one side of the edge
      if (e.closed) {
        // The side that points out of the outline.
        const mx = ax + (ux * len) / 2, my = ay + (uy * len) / 2;
        if ((mx - cx) * nx + (my - cy) * ny < 0) {
          nx = -nx;
          ny = -ny;
        }
        if (ny > -0.2) continue; // facing down or sideways: nothing can rest on it
      } else if (ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      out.push({ ax, ay, ux, uy, nx, ny, len });
    }
  }
  return out;
}

/** Where along the closest surface (within `reach`) the point lies. */
export function nearest(segs: Surface[], x: number, y: number, reach: number): { s: Surface; t: number } | null {
  let best: { s: Surface; t: number } | null = null;
  let bd = reach;
  for (const s of segs) {
    const t = (x - s.ax) * s.ux + (y - s.ay) * s.uy;
    if (t < -40 || t > s.len + 40) continue;
    const d = Math.abs((x - s.ax) * s.nx + (y - s.ay) * s.ny);
    if (d < bd) {
      bd = d;
      best = { s, t };
    }
  }
  return best;
}

export interface BlockInfo {
  cx: number;
  cy: number;
  w: number;
  h: number;
  ux: number;
  uy: number;
  vx: number;
  vy: number;
}

/** Centre, size and axes of a block drawn as a rectangle (turned or not). */
export function blockInfo(r: PathEl): BlockInfo | null {
  const p = r.pts;
  if (p.length < 12) return null;
  const ux = p[3] - p[0], uy = p[4] - p[1], vx = p[9] - p[0], vy = p[10] - p[1];
  const w = Math.hypot(ux, uy), h = Math.hypot(vx, vy);
  if (!w || !h) return null;
  return { cx: p[0] + (ux + vx) / 2, cy: p[1] + (uy + vy) / 2, w, h, ux: ux / w, uy: uy / w, vx: vx / h, vy: vy / h };
}

/**
 * The move that puts the block on the surface: turn it to lie along the surface, then bring its
 * middle to half its height above the surface at `t` (kept so the block stays over the surface).
 */
export function seat(info: BlockInfo, s: Surface, t: number): Mat {
  let d = Math.atan2(s.uy, s.ux) - Math.atan2(info.uy, info.ux);
  d = ((((d + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI) - Math.PI / 2; // the smaller turn, within a quarter turn
  // Writing must not end up upside down: the block's "down" must point into the surface.
  const vx = info.vx * Math.cos(d) - info.vy * Math.sin(d), vy = info.vx * Math.sin(d) + info.vy * Math.cos(d);
  if (vx * s.nx + vy * s.ny > 0) d += Math.PI;
  const margin = Math.min(info.w / 2, s.len / 2);
  const tt = Math.max(margin, Math.min(s.len - margin, t));
  const tx = s.ax + s.ux * tt + s.nx * (info.h / 2);
  const ty = s.ay + s.uy * tt + s.ny * (info.h / 2);
  return similarity(info.cx, info.cy, 1, d, tx - info.cx, ty - info.cy);
}
