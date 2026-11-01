import type { Board, Ptr } from './board';
import { distToSegment, pointInPolygon } from './geometry';

// Geometry instruments that float on the board: ruler, set squares and a
// protractor. Pens snap to their edges so teachers can draw perfect lines,
// angles and arcs — like real instruments on a chalkboard.

export type InstrumentKind = 'ruler' | 'setsquare' | 'setsquare45' | 'protractor';

interface Instrument {
  kind: InstrumentKind;
  x: number;
  y: number;
  rot: number;
  /** Protractor needle angle (radians, 0..π). */
  needle: number;
}

export interface Snapper {
  project(x: number, y: number): [number, number];
}

const CM = 40; // world units per centimetre
const RULER_L = CM * 30;
const RULER_W = 100;
const SQ = CM * 12;
const PROT_R = 300;
const KNOB = 22;

type Drag = { inst: Instrument; mode: 'move' | 'rotate' | 'needle'; ox: number; oy: number; startRot: number; startAng: number; cx: number; cy: number };

export class Instruments {
  list: Instrument[] = [];
  private drag: Drag | null = null;
  private hoverInst: Instrument | null = null;

  constructor(private board: Board) {}

  toggle(kind: InstrumentKind): void {
    const i = this.list.findIndex((x) => x.kind === kind);
    if (i >= 0) this.list.splice(i, 1);
    else {
      const v = this.board.viewRect();
      const z = this.board.cam.z;
      const w = kind === 'ruler' ? RULER_L : kind === 'protractor' ? PROT_R * 2 : SQ;
      this.list.push({ kind, x: v.x + v.w / 2 - w / 2, y: v.y + v.h / 2 + (kind === 'protractor' ? 100 / z : -50 / z), rot: 0, needle: Math.PI / 3 });
    }
    this.board.invalidate('overlay');
  }

  has(kind: InstrumentKind): boolean {
    return this.list.some((x) => x.kind === kind);
  }

  private local(inst: Instrument, x: number, y: number): [number, number] {
    const c = Math.cos(-inst.rot), s = Math.sin(-inst.rot);
    const dx = x - inst.x, dy = y - inst.y;
    return [dx * c - dy * s, dx * s + dy * c];
  }

  private world(inst: Instrument, lx: number, ly: number): [number, number] {
    const c = Math.cos(inst.rot), s = Math.sin(inst.rot);
    return [inst.x + lx * c - ly * s, inst.y + lx * s + ly * c];
  }

  /** Local-space polygon of the instrument body. */
  private body(inst: Instrument): number[] {
    switch (inst.kind) {
      case 'ruler':
        return [0, 0, RULER_L, 0, RULER_L, RULER_W, 0, RULER_W];
      case 'setsquare':
        return [0, 0, SQ * Math.sqrt(3), 0, 0, -SQ];
      case 'setsquare45':
        return [0, 0, SQ, 0, 0, -SQ];
      case 'protractor': {
        const pts: number[] = [];
        for (let i = 0; i <= 60; i++) {
          const a = Math.PI + (i / 60) * Math.PI;
          pts.push(PROT_R + Math.cos(a) * PROT_R, Math.sin(a) * PROT_R);
        }
        return pts;
      }
    }
  }

  /** Straight snapping edges as local segments. */
  private edges(inst: Instrument): [number, number, number, number][] {
    const b = this.body(inst);
    if (inst.kind === 'protractor') return [[0, 0, PROT_R * 2, 0]];
    if (inst.kind === 'ruler') return [[0, 0, RULER_L, 0], [0, RULER_W, RULER_L, RULER_W]];
    const out: [number, number, number, number][] = [];
    for (let i = 0; i < b.length; i += 2) out.push([b[i], b[i + 1], b[(i + 2) % b.length], b[(i + 3) % b.length]]);
    return out;
  }

  private knobs(inst: Instrument): { rotate: [number, number]; close: [number, number] } {
    switch (inst.kind) {
      case 'ruler':
        return { rotate: [RULER_L - 50, RULER_W / 2 + 12], close: [RULER_L - 50 - KNOB * 2.6, RULER_W / 2 + 12] };
      case 'setsquare':
        return { rotate: [SQ * 0.45, -SQ * 0.22], close: [SQ * 0.18, -SQ * 0.22] };
      case 'setsquare45':
        return { rotate: [SQ * 0.38, -SQ * 0.2], close: [SQ * 0.14, -SQ * 0.2] };
      case 'protractor':
        return { rotate: [PROT_R + 70, -60], close: [PROT_R - 70, -60] };
    }
  }

  private needleTip(inst: Instrument): [number, number] {
    const a = inst.needle;
    return [PROT_R + Math.cos(a) * (PROT_R + 40), -Math.sin(a) * (PROT_R + 40)];
  }

  private hit(p: Ptr): { inst: Instrument; part: 'body' | 'rotate' | 'close' | 'needle' } | null {
    const px = this.board.px;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const inst = this.list[i];
      const [lx, ly] = this.local(inst, p.x, p.y);
      const k = this.knobs(inst);
      const r = KNOB * Math.max(1, px);
      if (Math.hypot(lx - k.rotate[0], ly - k.rotate[1]) < r * 1.3) return { inst, part: 'rotate' };
      if (Math.hypot(lx - k.close[0], ly - k.close[1]) < r * 1.3) return { inst, part: 'close' };
      if (inst.kind === 'protractor') {
        const [nx, ny] = this.needleTip(inst);
        if (Math.hypot(lx - nx, ly - ny) < r * 1.5) return { inst, part: 'needle' };
      }
      if (pointInPolygon(lx, ly, this.body(inst))) {
        // Leave a band along snapping edges free for drawing.
        const band = 26 * px;
        const nearEdge = this.edges(inst).some(([ax, ay, bx, by]) => distToSegment(lx, ly, ax, ay, bx, by) < band);
        const nearArc = inst.kind === 'protractor' && Math.abs(Math.hypot(lx - PROT_R, ly) - PROT_R) < band;
        if (!nearEdge && !nearArc) return { inst, part: 'body' };
      }
    }
    return null;
  }

  down(p: Ptr): boolean {
    const h = this.hit(p);
    if (!h) return false;
    if (h.part === 'close') {
      this.list.splice(this.list.indexOf(h.inst), 1);
      this.board.invalidate('overlay');
      return true;
    }
    // Bring to front
    this.list.splice(this.list.indexOf(h.inst), 1);
    this.list.push(h.inst);
    const inst = h.inst;
    const [cx, cy] = this.world(inst, ...this.pivot(inst));
    this.drag = {
      inst,
      mode: h.part === 'body' ? 'move' : h.part === 'rotate' ? 'rotate' : 'needle',
      ox: p.x - inst.x,
      oy: p.y - inst.y,
      startRot: inst.rot,
      startAng: Math.atan2(p.y - cy, p.x - cx),
      cx,
      cy,
    };
    return true;
  }

  private pivot(inst: Instrument): [number, number] {
    switch (inst.kind) {
      case 'ruler':
        return [RULER_L / 2, RULER_W / 2];
      case 'protractor':
        return [PROT_R, 0];
      case 'setsquare':
        return [(SQ * Math.sqrt(3)) / 3, -SQ / 3];
      case 'setsquare45':
        return [SQ / 3, -SQ / 3];
    }
  }

  move(p: Ptr): void {
    const d = this.drag;
    if (!d) return;
    const inst = d.inst;
    if (d.mode === 'move') {
      inst.x = p.x - d.ox;
      inst.y = p.y - d.oy;
    } else if (d.mode === 'rotate') {
      let rot = d.startRot + Math.atan2(p.y - d.cy, p.x - d.cx) - d.startAng;
      // Snap to 15° increments when close.
      const step = Math.PI / 12;
      const snapped = Math.round(rot / step) * step;
      if (Math.abs(rot - snapped) < 0.03) rot = snapped;
      const [px0, py0] = this.pivot(inst);
      const c = Math.cos(rot), s = Math.sin(rot);
      inst.x = d.cx - (px0 * c - py0 * s);
      inst.y = d.cy - (px0 * s + py0 * c);
      inst.rot = rot;
    } else {
      const [lx, ly] = this.local(inst, p.x, p.y);
      let a = Math.atan2(-ly, lx - PROT_R);
      if (a < 0) a = a < -Math.PI / 2 ? Math.PI : 0;
      inst.needle = Math.round((a * 180) / Math.PI) * (Math.PI / 180);
    }
    this.board.invalidate('overlay');
  }

  up(_p: Ptr): void {
    this.drag = null;
  }

  hover(p: Ptr): void {
    const h = this.hit(p);
    const inst = h?.inst ?? null;
    if (inst !== this.hoverInst) {
      this.hoverInst = inst;
      this.board.overlay.style.cursor = h ? (h.part === 'body' ? 'move' : 'pointer') : this.board.tool.cursor ?? 'crosshair';
    }
  }

  /** If (x,y) starts near an instrument edge, return a snapper for drawing. */
  snapAt(x: number, y: number): Snapper | null {
    const tol = 28 * this.board.px;
    let best: { d: number; s: Snapper } | null = null;
    for (const inst of this.list) {
      const [lx, ly] = this.local(inst, x, y);
      for (const [ax, ay, bx, by] of this.edges(inst)) {
        const d = distToSegment(lx, ly, ax, ay, bx, by);
        if (d < tol && (!best || d < best.d)) {
          const [wax, way] = this.world(inst, ax, ay);
          const [wbx, wby] = this.world(inst, bx, by);
          const dx = wbx - wax, dy = wby - way;
          const len2 = dx * dx + dy * dy;
          best = {
            d,
            s: {
              project: (px, py) => {
                const t = ((px - wax) * dx + (py - way) * dy) / len2;
                return [wax + t * dx, way + t * dy];
              },
            },
          };
        }
      }
      if (inst.kind === 'protractor') {
        const d = Math.abs(Math.hypot(lx - PROT_R, ly) - PROT_R);
        if (d < tol && ly <= 4 && (!best || d < best.d)) {
          const [cx, cy] = this.world(inst, PROT_R, 0);
          best = {
            d,
            s: {
              project: (px, py) => {
                const a = Math.atan2(py - cy, px - cx);
                return [cx + Math.cos(a) * PROT_R, cy + Math.sin(a) * PROT_R];
              },
            },
          };
        }
      }
    }
    return best?.s ?? null;
  }

  draw(ctx: CanvasRenderingContext2D): boolean {
    const px = this.board.px;
    for (const inst of this.list) {
      ctx.save();
      ctx.translate(inst.x, inst.y);
      ctx.rotate(inst.rot);
      const body = this.body(inst);
      ctx.beginPath();
      ctx.moveTo(body[0], body[1]);
      for (let i = 2; i < body.length; i += 2) ctx.lineTo(body[i], body[i + 1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(186, 230, 253, 0.42)';
      ctx.shadowColor = 'rgba(15,23,42,0.25)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.85)';
      ctx.lineWidth = 1.5 * px;
      ctx.stroke();
      if (inst.kind === 'setsquare' || inst.kind === 'setsquare45') {
        // Cut-out
        ctx.beginPath();
        const k = 0.45;
        const cx = inst.kind === 'setsquare' ? (SQ * Math.sqrt(3)) / 3 : SQ / 3;
        ctx.moveTo(body[0] * k + cx * (1 - k), body[1] * k + (-SQ / 3) * (1 - k));
        for (let i = 2; i < body.length; i += 2) ctx.lineTo(body[i] * k + cx * (1 - k), body[i + 1] * k + (-SQ / 3) * (1 - k));
        ctx.closePath();
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.5)';
        ctx.stroke();
      }
      ctx.fillStyle = '#0c4a6e';
      ctx.strokeStyle = '#0c4a6e';
      ctx.lineWidth = 1 * px;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      if (inst.kind === 'ruler') this.drawRulerTicks(ctx, inst);
      else if (inst.kind === 'protractor') this.drawProtractor(ctx, inst);
      else this.drawSquareTicks(ctx, body);
      // Knobs
      const k = this.knobs(inst);
      this.knob(ctx, k.rotate[0], k.rotate[1], '⟳', inst.rot);
      this.knob(ctx, k.close[0], k.close[1], '×');
      ctx.restore();
    }
    return false;
  }

  private knob(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, rot?: number): void {
    const px = this.board.px;
    const r = KNOB * Math.max(1, px);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(2,132,199,0.9)';
    ctx.lineWidth = 2 * px;
    ctx.stroke();
    ctx.fillStyle = '#0369a1';
    ctx.font = `700 ${r * 1.1}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 1 * px);
    if (rot !== undefined) {
      let deg = Math.round(((-rot * 180) / Math.PI) % 360);
      if (deg < 0) deg += 360;
      ctx.font = `600 ${13 * Math.max(1, px)}px system-ui, sans-serif`;
      ctx.fillText(`${deg}°`, x, y + r * 1.8);
    }
  }

  private drawRulerTicks(ctx: CanvasRenderingContext2D, _inst: Instrument): void {
    const px = this.board.px;
    const mm = CM / 10;
    ctx.beginPath();
    for (let i = 0; i <= RULER_L / mm; i++) {
      const x = i * mm;
      const len = i % 10 === 0 ? 26 : i % 5 === 0 ? 17 : 10;
      if (i % 10 !== 0 && mm / px < 3) continue;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, len);
      ctx.moveTo(x, RULER_W);
      ctx.lineTo(x, RULER_W - (i % 10 === 0 ? 14 : i % 5 === 0 ? 9 : 5));
    }
    ctx.stroke();
    ctx.font = `600 ${15}px system-ui, sans-serif`;
    for (let c = 0; c <= RULER_L / CM; c++) ctx.fillText(String(c), c * CM, 30);
    ctx.font = `500 ${12}px system-ui, sans-serif`;
    ctx.fillText('cm', RULER_L / 2, RULER_W / 2 + 6);
  }

  private drawSquareTicks(ctx: CanvasRenderingContext2D, body: number[]): void {
    // Ticks along the base edge.
    const len = body[2];
    const mm = CM / 10;
    ctx.beginPath();
    for (let i = 0; i <= len / mm - 2; i++) {
      const l = i % 10 === 0 ? -16 : i % 5 === 0 ? -10 : -6;
      ctx.moveTo(i * mm, 0);
      ctx.lineTo(i * mm, l);
    }
    for (let i = 0; i <= SQ / mm - 2; i++) {
      const l = i % 10 === 0 ? 16 : i % 5 === 0 ? 10 : 6;
      ctx.moveTo(0, -i * mm);
      ctx.lineTo(l, -i * mm);
    }
    ctx.stroke();
    ctx.font = `600 13px system-ui, sans-serif`;
    ctx.textBaseline = 'bottom';
    for (let c = 1; c <= len / CM - 1; c++) ctx.fillText(String(c), c * CM, -18);
  }

  private drawProtractor(ctx: CanvasRenderingContext2D, inst: Instrument): void {
    const px = this.board.px;
    const cx = PROT_R;
    ctx.beginPath();
    for (let d = 0; d <= 180; d++) {
      const a = (d * Math.PI) / 180;
      const len = d % 10 === 0 ? 26 : d % 5 === 0 ? 17 : 9;
      if (d % 5 !== 0 && (PROT_R * Math.PI) / 180 / px < 2.5) continue;
      const c = Math.cos(a), s = -Math.sin(a);
      ctx.moveTo(cx + c * PROT_R, s * PROT_R);
      ctx.lineTo(cx + c * (PROT_R - len), s * (PROT_R - len));
    }
    ctx.moveTo(cx - 10, 0);
    ctx.lineTo(cx + 10, 0);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, -10);
    ctx.stroke();
    ctx.textBaseline = 'middle';
    for (let d = 0; d <= 180; d += 10) {
      const a = (d * Math.PI) / 180;
      const c = Math.cos(a), s = -Math.sin(a);
      ctx.font = `600 13px system-ui, sans-serif`;
      ctx.fillStyle = '#0c4a6e';
      ctx.fillText(String(d), cx + c * (PROT_R - 40), s * (PROT_R - 40));
      ctx.font = `500 11px system-ui, sans-serif`;
      ctx.fillStyle = '#b91c1c';
      ctx.fillText(String(180 - d), cx + c * (PROT_R - 60), s * (PROT_R - 60));
    }
    // Needle
    const [nx, ny] = this.needleTip(inst);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2 * px;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(nx, ny, KNOB * 0.7 * Math.max(1, px), 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();
    const deg = Math.round((inst.needle * 180) / Math.PI);
    ctx.font = `700 22px system-ui, sans-serif`;
    ctx.fillStyle = '#dc2626';
    ctx.fillText(`${deg}°`, cx, -PROT_R * 0.42);
  }
}
