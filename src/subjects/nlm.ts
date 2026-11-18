import { pathFromPoints, uid } from '../geometry';
import { measureText } from '../renderer';
import type { El, PathEl, TextEl } from '../types';

// Physics, Class 11, Laws of Motion: ready-made pieces for the board.
// Every piece is drawn around (0, 0) in page units from ordinary lines, shapes and text, so after it is
// placed it can be moved, stretched, recoloured, flipped or ungrouped and edited like anything else
// the teacher drew. Labels (m, T, mg ...) are normal text: double-tap to change them.

export interface Comp {
  id: string;
  cat: string;
  name: string;
  /** Build the pieces. `ink` is the colour that is readable on the board (white on dark, dark on light). */
  make: (ink: string) => El[];
}

type P = [number, number];
interface O {
  color?: string;
  size?: number;
  fill?: string | null;
  dash?: boolean;
  arrow?: 0 | 1 | 2;
}

// Force colours (the same everywhere, so students learn them).
const RED = '#ef4444';
const GREEN = '#22c55e';
const BLUE = '#3b82f6';
const ORANGE = '#f59e0b';
const PURPLE = '#a855f7';
const PINK = '#ec4899';
const TEAL = '#14b8a6';
const BLOCK1 = '#60a5fa';
const BLOCK2 = '#fb923c';
const BLOCK3 = '#a3e635';
const GREY = '#94a3b8';
const BROWN = '#a16207';
const FACE = '#fde68a';
const INKDARK = '#0f172a';

const path = (pts: P[], closed: boolean, o: O, ink: string): PathEl => ({
  id: uid(),
  type: 'path',
  style: 'shape',
  pts: pathFromPoints(pts, closed),
  color: o.color ?? ink,
  size: o.size ?? 4,
  opacity: 1,
  closed,
  fill: closed ? (o.fill ?? null) : null,
  ...(o.dash ? { dash: true } : {}),
  ...(o.arrow ? { arrow: o.arrow } : {}),
});

const line = (x1: number, y1: number, x2: number, y2: number, o: O, ink: string): PathEl => path([[x1, y1], [x2, y2]], false, o, ink);
const poly = (pts: P[], o: O, ink: string, closed = true): PathEl => path(pts, closed, o, ink);
const rect = (x: number, y: number, w: number, h: number, o: O, ink: string): PathEl => path([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, o, ink);
const circle = (cx: number, cy: number, r: number, o: O, ink: string): PathEl => {
  const pts: P[] = [];
  for (let i = 0; i < 40; i++) pts.push([cx + Math.cos((i / 40) * Math.PI * 2) * r, cy + Math.sin((i / 40) * Math.PI * 2) * r]);
  return path(pts, true, o, ink);
};
const ellipse = (cx: number, cy: number, rx: number, ry: number, o: O, ink: string): PathEl => {
  const pts: P[] = [];
  for (let i = 0; i < 40; i++) pts.push([cx + Math.cos((i / 40) * Math.PI * 2) * rx, cy + Math.sin((i / 40) * Math.PI * 2) * ry]);
  return path(pts, true, o, ink);
};
const dot = (cx: number, cy: number, r: number, color: string, ink: string): PathEl => circle(cx, cy, r, { color, fill: color, size: 2 }, ink);

/** Text centred on (cx, cy). */
const text = (s: string, cx: number, cy: number, color: string, size = 34, bold = true): TextEl => {
  const m = measureText(s, size, bold, 1400, false);
  return { id: uid(), type: 'text', text: s, color, fontSize: size, bold, x: cx - m.w / 2, y: cy - m.h / 2, w: m.w, h: m.h, rot: 0 };
};

/** A zig-zag spring from (x1,y1) to (x2,y2): straight ends, `coils` bends of height `amp`. */
const spring = (x1: number, y1: number, x2: number, y2: number, coils: number, amp: number, o: O, ink: string): PathEl => {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const lead = Math.min(26, len * 0.12);
  const pts: P[] = [[x1, y1], [x1 + ux * lead, y1 + uy * lead]];
  const body = len - 2 * lead, n = coils * 2;
  for (let i = 1; i <= n; i++) {
    const t = lead + (body * (i - 0.5)) / n;
    const s = i % 2 ? 1 : -1;
    pts.push([x1 + ux * t + nx * amp * s, y1 + uy * t + ny * amp * s]);
  }
  pts.push([x2 - ux * lead, y2 - uy * lead], [x2, y2]);
  return path(pts, false, { size: 3, ...o }, ink);
};

/** A hatched support line (ground, wall, ceiling): the line plus short slanted ticks on the far side. */
const support = (x1: number, y1: number, x2: number, y2: number, side: 1 | -1, ink: string): PathEl[] => {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy * side, ny = ux * side;
  const out: PathEl[] = [line(x1, y1, x2, y2, { size: 5 }, ink)];
  const gap = 22;
  for (let t = 4; t <= len; t += gap) out.push(line(x1 + ux * t, y1 + uy * t, x1 + ux * (t - 14) + nx * 16, y1 + uy * (t - 14) + ny * 16, { size: 2.5 }, ink));
  return out;
};

/** An arrow with its label. `lx, ly`: how far the label sits from the middle of the arrow. */
const vec = (x1: number, y1: number, x2: number, y2: number, color: string, label: string, lx: number, ly: number, ink: string, dash = false): El[] => {
  const els: El[] = [line(x1, y1, x2, y2, { color, size: 6, arrow: 1, dash }, ink)];
  if (label) els.push(text(label, (x1 + x2) / 2 + lx, (y1 + y2) / 2 + ly, color, 36));
  return els;
};

/** A block (rectangle) with its mass written inside. */
const block = (cx: number, cy: number, w: number, h: number, label: string, fill: string, ink: string): El[] => [rect(cx - w / 2, cy - h / 2, w, h, { fill, color: ink, size: 4 }, ink), text(label, cx, cy, INKDARK, Math.min(40, h * 0.45))];

/** A block lying on a slope of angle `th` (radians). The slope's lower-left end is (bx, by), the slope rises to the right. */
const onSlope = (bx: number, by: number, th: number, t: number, w: number, h: number, label: string, fill: string, ink: string): El[] => {
  const ux = Math.cos(th), uy = -Math.sin(th), nx = uy, ny = -ux; // along the slope, away from it
  const cx = bx + ux * t + nx * (h / 2), cy = by + uy * t + ny * (h / 2);
  const c = (a: number, b: number): P => [cx + ux * a + nx * b, cy + uy * a + ny * b];
  return [poly([c(-w / 2, -h / 2), c(w / 2, -h / 2), c(w / 2, h / 2), c(-w / 2, h / 2)], { fill, size: 4 }, ink), text(label, cx, cy, INKDARK, 34)];
};

const pulley = (cx: number, cy: number, r: number, ink: string): El[] => [circle(cx, cy, r, { fill: '#e2e8f0', size: 4 }, ink), dot(cx, cy, 5, ink, ink)];

/** A wedge with a right angle at the bottom right; the slope rises to the right from the lower left (angle `deg`). */
const wedgePts = (deg: number, hyp = 360): { pts: P[]; w: number; h: number } => {
  const th = (deg * Math.PI) / 180;
  const w = hyp * Math.cos(th), h = hyp * Math.sin(th);
  return { pts: [[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2]], w, h };
};

const wedge = (deg: number, ink: string, withBlock: boolean, label = 'm'): El[] => {
  const { pts, w, h } = wedgePts(deg);
  const th = (deg * Math.PI) / 180;
  const [bx, by] = pts[0];
  const els: El[] = [poly(pts, { fill: GREY, size: 5 }, ink)];
  // angle arc and label
  const arc: P[] = [];
  for (let i = 0; i <= 12; i++) arc.push([bx + Math.cos((-th * i) / 12) * 70, by + Math.sin((-th * i) / 12) * 70]);
  els.push(path(arc, false, { size: 3, color: INKDARK }, ink), text(`${deg}°`, bx + 108, by - 14, ink, 30));
  if (withBlock) els.push(...onSlope(bx, by, th, hyp(w, h) * 0.55, 120, 70, label, BLOCK1, ink));
  return els;
};
const hyp = (a: number, b: number): number => Math.hypot(a, b);

const monkey = (cx: number, cy: number, ink: string): El[] => {
  // about 190 units tall, centre of the body at (cx, cy)
  const X = (x: number) => cx + x, Y = (y: number) => cy + y;
  return [
    // tail
    poly([[X(18), Y(10)], [X(48), Y(20)], [X(62), Y(0)], [X(52), Y(-26)], [X(40), Y(-30)]], { color: BROWN, size: 7 }, ink, false),
    // legs
    line(X(-10), Y(30), X(-22), Y(78), { color: BROWN, size: 10 }, ink),
    line(X(10), Y(30), X(22), Y(78), { color: BROWN, size: 10 }, ink),
    // arms reaching up
    line(X(-16), Y(-30), X(-10), Y(-90), { color: BROWN, size: 9 }, ink),
    line(X(16), Y(-30), X(10), Y(-90), { color: BROWN, size: 9 }, ink),
    // body and head
    ellipse(X(0), Y(0), 26, 38, { fill: BROWN, color: ink, size: 3 }, ink),
    ellipse(X(0), Y(8), 14, 22, { fill: FACE, color: FACE, size: 1 }, ink),
    circle(X(-26), Y(-62), 10, { fill: BROWN, color: ink, size: 3 }, ink),
    circle(X(26), Y(-62), 10, { fill: BROWN, color: ink, size: 3 }, ink),
    circle(X(0), Y(-60), 26, { fill: BROWN, color: ink, size: 3 }, ink),
    ellipse(X(0), Y(-52), 16, 13, { fill: FACE, color: FACE, size: 1 }, ink),
    dot(X(-8), Y(-66), 3.5, INKDARK, ink),
    dot(X(8), Y(-66), 3.5, INKDARK, ink),
    poly([[X(-6), Y(-48)], [X(0), Y(-45)], [X(6), Y(-48)]], { color: INKDARK, size: 2.5 }, ink, false),
  ];
};

const comps: Comp[] = [];
const add = (cat: string, id: string, name: string, make: Comp['make']): void => void comps.push({ id, cat, name, make });

// ---------------------------------------------------------------- Vectors (forces and motion)
add('Vectors', 'f', 'Force F', (k) => vec(-90, 0, 90, 0, RED, 'F', 0, -34, k));
add('Vectors', 'w', 'Weight mg', (k) => vec(0, -70, 0, 70, GREEN, 'mg', 52, 0, k));
add('Vectors', 'n', 'Normal N', (k) => vec(0, 70, 0, -70, BLUE, 'N', 36, 0, k));
add('Vectors', 't', 'Tension T', (k) => vec(-90, 0, 90, 0, ORANGE, 'T', 0, -34, k));
add('Vectors', 'fr', 'Friction f', (k) => vec(90, 0, -90, 0, PURPLE, 'f', 0, -34, k));
add('Vectors', 'a', 'Acceleration a', (k) => vec(-90, 0, 90, 0, PINK, 'a', 0, -34, k));
add('Vectors', 'v', 'Velocity v', (k) => vec(-90, 0, 90, 0, TEAL, 'v', 0, -34, k));
add('Vectors', 'vec', 'Vector (blank)', (k) => [line(-90, 0, 90, 0, { size: 6, arrow: 1 }, k)]);
add('Vectors', 'vec2', 'Vector with components', (k) => [
  ...vec(-100, 80, 100, -50, RED, 'F', -6, -40, k),
  ...vec(-100, 80, 100, 80, ORANGE, 'Fx', 0, 34, k, true),
  ...vec(100, 80, 100, -50, TEAL, 'Fy', 46, 0, k, true),
  text('θ', -48, 66, k, 30),
]);
add('Vectors', 'axes', 'Axes x – y', (k) => [line(-90, 0, 100, 0, { size: 4, arrow: 1 }, k), line(0, 90, 0, -100, { size: 4, arrow: 1 }, k), text('x', 112, 0, k, 30), text('y', 0, -114, k, 30)]);
add('Vectors', 'axesi', 'Axes along a slope', (k) => {
  const th = Math.PI / 6;
  const ux = Math.cos(th), uy = -Math.sin(th), nx = uy, ny = -ux;
  return [line(-90 * ux, -90 * uy, 100 * ux, 100 * uy, { size: 4, arrow: 1 }, k), line(0, 0, 100 * nx, 100 * ny, { size: 4, arrow: 1 }, k), text('x', 114 * ux, 114 * uy, k, 30), text('y', 114 * nx, 114 * ny, k, 30)];
});
add('Vectors', 'fbd', 'Free-body: block', (k) => [
  ...block(0, 0, 130, 90, 'm', BLOCK1, k),
  ...vec(0, -45, 0, -125, BLUE, 'N', 30, 0, k),
  ...vec(0, 45, 0, 125, GREEN, 'mg', 46, 0, k),
  ...vec(65, 0, 155, 0, RED, 'F', 0, -30, k),
  ...vec(-65, 0, -155, 0, PURPLE, 'f', 0, -30, k),
]);
add('Vectors', 'dot', 'Point mass', (k) => [dot(0, 0, 14, k, k), text('m', 0, -34, k, 32)]);

// ---------------------------------------------------------------- Surfaces, ropes
add('Surfaces & ropes', 'ground', 'Ground', (k) => support(-250, 0, 250, 0, 1, k));
add('Surfaces & ropes', 'wall', 'Wall', (k) => support(0, -160, 0, 160, -1, k));
add('Surfaces & ropes', 'ceil', 'Ceiling', (k) => support(-250, 0, 250, 0, -1, k));
add('Surfaces & ropes', 'rope', 'String / rope', (k) => [line(-150, 0, 150, 0, { color: ORANGE, size: 3 }, k)]);
add('Surfaces & ropes', 'rod', 'Rigid rod', (k) => [line(-150, 0, 150, 0, { color: GREY, size: 12 }, k)]);

// ---------------------------------------------------------------- Blocks
add('Blocks', 'b1', 'Block m', (k) => block(0, 0, 140, 90, 'm', BLOCK1, k));
add('Blocks', 'b2', 'Heavy block M', (k) => block(0, 0, 200, 130, 'M', BLOCK2, k));
add('Blocks', 'bb', 'Block m on block M', (k) => [...block(0, 40, 260, 110, 'M', BLOCK2, k), ...block(0, -55, 120, 80, 'm', BLOCK1, k)]);
add('Blocks', 'b12', 'Blocks m₁ and m₂ with string', (k) => [
  ...support(-260, 45, 260, 45, 1, k),
  line(-30, 0, 40, 0, { color: ORANGE, size: 3 }, k),
  ...block(-100, 0, 130, 90, 'm₁', BLOCK1, k),
  ...block(110, 0, 150, 90, 'm₂', BLOCK2, k),
  ...vec(185, 0, 265, 0, RED, 'F', 0, -30, k),
]);
add('Blocks', 'b3', 'Three blocks', (k) => [
  ...support(-330, 45, 330, 45, 1, k),
  ...block(-190, 0, 110, 90, 'm₁', BLOCK1, k),
  ...block(-30, 0, 150, 90, 'm₂', BLOCK2, k),
  ...block(150, 0, 190, 90, 'm₃', BLOCK3, k),
  ...vec(245, 0, 325, 0, RED, 'F', 0, -30, k),
]);
add('Blocks', 'cart', 'Trolley with block', (k) => [
  rect(-130, -10, 260, 40, { fill: GREY, size: 4 }, k),
  circle(-80, 48, 18, { fill: '#e2e8f0', size: 4 }, k),
  circle(80, 48, 18, { fill: '#e2e8f0', size: 4 }, k),
  ...block(0, -60, 110, 80, 'm', BLOCK1, k),
  ...vec(130, 10, 215, 10, RED, 'F', 0, -30, k),
]);
add('Blocks', 'lift', 'Lift with block', (k) => [
  rect(-100, -110, 200, 230, { size: 5 }, k),
  line(0, -110, 0, -230, { color: ORANGE, size: 4 }, k),
  ...block(0, 70, 110, 80, 'm', BLOCK1, k),
  ...vec(0, -60, 0, -140, PINK, 'a', 34, 0, k),
  text('T', 26, -190, ORANGE, 34),
]);

// ---------------------------------------------------------------- Springs
add('Springs', 'sp', 'Spring', (k) => [spring(-120, 0, 120, 0, 8, 22, {}, k)]);
add('Springs', 'spw', 'Spring on a wall with block', (k) => [
  ...support(-250, -60, -250, 90, -1, k),
  ...support(-250, 45, 260, 45, 1, k).slice(0, 1),
  spring(-250, 0, -80, 0, 7, 20, {}, k),
  ...block(0, 0, 160, 90, 'm', BLOCK1, k),
  text('k', -165, -40, k, 32),
]);
add('Springs', 'spv', 'Hanging spring with mass', (k) => [
  ...support(-80, -170, 80, -170, -1, k),
  spring(0, -170, 0, 0, 8, 20, {}, k),
  ...block(0, 50, 130, 100, 'm', BLOCK1, k),
  text('k', 44, -85, k, 32),
]);
add('Springs', 'sp2', 'Two blocks with spring', (k) => [
  ...support(-300, 45, 300, 45, 1, k),
  ...block(-190, 0, 120, 90, 'm₁', BLOCK1, k),
  spring(-130, 0, 130, 0, 7, 20, {}, k),
  ...block(190, 0, 120, 90, 'm₂', BLOCK2, k),
  text('k', 0, -40, k, 32),
]);

// ---------------------------------------------------------------- Pulleys
add('Pulleys', 'p1', 'Fixed pulley', (k) => [...support(-70, -170, 70, -170, -1, k), line(0, -170, 0, -110, { size: 5 }, k), ...pulley(0, -80, 40, k), line(-40, -80, -40, 100, { color: ORANGE, size: 3 }, k), line(40, -80, 40, 100, { color: ORANGE, size: 3 }, k)]);
add('Pulleys', 'atw', 'Atwood machine (m₁, m₂)', (k) => [
  ...support(-90, -200, 90, -200, -1, k),
  line(0, -200, 0, -150, { size: 5 }, k),
  ...pulley(0, -100, 58, k),
  line(-58, -100, -58, 20, { color: ORANGE, size: 3 }, k),
  line(58, -100, 58, 80, { color: ORANGE, size: 3 }, k),
  ...block(-58, 62, 100, 84, 'm₁', BLOCK1, k),
  ...block(58, 122, 110, 84, 'm₂', BLOCK2, k),
]);
add('Pulleys', 'tab', 'Block on table + hanging block', (k) => [
  rect(-340, 0, 470, 34, { fill: GREY, size: 4 }, k),
  rect(130, -4, 22, 56, { fill: GREY, size: 3 }, k),
  ...pulley(172, -10, 30, k),
  line(-30, -40, 172, -40, { color: ORANGE, size: 3 }, k),
  line(202, -10, 202, 110, { color: ORANGE, size: 3 }, k),
  ...block(-100, -45, 140, 90, 'm₁', BLOCK1, k),
  ...block(202, 150, 110, 80, 'm₂', BLOCK2, k),
]);
add('Pulleys', 'mov', 'Movable pulley with load', (k) => [
  ...support(-100, -200, 100, -200, -1, k),
  line(-40, -200, -40, -10, { color: ORANGE, size: 3 }, k),
  line(40, -200, 40, -10, { color: ORANGE, size: 3 }, k),
  ...vec(40, -200, 40, -290, RED, 'F', 36, 0, k),
  ...pulley(0, -10, 40, k),
  line(0, 30, 0, 80, { size: 4 }, k),
  ...block(0, 130, 130, 100, 'M', BLOCK2, k),
]);
add('Pulleys', 'ptwo', 'Block on wedge + hanging block', (k) => {
  const deg = 30, th = (deg * Math.PI) / 180, { pts, w, h } = wedgePts(deg, 400);
  const [bx, by] = pts[0], [tx, ty] = pts[2];
  const ux = Math.cos(th), uy = -Math.sin(th), nx = uy, ny = -ux;
  const t = hyp(w, h) * 0.45;
  const cx = bx + ux * t + nx * 35, cy = by + uy * t + ny * 35; // middle of the block on the slope
  const pr = 24, px = tx + 4, py = ty - pr; // pulley at the top corner
  return [
    poly(pts, { fill: GREY, size: 5 }, k),
    ...onSlope(bx, by, th, t, 120, 70, 'm₁', BLOCK1, k),
    line(cx + ux * 60, cy + uy * 60 + 0, px - pr * 0.5, py - pr * 0.85, { color: ORANGE, size: 3 }, k),
    ...pulley(px, py, pr, k),
    line(px + pr, py, px + pr, ty + h * 0.45, { color: ORANGE, size: 3 }, k),
    ...block(px + pr, ty + h * 0.45 + 45, 100, 80, 'm₂', BLOCK2, k),
  ];
});

// ---------------------------------------------------------------- Wedges (inclined planes)
for (const deg of [30, 37, 45, 53, 60]) add('Wedges', `w${deg}`, `Wedge ${deg}°`, (k) => wedge(deg, k, false));
add('Wedges', 'wb', 'Block on wedge 30°', (k) => wedge(30, k, true));
add('Wedges', 'wb37', 'Block on wedge 37°', (k) => wedge(37, k, true));
add('Wedges', 'wfbd', 'Block on wedge with forces', (k) => {
  const deg = 30, th = (deg * Math.PI) / 180, { pts, w, h } = wedgePts(deg);
  const [bx, by] = pts[0];
  const t = hyp(w, h) * 0.55, ux = Math.cos(th), uy = -Math.sin(th), nx = uy, ny = -ux;
  const cx = bx + ux * t + nx * 35, cy = by + uy * t + ny * 35;
  return [
    ...wedge(deg, k, true, ''),
    ...vec(cx, cy, cx, cy + 130, GREEN, 'mg', 46, 0, k),
    ...vec(cx, cy, cx + nx * 120, cy + ny * 120, BLUE, 'N', nx * 30 - 14, ny * 30, k),
    ...vec(cx, cy, cx + ux * 110, cy + uy * 110, PURPLE, 'f', ux * 10 - 18, uy * 10 - 24, k),
  ];
});

// ---------------------------------------------------------------- Monkey problems
add('Monkey', 'mk', 'Monkey', (k) => monkey(0, 0, k));
add('Monkey', 'mkr', 'Monkey on a rope', (k) => [...support(-80, -190, 80, -190, -1, k), line(0, -190, 0, 40, { color: ORANGE, size: 4 }, k), ...monkey(0, 70, k)]);
add('Monkey', 'mkp', 'Monkey and block over a pulley', (k) => [
  ...support(-80, -230, 80, -230, -1, k),
  line(0, -230, 0, -180, { size: 5 }, k),
  ...pulley(0, -140, 44, k),
  line(-44, -140, -44, -10, { color: ORANGE, size: 4 }, k),
  line(44, -140, 44, 60, { color: ORANGE, size: 4 }, k),
  ...monkey(-44, 50, k),
  ...block(44, 110, 120, 100, 'M', BLOCK2, k),
  text('m', -112, 50, k, 34),
]);
add('Monkey', 'mkb', 'Monkey climbing, two equal blocks', (k) => [
  ...support(-80, -230, 80, -230, -1, k),
  line(0, -230, 0, -180, { size: 5 }, k),
  ...pulley(0, -140, 44, k),
  line(-44, -140, -44, 20, { color: ORANGE, size: 4 }, k),
  line(44, -140, 44, 60, { color: ORANGE, size: 4 }, k),
  ...monkey(-44, -30, k),
  ...block(-46, 100, 80, 84, 'M', BLOCK2, k),
  ...block(46, 105, 80, 84, 'M', BLOCK2, k),
  ...vec(112, -20, 112, -100, TEAL, 'v', 30, 0, k),
]);

/** Parts of the catalogue, in the order shown in the panel. */
export const NLM_CATEGORIES = ['Vectors', 'Surfaces & ropes', 'Blocks', 'Springs', 'Pulleys', 'Wedges', 'Monkey'];
export const NLM_COMPONENTS: Comp[] = comps;
