import type { Art } from './kit';
import { S, F, n1, poly, ngon } from './kit';

// Arrow path (line + open head); style comes from the wrapping <g>.
const ar = (x1: number, y1: number, x2: number, y2: number, h = 3.4) => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d: number) => `${n1(x2 - h * Math.cos(a + d))} ${n1(y2 - h * Math.sin(a + d))}`;
  return `M${x1} ${y1}L${x2} ${y2}M${p(0.45)}L${x2} ${y2}L${p(-0.45)}`;
};
// A shaded atom: body tone, darker crescent lower right, thin outline.
const ball = (x: number, y: number, r: number, t = 0.3) =>
  `<circle cx='${x}' cy='${y}' r='${r}' ${F(t)}/><path d='M${n1(x + r * 0.62)} ${n1(y - r * 0.62)}A${n1(r * 0.88)} ${n1(r * 0.88)} 0 0 1 ${n1(x - r * 0.62)} ${n1(y + r * 0.62)}' ${S(0.5, r * 0.3)}/><circle cx='${x}' cy='${y}' r='${r}' ${S(0.9, 1)}/>`;
// A bond between two atoms, trimmed so it stops at the atom edges (atoms are see-through).
const stick = (a: number[], b: number[], w = 3.2, o = 0.5) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
  const p = (c: number[], r: number, s: number) => `${n1(c[0] + (s * dx * r) / d)} ${n1(c[1] + (s * dy * r) / d)}`;
  return `<path d='M${p(a, a[2], 1)}L${p(b, b[2], -1)}' ${S(o, w)}/>`;
};

const flask = () =>
  `<clipPath id='fk'><path d='M42 38L16 80Q13 87 21 87H79Q87 87 84 80L58 38Z'/></clipPath>` +
  `<ellipse cx='50' cy='91' rx='34' ry='3' ${F(0.1)}/>` +
  `<path d='M28.4 60Q39 56 50 60T71.6 60L86 86H14Z' ${F(0.24)}/><g clip-path='url(#fk)'><path d='M10 76Q50 70 90 76V90H10Z' ${F(0.2)}/></g>` +
  `<g ${S(0.95, 1.7)}><path d='M42 14V38L16 80Q13 87 21 87H79Q87 87 84 80L58 38V14M38.5 14H61.5'/></g>` +
  `<rect x='41' y='6' width='18' height='8' rx='1.5' ${F(0.5)}/><rect x='41' y='6' width='18' height='8' rx='1.5' ${S(0.9, 1.2)}/>` +
  `<g ${S(0.8, 1.1)}><path d='M28.4 60Q39 56 50 60T71.6 60'/></g>` +
  `<g ${S(0.55, 1)}><path d='M33 50H38.5M28 58H32M24 66H29M64 50H69M68 58H72'/></g>` +
  `<path d='M45 18V36' ${S(0.35, 1.2)}/><path d='M31 66L21 84' ${S(0.3, 1.4)}/>` +
  `<g ${S(0.8, 1.1)}><circle cx='43' cy='72' r='3.2'/><circle cx='56' cy='68' r='2'/><circle cx='51' cy='78' r='2.4'/><circle cx='39' cy='64' r='1.3'/><circle cx='60' cy='74' r='1.3'/></g>` +
  `<g ${S(0.4, 1)}><path d='M50 28Q46 24 50 20Q54 16 50 11' stroke-dasharray='1.5 2.4'/></g>`;

const benzene = () => {
  const v = ngon(50, 50, 24, 6), w = ngon(50, 50, 18.5, 6);
  const lerp = (a: number[], b: number[], t: number) => `${n1(a[0] + (b[0] - a[0]) * t)} ${n1(a[1] + (b[1] - a[1]) * t)}`;
  const dbl = [0, 2, 4].map((i) => `M${lerp(w[i], w[(i + 1) % 6], 0.16)}L${lerp(w[i], w[(i + 1) % 6], 0.84)}`).join('');
  const out = ngon(50, 50, 36, 6), tip = ngon(50, 50, 41, 6);
  return (
    `<circle cx='50' cy='50' r='46' ${S(0.22, 0.8)} stroke-dasharray='1.4 3'/><path d='${poly(v, true)}' ${F(0.1)}/>` +
    `<g ${S(0.95, 1.9)}><path d='${poly(v, true)}'/></g><g ${S(0.8, 1.5)}><path d='${dbl}'/></g>` +
    `<circle cx='50' cy='50' r='9' ${S(0.25, 0.8)} stroke-dasharray='1.5 2'/>` +
    `<g ${S(0.7, 1.4)}>${v.map((p, i) => `<path d='M${p[0]} ${p[1]}L${out[i][0]} ${out[i][1]}'/>`).join('')}</g>` +
    v.map((p) => `<circle cx='${p[0]}' cy='${p[1]}' r='2' ${F(0.9)}/>`).join('') +
    tip.map((p, i) => (i === 0 ? ball(p[0], p[1] - 1, 6, 0.6) : ball(p[0], p[1], 4.2, 0.18 + (i % 2) * 0.08))).join('')
  );
};

const molecule = () => {
  const C1 = [28, 58, 9], C2 = [55, 44, 9], O = [79, 62, 10];
  const H = [[12, 42, 5], [14, 76, 5], [40, 83, 5], [42, 17, 5], [70, 22, 5], [90, 80, 5]];
  const bonds = [[C1, C2], [C2, O], [C1, H[0]], [C1, H[1]], [C1, H[2]], [C2, H[3]], [C2, H[4]], [O, H[5]]];
  return (
    `<ellipse cx='50' cy='92' rx='36' ry='2.5' ${F(0.08)}/>` +
    bonds.map(([a, b], i) => stick(a, b, i < 2 ? 4.2 : 3, i < 2 ? 0.6 : 0.4)).join('') +
    [H[3], H[4], H[0]].map((h) => ball(h[0], h[1], h[2], 0.16)).join('') +
    ball(C2[0], C2[1], 9, 0.45) + ball(C1[0], C1[1], 9, 0.45) + ball(O[0], O[1], 10, 0.75) +
    [H[1], H[2], H[5]].map((h) => ball(h[0], h[1], h[2], 0.16)).join('') +
    `<g ${S(0.4, 1)} stroke-dasharray='1.5 2.5'><path d='M32 20Q50 6 66 12'/></g>`
  );
};

const bohr = () => {
  const el = (r: number, a: number) => [n1(50 + r * Math.cos(a)), n1(50 + r * Math.sin(a))];
  const shells: [number, number[]][] = [[14, [0.5, 3.64]], [27, [0.2, 1.5, 2.6, 4.2]], [40, [1.0, 2.2, 3.4, 4.5, 5.6]]];
  const dots = shells.flatMap(([r, as]) => as.map((a) => el(r, a)));
  return (
    `<circle cx='50' cy='50' r='44' ${F(0.05)}/><circle cx='50' cy='50' r='40' ${F(0.07)}/><circle cx='50' cy='50' r='27' ${F(0.07)}/>` +
    shells.map(([r], i) => `<circle cx='50' cy='50' r='${r}' ${S(0.85 - i * 0.18, 1.3)}/>`).join('') +
    `<circle cx='50' cy='50' r='44' ${S(0.25, 0.8)} stroke-dasharray='1.4 3'/>` +
    [[0, 0, 0.9], [4, 1.6, 0.45], [-2.5, 4, 0.65], [-3.6, -2.6, 0.5], [2.6, -3.8, 0.8]].map(([x, y, o]) => `<circle cx='${50 + x}' cy='${50 + y}' r='4.3' ${F(o)}/><circle cx='${50 + x}' cy='${50 + y}' r='4.3' ${S(0.6, 0.7)}/>`).join('') +
    dots.map(([x, y]) => `<circle cx='${x}' cy='${y}' r='4.4' ${F(0.14)}/><circle cx='${x}' cy='${y}' r='2.6' ${F(0.95)}/>`).join('') +
    `<g ${S(0.8, 1.2)}><path d='M64 36Q71 30 76 24'/><path d='${ar(74, 26, 77.5, 22.5, 3)}'/></g>`
  );
};

const crystal = () => {
  const P = (i: number, j: number, k: number) => [14 + 26 * i + 20 * k, 32 + 26 * j - 16 * k + 0];
  const pts: { i: number; j: number; k: number; x: number; y: number; r: number }[] = [];
  for (let k = 1; k >= 0; k--) for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const [x, y] = P(i, j, k);
    pts.push({ i, j, k, x, y, r: (i + j + k) % 2 ? 3.2 : 5.6 });
  }
  const at = (i: number, j: number, k: number) => pts.find((p) => p.i === i && p.j === j && p.k === k)!;
  let sticks = '';
  for (let k = 0; k < 2; k++) for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const a = at(i, j, k), o = k ? 0.3 : 0.7;
    for (const n of [at(i + 1, j, k), at(i, j + 1, k), at(i, j, k + 1)].filter(Boolean)) {
      sticks += stick([a.x, a.y, a.r], [n.x, n.y, n.r], 1.4, k || n.k ? 0.35 : o);
    }
  }
  const atoms = pts.map((p) => {
    const back = p.k ? 0.5 : 1;
    return p.r > 4
      ? `<circle cx='${p.x}' cy='${p.y}' r='${p.r}' ${F(0.2 * back)}/><circle cx='${p.x}' cy='${p.y}' r='${p.r}' ${S(0.9 * back, 1.1)}/>`
      : `<circle cx='${p.x}' cy='${p.y}' r='${p.r}' ${F(0.9 * back)}/>`;
  });
  return `<path d='${poly([P(0, 0, 1), P(2, 0, 1), P(2, 2, 1), P(0, 2, 1)], true)}' ${F(0.05)}/>` + sticks + atoms.join('');
};

const distill = () =>
  `<clipPath id='dc'><circle cx='24' cy='62' r='15'/></clipPath><circle cx='24' cy='62' r='15' ${F(0.05)}/><g clip-path='url(#dc)'><path d='M6 63Q15 60 24 63T42 63V80H6Z' ${F(0.28)}/></g>` +
  `<g ${S(0.95, 1.6)}><path d='M20 50.5A15 15 0 1 0 28 50.5V28M20 50.5V28M16.5 28H31.5'/></g>` +
  `<rect x='18.5' y='24' width='11' height='5' rx='1' ${F(0.55)}/><rect x='22.6' y='8' width='2.8' height='18' ${S(0.9, 0.9)}/><rect x='22.9' y='17' width='2.2' height='9' ${F(0.8)}/><circle cx='24' cy='27' r='1.6' ${F(0.8)}/>` +
  `<g ${S(0.85, 1.4)}><path d='M28 36H38'/></g>` +
  `<g transform='rotate(30 38 36)'><rect x='38' y='29' width='44' height='14' rx='2' ${F(0.1)}/><rect x='38' y='29' width='44' height='14' rx='2' ${S(0.95, 1.5)}/><path d='M36 36H86' ${S(0.9, 1)}/><path d='M74 43V49M48 29V23' ${S(0.8, 1.5)}/><path d='M42 33H78' ${S(0.35, 0.9)} stroke-dasharray='1.5 2'/></g>` +
  `<g ${S(0.85, 1.3)}><path d='M8 81H40'/></g><path d='M24 83C20 87 20 90 24 92C28 90 28 87 24 83Z' ${F(0.6)}/><path d='M24 83C20 87 20 90 24 92C28 90 28 87 24 83Z' ${S(0.9, 1)}/>` +
  `<path d='M64 72V88Q64 93 69 93H85Q90 93 90 88V72' ${S(0.95, 1.6)}/><path d='M64.2 80H90Q90 93 85 93H69Q64 93 64.2 80Z' ${F(0.26)}/>` +
  `<path d='M77 65C74.6 68.4 74.6 70.8 77 71.8C79.4 70.8 79.4 68.4 77 65Z' ${F(0.8)}/>` +
  `<g ${S(0.7, 1)}><path d='${ar(33, 22, 38, 25, 3)}'/><path d='M20 44V40M24 46V38M28 44V40' stroke-dasharray='1 2' opacity='0.7'/><circle cx='18' cy='66' r='2'/><circle cx='28' cy='70' r='1.4'/><circle cx='23' cy='58' r='1.1'/></g>`;

const tiles = () => {
  const size = 15.2, gap = 2.6, x0 = 6.8, y0 = 15.7;
  let s = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    if (r === 0 && c > 0 && c < 4) continue;
    const x = n1(x0 + c * (size + gap)), y = n1(y0 + r * (size + gap)), hot = r === 2 && c === 3;
    const t = c === 0 ? 0.32 : c === 4 ? 0.2 : 0.1;
    s += `<rect x='${x}' y='${y}' width='${size}' height='${size}' rx='2' ${F(hot ? 0.7 : t)}/><rect x='${x}' y='${y}' width='${size}' height='${size}' rx='2' ${S(hot ? 1 : 0.8, hot ? 1.6 : 1.1)}/>` +
      `<path d='M${x + 2.4} ${y + 3.2}h3.2M${x + 2.4} ${y + size - 2.6}h${5 + (c % 3) * 2}' ${S(hot ? 0.5 : 0.55, 1)}/>` +
      (c % 2 ? `<circle cx='${n1(x + size / 2 + 1.2)}' cy='${n1(y + size / 2)}' r='3.4' ${S(0.8, 1.1)}/><circle cx='${n1(x + size / 2 + 1.2)}' cy='${n1(y + size / 2)}' r='1.3' ${F(0.8)}/>` : `<path d='M${n1(x + 8.8)} ${n1(y + 4.6)}l2.8 2.2v3.2l-2.8 2.2l-2.8-2.2v-3.2Z' ${S(0.8, 1.1)}/>`);
  }
  return s + `<g ${S(0.4, 1)}><path d='M7 90H93M7 94H60' stroke-dasharray='1.6 2.4'/></g>`;
};

const orbitals = () => {
  const lobe = (a: number, sc: number, t: number, k: number) =>
    `<g transform='translate(50 50) rotate(${a}) scale(${sc})'><path d='M0 0C-13 -8 -14 -30 0 -36C14 -30 13 -8 0 0Z' ${F(t * 0.55)}/><path d='M0 -2C-6 -9 -6 -22 0 -26C6 -22 6 -9 0 -2Z' ${F(t * 0.5)}/><path d='M0 0C-13 -8 -14 -30 0 -36C14 -30 13 -8 0 0Z' ${S(k, 1.4 / sc)}/></g>`;
  return (
    `<g ${S(0.4, 0.9)} stroke-dasharray='1.6 2.6'><path d='M50 6V94M6 50H94M16 84L84 16' opacity='0.8'/></g>` +
    lobe(225, 0.78, 0.5, 0.45) + lobe(45, 0.78, 0.25, 0.35) +
    lobe(90, 1, 0.65, 0.65) + lobe(270, 1, 0.3, 0.5) +
    lobe(0, 1.1, 0.95, 0.95) + lobe(180, 1.1, 0.4, 0.8) +
    `<circle cx='50' cy='50' r='3.2' ${F(0.95)}/><g ${S(0.7, 1.1)}><path d='M12 28L16 28M84 72L88 72M30 90L34 90M70 10L74 10'/></g>`
  );
};

export const CHEMISTRY: Art[] = [flask, benzene, molecule, bohr, crystal, distill, tiles, orbitals];
