import type { Board, Ptr, Tool } from '../board';
import { bbox, pointInPolygon, rdp, uid } from '../geometry';
import { renderRegion } from '../renderer';
import { store } from '../store';
import type { El, PathEl } from '../types';
import { toast } from '../ui/panel';

/**
 * Paint bucket: tap inside any closed area (made by pen lines, shapes, a PDF
 * drawing…) and exactly that area is coloured, under its lines. Holes inside
 * it (letters, other shapes) stay clear. Tap a coloured area again to change
 * its colour, or use "no fill" to remove it.
 */
export class FillTool implements Tool {
  cursor = 'cell';

  constructor(private board: Board) {}

  down(p: Ptr): void {
    const t = store.tool;
    const color = t.fillColor;
    const els = store.page.els;
    // 1. A coloured area under the finger: recolour it (or remove it).
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      if (el.type !== 'path' || !el.region || el.locked || !insideRegion(el, p.x, p.y)) continue;
      if (color === 'none') store.replaceEls(new Set([el.id]), []);
      else store.mapEls(new Set([el.id]), (e) => ({ ...e, fill: color, opacity: t.fillOpacity }) as PathEl);
      return;
    }
    if (color === 'none') return;
    // 2. Find the closed area around the finger and colour it.
    const res = traceArea(store.page, this.board.viewRect(), this.board.px, p.x, p.y);
    if (typeof res === 'string') return toast(res, 3500);
    const el: PathEl = {
      id: uid(),
      type: 'path',
      style: 'shape',
      pts: res.outer,
      rings: res.holes,
      region: true,
      closed: true,
      fill: color,
      color: 'rgba(0,0,0,0)',
      size: 0,
      opacity: t.fillOpacity,
    };
    // Under the lines: just above the picture / PDF page it is on, else at the bottom.
    let at = 0;
    els.forEach((e, i) => {
      if ((e.type === 'image' || (e.type === 'path' && e.region)) && inBox(e, p.x, p.y)) at = i + 1;
    });
    store.setEls([...els.slice(0, at), el, ...els.slice(at)]);
  }

  move(): void {}
  up(): void {}
  cancel(): void {}
}

function inBox(e: El, x: number, y: number): boolean {
  const b = bbox(e);
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

function insideRegion(el: PathEl, x: number, y: number): boolean {
  if (!inBox(el, x, y) || !pointInPolygon(x, y, el.pts, 3)) return false;
  // even-odd: inside an odd number of holes means outside
  let n = 0;
  for (const r of el.rings ?? []) if (pointInPolygon(x, y, r, 2)) n++;
  return n % 2 === 0;
}

/** Most pixels looked at for one tap (fast on classroom boards). */
const MAX_PX = 2_600_000;

/**
 * Draw what is on screen (without other fills and without the page lines),
 * flood out from the tap until a line or a change of colour, and turn the
 * area's edges into outlines in world coordinates.
 */
function traceArea(
  page: { bg: string; els: El[] },
  view: { x: number; y: number; w: number; h: number },
  px: number,
  wx: number,
  wy: number,
): { outer: number[]; holes: number[][] } | string {
  let k = 1 / px; // raster pixels per world unit (1 per screen pixel)
  if ((view.w * k) * (view.h * k) > MAX_PX) k *= Math.sqrt(MAX_PX / (view.w * k * view.h * k));
  const W = Math.max(8, Math.round(view.w * k)), H = Math.max(8, Math.round(view.h * k));
  const cv = renderRegion(
    { bg: page.bg, pattern: 'none', els: page.els.filter((e) => !(e.type === 'path' && e.region)) },
    view,
    W,
    H,
  );
  const data = cv.getContext('2d')!.getImageData(0, 0, W, H).data;
  const sx = Math.floor((wx - view.x) * k), sy = Math.floor((wy - view.y) * k);
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return 'Tap inside an area on the screen.';
  const s = (sy * W + sx) * 4;
  const r0 = data[s], g0 = data[s + 1], b0 = data[s + 2];
  const N = W * H;
  // Walls: pixels clearly different from the tapped colour (lines, edges).
  const wall = new Uint8Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) {
    if (Math.abs(data[j] - r0) + Math.abs(data[j + 1] - g0) + Math.abs(data[j + 2] - b0) > 60) wall[i] = 1;
  }
  // Thicken walls by one pixel, so a hair-thin gap in a hand-drawn line still closes.
  const thick = wall.slice();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!wall[i]) continue;
      if (x > 0) thick[i - 1] = 1;
      if (x < W - 1) thick[i + 1] = 1;
      if (y > 0) thick[i - W] = 1;
      if (y < H - 1) thick[i + W] = 1;
    }
  const seed = sy * W + sx;
  if (wall[seed]) return 'Tap inside an area, not on a line.';
  // Flood fill (4 directions).
  const mask = new Uint8Array(N);
  const stack = [seed];
  mask[seed] = 1;
  let edge = false, count = 0;
  let minX = sx, maxX = sx, minY = sy, maxY = sy;
  while (stack.length) {
    const i = stack.pop()!;
    count++;
    const x = i % W, y = (i - x) / W;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (x > 0 && !mask[i - 1] && !thick[i - 1]) (mask[i - 1] = 1), stack.push(i - 1);
    if (x < W - 1 && !mask[i + 1] && !thick[i + 1]) (mask[i + 1] = 1), stack.push(i + 1);
    if (y > 0 && !mask[i - W] && !thick[i - W]) (mask[i - W] = 1), stack.push(i - W);
    if (y < H - 1 && !mask[i + W] && !thick[i + W]) (mask[i + W] = 1), stack.push(i + W);
  }
  if (edge) return 'This area is not closed (or goes past the screen). Close the gap or zoom out, then tap inside.';
  if (count < 6) return 'This area is too small to fill. Zoom in and tap again.';
  // Grow the area by 2 pixels so it tucks under its lines (no thin gap).
  for (let pass = 0; pass < 2; pass++) {
    const grow: number[] = [];
    for (let y = Math.max(0, minY - 1); y <= Math.min(H - 1, maxY + 1); y++)
      for (let x = Math.max(0, minX - 1); x <= Math.min(W - 1, maxX + 1); x++) {
        const i = y * W + x;
        if (mask[i]) continue;
        if ((x > 0 && mask[i - 1] === 1) || (x < W - 1 && mask[i + 1] === 1) || (y > 0 && mask[i - W] === 1) || (y < H - 1 && mask[i + W] === 1)) grow.push(i);
      }
    for (const i of grow) mask[i] = 1;
    minX = Math.max(0, minX - 1);
    minY = Math.max(0, minY - 1);
    maxX = Math.min(W - 1, maxX + 1);
    maxY = Math.min(H - 1, maxY + 1);
  }
  const loops = contours(mask, W, H, minX, minY, maxX, maxY);
  if (!loops.length) return 'Could not fill this area.';
  // Raster → world; simplify; the biggest loop is the outline, the rest are holes.
  const toWorld = (l: [number, number][]) => rdp(l, 0.7).map(([x, y]) => [view.x + (x + 0.5) / k, view.y + (y + 0.5) / k] as [number, number]);
  const area = (l: [number, number][]) => {
    let a = 0;
    for (let i = 0, j = l.length - 1; i < l.length; j = i++) a += (l[j][0] - l[i][0]) * (l[j][1] + l[i][1]);
    return Math.abs(a / 2);
  };
  const sized = loops.filter((l) => l.length >= 4).map((l) => ({ l, a: area(l) })).filter((o) => o.a > 3).sort((a, b) => b.a - a.a);
  if (!sized.length) return 'Could not fill this area.';
  const outer = toWorld(sized[0].l).flatMap(([x, y]) => [x, y, 0.5]);
  const holes = sized.slice(1).map((o) => toWorld(o.l).flat());
  return { outer, holes };
}

/**
 * Edges of a filled mask as closed loops (marching squares over pixel
 * centres). Coordinates are in pixels.
 */
function contours(mask: Uint8Array, W: number, H: number, x0: number, y0: number, x1: number, y1: number): [number, number][][] {
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? mask[y * W + x] : 0);
  // Points on cell edges are kept doubled, so they are whole numbers.
  const SW = 2 * (W + 2);
  const key = (X: number, Y: number) => (Y + 2) * SW + (X + 2);
  const next = new Map<number, number[]>();
  const link = (ax: number, ay: number, bx: number, by: number) => {
    const a = key(ax, ay), b = key(bx, by);
    (next.get(a) ?? next.set(a, []).get(a)!).push(b);
    (next.get(b) ?? next.set(b, []).get(b)!).push(a);
  };
  for (let y = y0 - 1; y <= y1; y++)
    for (let x = x0 - 1; x <= x1; x++) {
      const c = (at(x, y) ? 8 : 0) | (at(x + 1, y) ? 4 : 0) | (at(x + 1, y + 1) ? 2 : 0) | (at(x, y + 1) ? 1 : 0);
      if (c === 0 || c === 15) continue;
      // edge midpoints (doubled): top, right, bottom, left
      const T: [number, number] = [2 * x + 1, 2 * y], R: [number, number] = [2 * x + 2, 2 * y + 1];
      const B: [number, number] = [2 * x + 1, 2 * y + 2], L: [number, number] = [2 * x, 2 * y + 1];
      const segs: [number, number][][] = {
        1: [[L, B]], 2: [[B, R]], 3: [[L, R]], 4: [[T, R]], 5: [[L, T], [B, R]], 6: [[T, B]], 7: [[L, T]],
        8: [[L, T]], 9: [[T, B]], 10: [[T, R], [L, B]], 11: [[T, R]], 12: [[L, R]], 13: [[B, R]], 14: [[L, B]],
      }[c] as [number, number][][];
      for (const [a, b] of segs) link(a[0], a[1], b[0], b[1]);
    }
  const loops: [number, number][][] = [];
  const used = new Set<string>();
  for (const [startKey, nbrs] of next) {
    for (const n0 of nbrs) {
      const e0 = startKey < n0 ? `${startKey},${n0}` : `${n0},${startKey}`;
      if (used.has(e0)) continue;
      const loop: [number, number][] = [];
      let prev = startKey, cur = n0;
      used.add(e0);
      loop.push(fromKey(startKey, SW));
      for (let guard = 0; cur !== startKey && guard < 4_000_000; guard++) {
        loop.push(fromKey(cur, SW));
        const options = next.get(cur)!;
        const nx = options.find((o) => o !== prev && !used.has(cur < o ? `${cur},${o}` : `${o},${cur}`));
        if (nx === undefined) break;
        used.add(cur < nx ? `${cur},${nx}` : `${nx},${cur}`);
        prev = cur;
        cur = nx;
      }
      if (loop.length >= 4) loops.push(loop);
    }
  }
  return loops;
}

function fromKey(k: number, SW: number): [number, number] {
  const X = (k % SW) - 2, Y = Math.floor(k / SW) - 2;
  return [X / 2, Y / 2];
}
