import type { Board, Ptr, Tool } from '../board';
import { applyMat, bbox, hitTest, IDENTITY, insideLasso, type Mat, pathFromPoints, resizeEl, similarity, springPts, transformEl, translateEl } from '../geometry';
import { drawEl, isDarkColor } from '../renderer';
import { ui } from '../ui/scale';
import { dragCancel, dragEnd, dragOver, dropAvailable } from '../ui/pagedrop';
import { blockInfo, nearest, seat, surfaces, type Surface } from '../subjects/snap';
import { toast } from '../ui/panel';
import { toggleTape } from './tape';
import { store } from '../store';
import type { El, PathEl, Rect, TextEl } from '../types';
import { arcThrough } from '../shapes';
import { drawGuides, type Guide, guideTargets, snapToGuides } from '../guides';
import { cellAt, type TableEditor } from './table';
import type { TextEditor } from './text';

type Mode =
  | { k: 'move'; sx: number; sy: number; moved: boolean; clicked: El | null; r0: Rect | null; targets: Rect[] | null; segs?: Surface[] }
  /** hx / hy: which side is dragged (-1 left/top, 1 right/bottom, 0 untouched). */
  | { k: 'resize'; r: Rect; hx: number; hy: number; keep: boolean }
  | { k: 'rotate'; cx: number; cy: number; a0: number }
  | { k: 'lasso'; pts: number[]; add: boolean }
  /** Dragging one end of a straight line, arrow or spring (its label follows the middle). */
  | { k: 'end'; line: PathEl; idx: 0 | 1; labels: El[]; preview: El[] | null }
  /** Bending an arc by its middle handle. */
  | { k: 'bend'; el: PathEl; preview: PathEl | null };

const HANDLE = 10;

type Handle = { x: number; y: number; hx: number; hy: number };

export class SelectTool implements Tool {
  cursor = 'default';
  private mode: Mode | null = null;
  private pid = -1;
  private mat: Mat = IDENTITY;
  private lastTap = { t: 0, id: '' };
  /** Alignment guides shown while moving. */
  private guides: Guide[] = [];
  /** A block being moved near a surface: that surface (lit up) while it is being seated. */
  private seatOn: Surface | null = null;
  /** Anchor and stretch factors while resizing. */
  private resizeArgs: [number, number, number, number] | null = null;

  /** Set by the app: typing into table cells. */
  tableEditor: TableEditor | null = null;

  constructor(private board: Board, private editor: TextEditor) {}

  private bounds(): Rect | null {
    return this.board.selectionBounds();
  }

  /** Can the selection be stretched in one direction (no text, pictures or rotated items)? */
  private stretchable(): boolean {
    const els = store.selectedEls();
    if (els.every((e) => e.type === 'path' || e.type === 'table')) return true;
    // One group (a graph): free stretch sideways or up-down; its writing stays readable.
    // Lines, shapes and their labels (one group or several): stretch freely in any direction.
    return els.some((e) => e.type === 'path') && els.every((e) => e.type === 'path' || e.type === 'text' || e.type === 'table');
  }

  private handles(r: Rect): { grips: Handle[]; rot: [number, number] } {
    const px = this.board.px;
    const grips: Handle[] = [];
    for (const hy of [-1, 0, 1])
      for (const hx of [-1, 0, 1]) {
        if (!hx && !hy) continue;
        if ((!hx || !hy) && !this.stretchable()) continue;
        grips.push({ x: r.x + ((hx + 1) / 2) * r.w, y: r.y + ((hy + 1) / 2) * r.h, hx, hy });
      }
    return { grips, rot: [r.x + r.w / 2, r.y - 40 * px] };
  }

  private gripAt(p: Ptr, r: Rect): Handle | null {
    const hr = this.hitRadius(p);
    let best: Handle | null = null;
    let bd = hr;
    for (const g of this.handles(r).grips) {
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    return best;
  }

  /** The one selected arc (its bend handle is shown). */
  private selectedArc(): PathEl | null {
    const els = store.selectedEls();
    const e = els.length === 1 ? els[0] : null;
    return e && e.type === 'path' && e.arc && !e.locked && e.pts.length >= 9 ? e : null;
  }

  /** The one block (plus its labels) that seats itself on a surface, when exactly that is selected. */
  private loneBlock(): PathEl | null {
    const els = store.selectedEls();
    const blocks = els.filter((e): e is PathEl => e.type === 'path' && e.snap === 'block');
    return blocks.length === 1 && els.every((e) => e === blocks[0] || e.type === 'text') ? blocks[0] : null;
  }

  /** One straight line, arrow or spring (plus its text labels) is selected: its two ends can be dragged. */
  private selectedLine(): { line: PathEl; labels: El[] } | null {
    const els = store.selectedEls();
    const lines = els.filter((e): e is PathEl => e.type === 'path' && !e.closed && !e.arc && !e.locked && (e.pts.length === 6 || !!e.spring));
    if (lines.length !== 1 || !els.every((e) => e === lines[0] || e.type === 'text')) return null;
    return { line: lines[0], labels: els.filter((e) => e !== lines[0]) };
  }

  private lineEnds(l: PathEl): [[number, number], [number, number]] {
    const n = l.pts.length;
    return [[l.pts[0], l.pts[1]], [l.pts[n - 3], l.pts[n - 2]]];
  }

  private arcHandle(e: PathEl): [number, number] {
    const n = e.pts.length / 3;
    const i = Math.floor(n / 2) * 3;
    return [e.pts[i], e.pts[i + 1]];
  }

  private hitsArcHandle(p: Ptr): PathEl | null {
    const e = this.selectedArc();
    if (!e) return null;
    const [x, y] = this.arcHandle(e);
    return Math.hypot(p.x - x, p.y - y) < this.hitRadius(p) * 1.2 ? e : null;
  }

  private hitRadius(p: Ptr): number {
    return HANDLE * 2 * this.board.px * ui() * (p.type === 'touch' ? 1.6 : 1);
  }

  private topHit(x: number, y: number): El | null {
    const els = store.page.els;
    const tol = 6 * this.board.px;
    for (let i = els.length - 1; i >= 0; i--) {
      if (!els[i].locked && hitTest(els[i], x, y, tol)) return els[i];
    }
    // A group (e.g. a graph) can be grabbed anywhere inside its outline.
    const boxes = new Map<string, { r: Rect; el: El; z: number }>();
    els.forEach((e, z) => {
      if (!e.group || e.locked) return;
      const b = bbox(e), cur = boxes.get(e.group);
      if (!cur) boxes.set(e.group, { r: { ...b }, el: e, z });
      else {
        const x1 = Math.min(cur.r.x, b.x), y1 = Math.min(cur.r.y, b.y);
        cur.r = { x: x1, y: y1, w: Math.max(cur.r.x + cur.r.w, b.x + b.w) - x1, h: Math.max(cur.r.y + cur.r.h, b.y + b.h) - y1 };
        cur.z = z;
      }
    });
    let best: { el: El; z: number } | null = null;
    for (const g of boxes.values()) {
      if (x >= g.r.x && x <= g.r.x + g.r.w && y >= g.r.y && y <= g.r.y + g.r.h && (!best || g.z > best.z)) best = g;
    }
    return best?.el ?? null;
  }

  /** Does the pointer land on the current selection or one of its handles? */
  hitsSelection(p: Ptr): boolean {
    const r = this.bounds();
    if (!r) return false;
    if (this.hitsArcHandle(p)) return true;
    const h = this.handles(r);
    if (Math.hypot(p.x - h.rot[0], p.y - h.rot[1]) < this.hitRadius(p)) return true;
    if (this.gripAt(p, r)) return true;
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  get busy(): boolean {
    return !!this.mode;
  }

  down(p: Ptr): void {
    if (this.mode) return;
    this.pid = p.id;
    this.mat = IDENTITY;
    const arc = this.hitsArcHandle(p);
    if (arc) {
      this.mode = { k: 'bend', el: arc, preview: null };
      return;
    }
    const sl = this.selectedLine();
    if (sl) {
      const ends = this.lineEnds(sl.line);
      for (const i of [0, 1] as const) {
        if (Math.hypot(p.x - ends[i][0], p.y - ends[i][1]) < this.hitRadius(p) * 1.15) {
          this.mode = { k: 'end', line: sl.line, idx: i, labels: sl.labels, preview: null };
          return;
        }
      }
    }
    const r = this.bounds();
    if (r) {
      const h = this.handles(r);
      if (Math.hypot(p.x - h.rot[0], p.y - h.rot[1]) < this.hitRadius(p)) {
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        this.mode = { k: 'rotate', cx, cy, a0: Math.atan2(p.y - cy, p.x - cx) };
        return;
      }
      const g = this.gripAt(p, r);
      if (g) {
        this.mode = { k: 'resize', r, hx: g.hx, hy: g.hy, keep: !this.stretchable() };
        return;
      }
    }
    // Inside the current selection: move all of it together (never just the
    // one piece under the finger).
    if (r && !p.shift && store.selection.size > 1 && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      // (`clicked` = the piece under the finger, so a double-tap on a label inside a group can still edit it.)
      const under = this.topHit(p.x, p.y);
      this.mode = { k: 'move', sx: p.x, sy: p.y, moved: false, clicked: under && store.selection.has(under.id) ? under : null, r0: null, targets: null };
      return;
    }
    const hit = this.topHit(p.x, p.y);
    if (hit) {
      if (p.shift) {
        const sel = new Set(store.selection);
        if (sel.has(hit.id)) sel.delete(hit.id);
        else sel.add(hit.id);
        store.select(sel);
      } else if (!store.selection.has(hit.id)) store.select([hit.id]);
      this.mode = { k: 'move', sx: p.x, sy: p.y, moved: false, clicked: hit, r0: null, targets: null };
      return;
    }
    if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      this.mode = { k: 'move', sx: p.x, sy: p.y, moved: false, clicked: null, r0: null, targets: null };
      return;
    }
    if (!p.shift) store.clearSelection();
    this.mode = { k: 'lasso', pts: [p.x, p.y], add: p.shift };
  }

  move(p: Ptr): void {
    const m = this.mode;
    if (!m || p.id !== this.pid) return;
    switch (m.k) {
      case 'move': {
        let dx = p.x - m.sx, dy = p.y - m.sy;
        if (!m.moved && Math.hypot(dx, dy) < 3 * this.board.px) return;
        m.moved = true;
        // Smart guides: line up with other drawings and the page (Alt = free move).
        m.r0 ??= this.bounds();
        m.targets ??= guideTargets(store.page.els, store.selection);
        this.guides = [];
        if (m.r0 && !p.alt) {
          const g = snapToGuides({ ...m.r0, x: m.r0.x + dx, y: m.r0.y + dy }, m.targets, 8 * this.board.px);
          dx += g.dx;
          dy += g.dy;
          this.guides = g.guides;
        }
        this.mat = [1, 0, 0, 1, dx, dy];
        // A block carried near a surface (ground, table, a slope, another block) is drawn seated on it:
        // turned to lie along it and resting on it. Letting go keeps it there (Alt: no magnet).
        this.seatOn = null;
        const blk = p.alt ? null : this.loneBlock();
        const info = blk && blockInfo(blk);
        if (info) {
          m.segs ??= surfaces(store.page.els, store.selection);
          const hit = nearest(m.segs, info.cx + dx, info.cy + dy, 110);
          if (hit) {
            const moved: Mat = [1, 0, 0, 1, dx, dy];
            const s2 = seat({ ...info, cx: info.cx + dx, cy: info.cy + dy }, hit.s, hit.t);
            this.mat = [s2[0] * moved[0] + s2[2] * moved[1], s2[1] * moved[0] + s2[3] * moved[1], s2[0] * moved[2] + s2[2] * moved[3], s2[1] * moved[2] + s2[3] * moved[3], s2[0] * moved[4] + s2[2] * moved[5] + s2[4], s2[1] * moved[4] + s2[3] * moved[5] + s2[5]];
            this.seatOn = hit.s;
            this.guides = [];
          }
        }
        // The Pages panel is open: show where the things would land.
        if (dropAvailable()) {
          const b = this.board.el.getBoundingClientRect();
          dragOver(p.sx + b.left, p.sy + b.top, store.selection.size);
        }
        break;
      }
      case 'end': {
        // Only this end moves: the line gets longer or shorter or turns, nothing else changes.
        const [a, b] = this.lineEnds(m.line);
        const fixed = m.idx === 0 ? b : a, old = m.idx === 0 ? a : b;
        let x = p.x, y = p.y;
        if (!p.alt) {
          // A light pull to straight up-down, sideways and 45°.
          const ang = Math.atan2(y - fixed[1], x - fixed[0]), step = Math.PI / 4;
          const snap = Math.round(ang / step) * step;
          if (Math.abs(ang - snap) < 0.05) {
            const len = Math.hypot(x - fixed[0], y - fixed[1]);
            x = fixed[0] + Math.cos(snap) * len;
            y = fixed[1] + Math.sin(snap) * len;
          }
        }
        const from = m.idx === 0 ? [x, y] : fixed, to = m.idx === 0 ? fixed : [x, y];
        const l = m.line;
        const pts = l.spring ? springPts(from[0], from[1], to[0], to[1], l.spring.coils, l.spring.amp, l.spring.lead) : pathFromPoints([[from[0], from[1]], [to[0], to[1]]], false);
        // Labels keep their place next to the middle of the line.
        const dmx = (x - old[0]) / 2, dmy = (y - old[1]) / 2;
        m.preview = [{ ...l, pts }, ...m.labels.map((e) => translateEl(e, dmx, dmy))];
        break;
      }
      case 'resize': {
        const { r, hx, hy } = m;
        const min = 6 * this.board.px;
        // The opposite side stays put.
        const ax = hx > 0 ? r.x : r.x + r.w, ay = hy > 0 ? r.y : r.y + r.h;
        let sx = hx ? Math.max(min, (p.x - ax) * hx) / r.w : 1;
        let sy = hy ? Math.max(min, (p.y - ay) * hy) / r.h : 1;
        if (m.keep) sx = sy = Math.max(hx ? sx : 0, hy ? sy : 0);
        this.mat = [sx, 0, 0, sy, ax - ax * sx, ay - ay * sy];
        this.resizeArgs = [ax, ay, sx, sy];
        break;
      }
      case 'rotate': {
        let a = Math.atan2(p.y - m.cy, p.x - m.cx) - m.a0;
        const step = Math.PI / 12;
        if (!p.alt && Math.abs(a - Math.round(a / step) * step) < 0.06) a = Math.round(a / step) * step;
        this.mat = similarity(m.cx, m.cy, 1, a, 0, 0);
        break;
      }
      case 'lasso':
        for (const [x, y] of p.samples) m.pts.push(x, y);
        break;
      case 'bend': {
        const q = m.el.pts, n = q.length;
        m.preview = { ...m.el, pts: pathFromPoints(arcThrough(q[0], q[1], q[n - 3], q[n - 2], p.x, p.y), false) };
        break;
      }
    }
    if (m.k === 'lasso') return this.board.invalidate('overlay');
    if (m.k === 'move' || m.k === 'resize' || m.k === 'rotate') {
      // Redraw only where the selection was and is now (not the whole page).
      const now = this.movedRect();
      if (now) {
        const was = this.inkRect ?? this.movedRect(IDENTITY);
        this.inkRect = now;
        if (was) {
          this.board.markInk({ x: Math.min(was.x, now.x), y: Math.min(was.y, now.y), w: Math.max(was.x + was.w, now.x + now.w) - Math.min(was.x, now.x), h: Math.max(was.y + was.h, now.y + now.h) - Math.min(was.y, now.y) });
          return this.board.invalidate('overlay');
        }
      }
    }
    this.board.invalidate('ink', 'overlay');
  }

  /** Where the dragged selection is drawn right now (with room for line widths). */
  private inkRect: Rect | null = null;
  private movedRect(mat: Mat = this.mat): Rect | null {
    const r = this.bounds();
    if (!r) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const [x, y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) {
      const [tx, ty] = applyMat(mat, x, y);
      x1 = Math.min(x1, tx);
      y1 = Math.min(y1, ty);
      x2 = Math.max(x2, tx);
      y2 = Math.max(y2, ty);
    }
    let size = 0;
    for (const e of store.selectedEls()) if (e.type === 'path') size = Math.max(size, e.size);
    const pad = size + 6 * this.board.px;
    return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 };
  }

  up(p: Ptr): void {
    const m = this.mode;
    if (!m || p.id !== this.pid) return;
    this.mode = null;
    this.inkRect = null;
    // Dropped on a page of the Pages panel: the things go there (one undo step).
    const bb = this.board.el.getBoundingClientRect();
    const dropped = m.k === 'move' && m.moved ? dragEnd(p.sx + bb.left, p.sy + bb.top) : (dragCancel(), -1);
    if (dropped >= 0 && dropped !== store.index) {
      const n = store.moveElsToPage([...store.selection], dropped);
      this.mat = IDENTITY;
      this.guides = [];
      this.board.invalidate('ink', 'overlay');
      if (n) toast(`Moved ${n} ${n === 1 ? 'item' : 'items'} to page ${dropped + 1}. Undo brings them back.`);
      return;
    }
    if (m.k === 'end') {
      const pv = m.preview;
      if (pv) {
        const by = new Map(pv.map((e) => [e.id, e]));
        store.mapEls(new Set(by.keys()), (e) => by.get(e.id) ?? e);
      }
    } else if (m.k === 'bend') {
      const pv = m.preview;
      if (pv) store.mapEls(new Set([m.el.id]), () => pv);
    } else if (m.k === 'lasso') {
      if (m.pts.length > 6) {
        const ids = store.page.els.filter((e) => !e.locked && insideLasso(e, m.pts)).map((e) => e.id);
        store.select(m.add ? [...store.selection, ...ids] : ids);
      }
    } else if (m.k === 'move' && !m.moved) {
      const el = m.clicked;
      if (el) {
        const now = performance.now();
        const dbl = this.lastTap.id === el.id && now - this.lastTap.t < 400;
        this.lastTap = { t: now, id: el.id };
        if (el.type === 'tape') {
          toggleTape(el);
          store.clearSelection();
        } else if (dbl && el.type === 'text') {
          store.clearSelection();
          this.editor.open(el as TextEl, false);
        } else if (dbl && el.type === 'table' && !el.rot && this.tableEditor) {
          const cell = cellAt(el, p.x, p.y);
          if (cell) this.tableEditor.open(el, cell[0], cell[1]);
        }
      }
    } else if (m.k === 'resize' && this.resizeArgs) {
      const [ax, ay, sx, sy] = this.resizeArgs;
      store.mapEls(store.selection, (e) => resizeEl(e, ax, ay, sx, sy));
    } else if (this.mat !== IDENTITY) {
      const mat = this.mat;
      store.mapEls(store.selection, (e) => transformEl(e, mat));
    }
    this.mat = IDENTITY;
    this.resizeArgs = null;
    this.guides = [];
    this.seatOn = null;
    this.board.invalidate('ink', 'overlay');
  }

  cancel(): void {
    dragCancel();
    this.seatOn = null;
    this.mode = null;
    this.inkRect = null;
    this.mat = IDENTITY;
    this.resizeArgs = null;
    this.guides = [];
    this.board.invalidate('ink', 'overlay');
  }

  hidden(): Set<string> | null {
    if ((this.mode?.k === 'bend' || this.mode?.k === 'end') && this.mode.preview) return store.selection;
    return this.mat !== IDENTITY ? store.selection : null;
  }

  drawInk(ctx: CanvasRenderingContext2D): void {
    if (this.mode?.k === 'end' && this.mode.preview) return void this.mode.preview.forEach((e) => drawEl(ctx, e));
    if (this.mode?.k === 'bend' && this.mode.preview) return drawEl(ctx, this.mode.preview);
    if (this.mat === IDENTITY) return;
    if (this.resizeArgs) {
      const [ax, ay, sx, sy] = this.resizeArgs;
      for (const el of store.selectedEls()) drawEl(ctx, resizeEl(el, ax, ay, sx, sy));
      return;
    }
    ctx.save();
    ctx.transform(...this.mat);
    for (const el of store.selectedEls()) drawEl(ctx, el);
    ctx.restore();
  }

  hover(p: Ptr | null): void {
    if (store.tool.tool !== 'select' && !(store.tool.tool === 'shape' && store.selection.size)) return;
    if (!p) return;
    const r = this.bounds();
    let cursor = 'default';
    if (r) {
      const h = this.handles(r);
      const g = this.gripAt(p, r);
      const sl = this.selectedLine();
      if (sl && this.lineEnds(sl.line).some(([x, y]) => Math.hypot(p.x - x, p.y - y) < this.hitRadius(p) * 1.15)) cursor = 'crosshair';
      else if (this.hitsArcHandle(p)) cursor = 'pointer';
      else if (Math.hypot(p.x - h.rot[0], p.y - h.rot[1]) < this.hitRadius(p)) cursor = 'grab';
      else if (g) cursor = !g.hx ? 'ns-resize' : !g.hy ? 'ew-resize' : g.hx === g.hy ? 'nwse-resize' : 'nesw-resize';
      else if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) cursor = 'move';
    }
    if (cursor === 'default' && this.topHit(p.x, p.y)) cursor = 'move';
    this.board.overlay.style.cursor = cursor;
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (store.tool.tool !== 'select' && store.tool.tool !== 'shape') return;
    // Monochrome (Physica style): white on dark boards, near-black on light ones.
    const ink = isDarkColor(store.page.bg) ? '#ffffff' : '#111111';
    const inkSoft = isDarkColor(store.page.bg) ? 'rgba(255,255,255,0.45)' : 'rgba(17,17,17,0.45)';
    const inkFill = isDarkColor(store.page.bg) ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)';
    const px = this.board.px;
    // Handles are sized for fingers on big panels too.
    const hp = px * ui();
    const m = this.mode;
    if (m?.k === 'lasso' && m.pts.length > 2) {
      ctx.beginPath();
      ctx.moveTo(m.pts[0], m.pts[1]);
      for (let i = 2; i < m.pts.length; i += 2) ctx.lineTo(m.pts[i], m.pts[i + 1]);
      ctx.closePath();
      ctx.fillStyle = inkFill;
      ctx.fill();
      ctx.setLineDash([6 * px, 5 * px]);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5 * px;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (this.seatOn) {
      // The surface the block is seating on.
      const t = this.seatOn;
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 5 * px;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(t.ax, t.ay);
      ctx.lineTo(t.ax + t.ux * t.len, t.ay + t.uy * t.len);
      ctx.stroke();
      ctx.restore();
    }
    drawGuides(ctx, this.guides, px);
    const r = this.bounds();
    if (!r) return;
    const mat = this.mat;
    // Outline of each selected element (subtle).
    ctx.strokeStyle = inkSoft;
    ctx.lineWidth = 1 * px;
    const sel = store.selectedEls();
    // One group (a graph): just the outer frame, no box around every piece.
    const oneGroup = sel.length > 1 && !!sel[0].group && sel.every((e) => e.group === sel[0].group);
    if (store.selection.size > 1 && !oneGroup) {
      for (const el of sel) {
        const b = bbox(el);
        this.polyRect(ctx, b, mat);
        ctx.stroke();
      }
    }
    const pad = 6 * px;
    const R = { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5 * px;
    ctx.setLineDash([5 * px, 4 * px]);
    this.polyRect(ctx, R, mat);
    ctx.stroke();
    ctx.setLineDash([]);
    const h = this.handles(r);
    const full = mat;
    const [tx, ty] = applyMat(full, r.x + r.w / 2, r.y);
    // While resizing the knob follows the top edge; otherwise it moves/rotates with the selection.
    const [rx, ry2] = this.resizeArgs ? [tx, ty - 40 * hp] : applyMat(full, h.rot[0], h.rot[1]);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(rx, ry2);
    ctx.stroke();
    const handle = (x: number, y: number, round: boolean) => {
      ctx.beginPath();
      if (round) ctx.arc(x, y, HANDLE * hp, 0, Math.PI * 2);
      else ctx.rect(x - HANDLE * 0.8 * hp, y - HANDLE * 0.8 * hp, HANDLE * 1.6 * hp, HANDLE * 1.6 * hp);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 2 * px;
      ctx.strokeStyle = ink;
      ctx.stroke();
    };
    for (const g of h.grips) {
      const [x, y] = applyMat(full, g.x, g.y);
      if (g.hx && g.hy) handle(x, y, false);
      else {
        // Edge grip: a pill along the side.
        const w = (g.hx ? 7 : 22) * hp, hh = (g.hx ? 22 : 7) * hp;
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - hh / 2, w, hh, 4 * hp);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 2 * px;
        ctx.strokeStyle = ink;
        ctx.stroke();
      }
    }
    handle(rx, ry2, true);
    // A straight line, arrow or spring: a round handle on each end (drag to lengthen, shorten or turn it).
    const sl = this.selectedLine();
    if (sl && mat === IDENTITY) {
      const live = this.mode?.k === 'end' && this.mode.preview ? (this.mode.preview[0] as PathEl) : sl.line;
      for (const [x, y] of this.lineEnds(live)) {
        ctx.beginPath();
        ctx.arc(x, y, HANDLE * 1.1 * hp, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.lineWidth = 2.5 * px;
        ctx.strokeStyle = isDarkColor(store.page.bg) ? '#000' : '#fff';
        ctx.stroke();
      }
    }
    // Arc: a coloured bend handle at its middle.
    const arc = this.selectedArc();
    if (arc && mat === IDENTITY) {
      const m2 = this.mode;
      const [ax, ay] = m2?.k === 'bend' && m2.preview ? this.arcHandle(m2.preview) : this.arcHandle(arc);
      ctx.beginPath();
      ctx.arc(ax, ay, HANDLE * 1.15 * hp, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();
      ctx.lineWidth = 2.5 * px;
      ctx.strokeStyle = isDarkColor(store.page.bg) ? '#000' : '#fff';
      ctx.stroke();
    }
    ctx.fillStyle = ink;
    ctx.font = `700 ${12 * hp}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⟳', rx, ry2 + 0.5 * hp);
    ctx.textAlign = 'left';
  }

  private polyRect(ctx: CanvasRenderingContext2D, r: Rect, m: Mat): void {
    const pts = [
      applyMat(m, r.x, r.y),
      applyMat(m, r.x + r.w, r.y),
      applyMat(m, r.x + r.w, r.y + r.h),
      applyMat(m, r.x, r.y + r.h),
    ];
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (const q of pts.slice(1)) ctx.lineTo(...q);
    ctx.closePath();
  }
}
