import type { Art } from './kit';
import { S, F, n1, poly, sine } from './kit';

// Arrow path (line + open head); style comes from the wrapping <g>.
const ar = (x1: number, y1: number, x2: number, y2: number, h = 3.4) => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d: number) => `${n1(x2 - h * Math.cos(a + d))} ${n1(y2 - h * Math.sin(a + d))}`;
  return `M${x1} ${y1}L${x2} ${y2}M${p(0.45)}L${x2} ${y2}L${p(-0.45)}`;
};

const waves = () => {
  let grid = '';
  for (const y of [24, 37, 63, 76]) grid += `M10 ${y}H90`;
  for (let x = 20; x <= 90; x += 10) grid += `M${x} 18V82`;
  const hump = sine(50, -26, 0.5, 0, 10, 30);
  return (
    `<g ${S(0.18, 0.7)}><path d='${grid}'/></g><path d='${hump}Z' ${F(0.2)}/>` +
    `<g ${S(0.6, 1.2)}><path d='M6 50H92M10 94V8'/><path d='${ar(80, 50, 93, 50, 3)}'/><path d='${ar(10, 14, 10, 6, 3)}'/></g>` +
    `<g ${S(0.6, 1)}><path d='M30 47V53M50 47V53M70 47V53M90 47V53M7 24H13M7 76H13'/></g>` +
    `<g ${S(0.6, 1.5)} stroke-dasharray='3 2.6'><path d='${sine(50, -26, 2, Math.PI / 2, 10, 90)}'/></g>` +
    `<g ${S(1, 2)}><path d='${sine(50, -26, 2, 0, 10, 90)}'/></g>` +
    [[15, 31.6], [35, 68.4], [55, 31.6], [75, 68.4]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='2.2' ${F(0.95)}/><circle cx='${x}' cy='${y}' r='4' ${S(0.4, 0.8)}/>`).join('') +
    `<g ${S(0.4, 0.8)} stroke-dasharray='1.6 2.4'><path d='M15 31.6V50M35 68.4V50M55 31.6V50M75 68.4V50'/></g>`
  );
};

const unit = () => {
  const t = (40 * Math.PI) / 180, px = n1(50 + 38 * Math.cos(t)), py = n1(50 - 38 * Math.sin(t));
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return `M${n1(50 + 35.5 * Math.cos(a))} ${n1(50 - 35.5 * Math.sin(a))}L${n1(50 + 40.5 * Math.cos(a))} ${n1(50 - 40.5 * Math.sin(a))}`;
  }).join('');
  return (
    `<circle cx='50' cy='50' r='38' ${F(0.07)}/><path d='M50 50L${px} ${py}V50Z' ${F(0.2)}/>` +
    `<path d='M50 50L${px} 50A38 38 0 0 0 ${px} ${py}Z' ${F(0.05)}/>` +
    `<g ${S(0.5, 1)}><path d='M6 50H94M50 94V6'/><path d='${ar(86, 50, 94, 50, 3)}'/><path d='${ar(50, 14, 50, 6, 3)}'/></g>` +
    `<g ${S(0.9, 1.7)}><circle cx='50' cy='50' r='38'/></g><g ${S(0.6, 1)}><path d='${ticks}'/></g>` +
    `<g ${S(0.9, 1.6)}><path d='M50 50L${px} ${py}'/></g><g ${S(0.95, 2.4)}><path d='M${px} 50V${py}'/></g><g ${S(0.7, 2)}><path d='M50 50H${px}'/></g>` +
    `<g ${S(0.5, 1)} stroke-dasharray='2 2.6'><path d='M${px} ${py}L88 18.1M88 50V18.1'/></g><g ${S(0.8, 1.6)}><path d='M88 50V18.1'/></g>` +
    `<g ${S(0.8, 1.2)}><path d='M62 50A12 12 0 0 0 59.2 42.3'/><path d='M${px - 4.5} 50V45.5H${px}'/></g>` +
    `<circle cx='${px}' cy='${py}' r='3' ${F(0.95)}/><circle cx='${px}' cy='${py}' r='5.6' ${S(0.4, 0.8)}/><circle cx='50' cy='50' r='2' ${F(0.9)}/>`
  );
};

const cube = () => {
  const f = [[14, 36], [64, 36], [64, 86], [14, 86]], b = f.map(([x, y]) => [x + 22, y - 20]);
  return (
    `<path d='${poly([f[0], f[1], b[1], b[0]], true)}' ${F(0.1)}/><path d='${poly([f[1], f[2], b[2], b[1]], true)}' ${F(0.24)}/><path d='${poly(f, true)}' ${F(0.05)}/>` +
    `<g ${S(0.5, 1.1)} stroke-dasharray='3 3'><path d='${poly([f[3], b[3], b[0]])}M${b[3]}L${b[2]}'/></g>` +
    `<g ${S(0.45, 1)} stroke-dasharray='1.4 2.6'><path d='M${f[3]}L${b[1]}M${f[0]}L${f[2]}'/></g>` +
    `<g ${S(0.95, 1.8)}><path d='${poly(f, true)}'/><path d='${poly([f[1], b[1], b[2], f[2]])}'/><path d='${poly([f[0], b[0], b[1]])}'/></g>` +
    `<g ${S(0.7, 1.1)}><path d='M14 80H20V86M64 41H59V36'/></g>` +
    [...f, b[0], b[1], b[2]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='1.9' ${F(0.9)}/>`).join('') + `<circle cx='${b[3][0]}' cy='${b[3][1]}' r='1.6' ${F(0.45)}/>`
  );
};

const solids = () =>
  `<path d='M32 14L8 76A24 7 0 0 0 56 76Z' ${F(0.12)}/><path d='M32 14L56 76A24 7 0 0 1 32 83Z' ${F(0.14)}/>` +
  `<g ${S(0.5, 1.1)} stroke-dasharray='2.6 2.6'><path d='M8 76A24 7 0 0 1 56 76M32 14V76L56 76'/></g>` +
  `<g ${S(0.95, 1.7)}><path d='M32 14L8 76A24 7 0 0 0 56 76Z'/></g><circle cx='32' cy='14' r='1.8' ${F(0.9)}/><circle cx='32' cy='76' r='1.8' ${F(0.9)}/>` +
  `<circle cx='74' cy='64' r='19' ${F(0.1)}/><path d='M86 50A19 19 0 0 1 60 76A19 19 0 0 0 86 50Z' ${F(0.2)}/><path d='M58 74A19 19 0 0 0 90 74' ${S(0.5, 3)}/>` +
  `<g ${S(0.5, 1.1)} stroke-dasharray='2.6 2.6'><path d='M55 64A19 5.5 0 0 1 93 64M74 45V83M74 64L93 64'/></g>` +
  `<g ${S(0.95, 1.7)}><circle cx='74' cy='64' r='19'/><path d='M55 64A19 5.5 0 0 0 93 64'/></g><path d='M63 52A14 14 0 0 1 72 47' ${S(0.35, 1.4)}/>` +
  `<circle cx='74' cy='64' r='1.8' ${F(0.9)}/><g ${S(0.5, 0.9)}><path d='M6 92H94'/></g>`;

const venn = () => {
  const c = [[38, 40], [62, 40], [50, 62]];
  return (
    `<rect x='7' y='7' width='86' height='86' rx='5' ${S(0.35, 1)} stroke-dasharray='3 3'/>` +
    c.map(([x, y]) => `<circle cx='${x}' cy='${y}' r='23' ${F(0.13)}/>`).join('') +
    c.map(([x, y], i) => `<circle cx='${x}' cy='${y}' r='23' ${S(0.95 - i * 0.12, 1.6)}/>`).join('') +
    `<g ${S(0.5, 0.9)} stroke-dasharray='1.5 2.4'>${c.map(([x, y], i) => `<path d='M${x} ${y}L${n1(x + 23 * Math.cos(-2.2 + i * 2.1))} ${n1(y + 23 * Math.sin(-2.2 + i * 2.1))}'/>`).join('')}</g>` +
    c.map(([x, y]) => `<circle cx='${x}' cy='${y}' r='1.6' ${F(0.9)}/>`).join('') +
    `<circle cx='50' cy='47' r='2.2' ${F(0.95)}/><circle cx='50' cy='47' r='4.6' ${S(0.5, 0.9)}/>` +
    `<g ${F(0.7)}><circle cx='27' cy='33' r='1.2'/><circle cx='73' cy='33' r='1.2'/><circle cx='50' cy='73' r='1.2'/><circle cx='50' cy='34' r='1.2'/><circle cx='39' cy='55' r='1.2'/><circle cx='61' cy='55' r='1.2'/></g>`
  );
};

const riemann = () => {
  const f = (x: number) => n1(84 - (18 + 40 * Math.sin((Math.PI * (x - 12)) / 76)));
  let curve = '', bars = '', bf = '';
  for (let x = 12; x <= 88; x += 2) curve += `${x === 12 ? 'M' : 'L'}${x} ${f(x)}`;
  for (let i = 0; i < 8; i++) {
    const x = 20 + i * 8, y = f(x);
    bars += `<rect x='${x}' y='${y}' width='8' height='${n1(84 - y)}' ${F(0.1 + (i % 2) * 0.1)}/>`;
    bf += `M${x} ${y}V84`;
  }
  return (
    bars + `<g ${S(0.6, 0.9)}><path d='${bf}M84 ${f(84)}V84'/><path d='${Array.from({ length: 8 }, (_, i) => `M${20 + i * 8} ${f(20 + i * 8)}H${28 + i * 8}`).join('')}' /></g>` +
    `<g ${S(0.6, 1.2)}><path d='M12 90V8M6 84H93'/><path d='${ar(12, 14, 12, 6, 3)}'/><path d='${ar(82, 84, 93, 84, 3)}'/></g>` +
    `<g ${S(0.5, 1)} stroke-dasharray='2 2.6'><path d='M20 ${f(20)}V90M84 ${f(84)}V90'/></g>` +
    `<g ${S(1, 2)}><path d='${curve}'/></g>` +
    `<circle cx='20' cy='${f(20)}' r='1.8' ${F(0.9)}/><circle cx='84' cy='${f(84)}' r='1.8' ${F(0.9)}/>` +
    `<g ${S(0.95, 2)}><path d='M27 11c-3.5-2.5-6-.5-6 3.5v12c0 4-2.5 6-6 3.5'/></g><circle cx='27.6' cy='11.4' r='1.2' ${F(0.9)}/><circle cx='14.4' cy='29.4' r='1.2' ${F(0.9)}/>`
  );
};

const triangle = () => {
  const A = [20, 72], B = [80, 72], C = [40, 26];
  const d = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const a = d(B, C), b = d(C, A), c = d(A, B), s = (a + b + c) / 2;
  const I = [(a * A[0] + b * B[0] + c * C[0]) / (2 * s), (a * A[1] + b * B[1] + c * C[1]) / (2 * s)];
  const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2, r = area / s;
  const R = (a * b * c) / (4 * area);
  const ux = 50, uy = (Math.pow(ux - A[0], 2) + A[1] * A[1] - Math.pow(ux - C[0], 2) - C[1] * C[1]) / (2 * (A[1] - C[1]));
  const mid = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  return (
    `<g transform='translate(0 -3)'><circle cx='${ux}' cy='${n1(uy)}' r='${n1(R)}' ${F(0.05)}/><circle cx='${ux}' cy='${n1(uy)}' r='${n1(R)}' ${S(0.65, 1.2)}/>` +
    `<path d='${poly([A, B, C], true)}' ${F(0.1)}/><circle cx='${n1(I[0])}' cy='${n1(I[1])}' r='${n1(r)}' ${F(0.18)}/>` +
    `<g ${S(0.9, 1.8)}><path d='${poly([A, B, C], true)}'/></g><circle cx='${n1(I[0])}' cy='${n1(I[1])}' r='${n1(r)}' ${S(0.9, 1.4)}/>` +
    `<g ${S(0.45, 0.9)} stroke-dasharray='2 2.4'>${[[A, B], [B, C], [C, A]].map(([p, q]) => `<path d='M${ux} ${n1(uy)}L${n1(mid(p, q)[0])} ${n1(mid(p, q)[1])}'/>`).join('')}${[A, B, C].map((p) => `<path d='M${p[0]} ${p[1]}L${n1(I[0])} ${n1(I[1])}'/>`).join('')}</g>` +
    [A, B, C].map((p) => `<circle cx='${p[0]}' cy='${p[1]}' r='2' ${F(0.9)}/>`).join('') +
    `<circle cx='${n1(I[0])}' cy='${n1(I[1])}' r='1.8' ${F(0.95)}/><circle cx='${ux}' cy='${n1(uy)}' r='1.8' ${F(0.55)}/><circle cx='${ux}' cy='${n1(uy)}' r='3.6' ${S(0.4, 0.8)}/>` +
    `<g ${S(0.7, 1.1)}><path d='M26 72A6 6 0 0 0 24.4 67.2'/><path d='M74 72A6 6 0 0 1 75.5 67'/><path d='M43.5 31.5A6 6 0 0 0 35.6 30'/></g></g>`
  );
};

const golden = () => {
  const sq: number[][] = [[8, 24, 52], [60, 24, 32], [72, 56, 20], [60, 64, 12], [60, 56, 8], [68, 56, 4], [68, 60, 4]];
  const arcs = 'M8 76A52 52 0 0 1 60 24A32 32 0 0 1 92 56A20 20 0 0 1 72 76A12 12 0 0 1 60 64A8 8 0 0 1 68 56A4 4 0 0 1 72 60A4 4 0 0 1 68 64';
  return (
    sq.map(([x, y, s], i) => `<rect x='${x}' y='${y}' width='${s}' height='${s}' ${F([0.1, 0.2, 0.12, 0.24, 0.16, 0.28, 0.2][i])}/>`).join('') +
    `<g ${S(0.7, 1)}>${sq.map(([x, y, s]) => `<rect x='${x}' y='${y}' width='${s}' height='${s}'/>`).join('')}</g>` +
    `<g ${S(0.4, 0.9)} stroke-dasharray='2.6 2.6'><path d='M8 76L92 24M8 24L60 76'/></g>` +
    `<g ${S(1, 2.2)}><path d='${arcs}'/></g><circle cx='70' cy='62' r='1.8' ${F(0.95)}/>` +
    `<g ${S(0.7, 1.1)}><path d='M8 88H92M8 84V92M60 84V92M92 84V92'/></g>` +
    `<g ${S(0.4, 1)}><path d='M8 12H60' stroke-dasharray='1.5 2.4'/><path d='M60 12H92' stroke-dasharray='1.5 2.4' opacity='0.6'/></g>`
  );
};

export const MATHS: Art[] = [waves, unit, cube, solids, venn, riemann, triangle, golden];
