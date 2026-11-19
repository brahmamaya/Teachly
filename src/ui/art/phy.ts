import type { Art } from './kit';
import { S, F, n1, poly } from './kit';

// Arrow path (line + open head) from (x1,y1) to (x2,y2); style comes from the wrapping <g>.
const ar = (x1: number, y1: number, x2: number, y2: number, h = 3.6) => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d: number) => `${n1(x2 - h * Math.cos(a + d))} ${n1(y2 - h * Math.sin(a + d))}`;
  return `M${x1} ${y1}L${x2} ${y2}M${p(0.45)}L${x2} ${y2}L${p(-0.45)}`;
};
// A shaded ball: soft body, darker crescent on the lower right, thin outline.
const ball = (x: number, y: number, r: number) =>
  `<circle cx='${x}' cy='${y}' r='${r}' ${F(0.22)}/><path d='M${n1(x + r * 0.62)} ${n1(y - r * 0.62)}A${r * 0.88} ${r * 0.88} 0 0 1 ${n1(x - r * 0.62)} ${n1(y + r * 0.62)}' ${S(0.55, r * 0.35)}/><circle cx='${x}' cy='${y}' r='${r}' ${S(0.9, 1.1)}/>`;
// Electron position on a tilted orbit.
const orb = (rx: number, ry: number, tilt: number, ph: number) => {
  const t = (tilt * Math.PI) / 180, c = rx * Math.cos(ph), s = ry * Math.sin(ph);
  return [n1(50 + c * Math.cos(t) - s * Math.sin(t)), n1(50 + c * Math.sin(t) + s * Math.cos(t))];
};

const lens = () => {
  const L = `M50 16C64 34 64 66 50 84C36 66 36 34 50 16Z`;
  return (
    `<path d='${L}' ${F(0.13)}/><g ${S(0.4, 0.9)}><path d='M6 50H94'/><path d='M10 46V54M30 46V54M70 46V54M90 46V54'/></g>` +
    `<g ${S(0.9, 1.6)}><path d='${L}'/></g><path d='M50 22C57 36 57 64 50 78' ${S(0.35, 0.8)}/>` +
    `<g ${S(0.95, 1.8)}><path d='${ar(10, 50, 10, 33)}'/></g>` +
    `<g ${S(0.55, 1.8)} stroke-dasharray='2.4 2.4'><path d='M90 50V65.5'/></g><g ${S(0.55, 1.4)}><path d='M86.5 61.5L90 66L93.5 61.5'/></g>` +
    `<g ${S(0.85, 1.2)}><path d='M10 34H50L70 50L90 66' /><path d='M10 34L50 50L90 66'/><path d='M10 34L30 50L50 66H90'/></g>` +
    `<g ${S(0.9, 1.1)}><path d='M30 34H34M64 34.2L66.6 36M72 52L74 54'/></g>` +
    `<circle cx='30' cy='50' r='1.8' ${F(0.9)}/><circle cx='70' cy='50' r='1.8' ${F(0.9)}/><circle cx='50' cy='50' r='1.4' ${F(0.9)}/>` +
    `<g ${S(0.5, 1)} stroke-dasharray='1.5 2.5'><path d='M10 34L50 34M50 66H90'/></g>`
  );
};

const prism = () =>
  `<path d='M46 20L68 72H24Z' ${F(0.12)}/><path d='M46 20L56 44L40 44Z' ${F(0.06)}/>` +
  `<path d='M63 60.5L94 66V90Z' ${F(0.07)}/>` +
  `<g ${S(0.9, 1.8)}><path d='M46 20L68 72H24Z'/></g><path d='M30 62L46 27' ${S(0.35, 0.9)}/>` +
  `<g ${S(0.35, 0.9)} stroke-dasharray='2 2.5'><path d='M22 62L40 54M66 54L78 48M30 58L22 56'/></g>` +
  `<g ${S(1, 2.2)}><path d='M6 61L30.2 58L63 60.5'/></g><g ${S(1, 1.4)}><path d='${ar(14, 60, 18, 59.6, 3.4)}'/></g>` +
  [66, 71, 76.5, 82, 87, 91].map((y, i) => `<path d='M63 60.5L94 ${y}' ${S(0.95 - i * 0.1, 1.2 + (i % 2) * 0.3)}/>`).join('') +
  `<circle cx='30.2' cy='58' r='1.6' ${F(0.9)}/><circle cx='63' cy='60.5' r='1.6' ${F(0.9)}/>` +
  `<g ${S(0.5, 1)}><path d='M90 8V16M86 12H94M78 10L82 14M10 16L14 20' opacity='0.5'/></g>`;

const cradle = () => {
  const xs = [26, 38, 50, 62, 74];
  let s = `<g ${S(0.9, 2)}><path d='M10 14H90M14 14L9 86M86 14L91 86M5 87H95'/></g><g ${S(0.4, 1)}><path d='M4 92H96'/></g>`;
  xs.slice(1).forEach((x) => (s += `<path d='M${x} 14V${60}' ${S(0.6, 0.8)}/>${ball(x, 66, 6)}`));
  s += `<path d='M26 14L10.6 62.4' ${S(0.6, 0.8)}/>${ball(10.6, 66.4, 6)}`;
  s += `<g ${S(0.45, 1)} stroke-dasharray='2.4 2.6'><path d='M18.5 76A52 52 0 0 0 26 68'/></g>`;
  s += `<g ${S(0.8, 1.3)}><path d='M28 36A50 50 0 0 0 19 42'/><path d='${ar(19, 42, 15.6, 46.4, 3)}'/><path d='M82 36A50 50 0 0 1 90.6 44' opacity='0.55'/></g>`;
  return s + xs.map((x) => `<circle cx='${x}' cy='14' r='1.5' ${F(0.9)}/>`).join('');
};

const circuit = () => {
  const zig = poly([[34, 24], [38, 24], [41, 17], [46, 31], [51, 17], [56, 31], [61, 17], [64, 24], [68, 24]]);
  return (
    `<circle cx='50' cy='76' r='17' ${F(0.07)}/><circle cx='50' cy='76' r='10' ${F(0.14)}/>` +
    `<g ${S(0.9, 1.6)}><path d='M20 24H34M68 24H86V42M86 58V76H60M40 76H14V57M14 43V24'/><path d='${zig}'/>` +
    `<circle cx='50' cy='76' r='10'/><path d='M43 69L57 83M57 69L43 83' opacity='0.6'/><path d='M50 66V63' opacity='0'/></g>` +
    `<g ${S(1, 2.4)}><path d='M7 43H21M10 57H18'/></g><g ${S(0.5, 1)}><path d='M20 36V41M17 38.5H23' opacity='0'/></g>` +
    `<g ${S(0.9, 1.6)}><path d='M86 42L77 52' /></g><circle cx='86' cy='42' r='1.9' ${F(0.9)}/><circle cx='86' cy='58' r='1.9' ${F(0.9)}/>` +
    `<g ${S(0.7, 1.1)}><path d='${ar(24, 24, 29, 24, 3)}'/><path d='${ar(86, 66, 86, 70, 3)}'/><path d='${ar(30, 76, 24, 76, 3)}'/><path d='${ar(14, 36, 14, 31, 3)}'/></g>` +
    `<g ${S(0.55, 1.1)}><path d='M50 54V58M37 57L40 60M63 57L60 60M35 71L32 72M65 71L68 72M40 88L38 91M60 88L62 91M50 90V93' /></g>` +
    `<g ${S(0.4, 0.9)}><path d='M44 40H56' stroke-dasharray='1.5 2'/></g>`
  );
};

const waves = () => {
  const rs = [7, 14, 21, 28, 35, 42, 49];
  const ring = (cx: number) => rs.map((r, i) => `<circle cx='${cx}' cy='50' r='${r}' ${S(0.7 - i * 0.04, i % 2 ? 0.8 : 1.2)}/>`).join('');
  return (
    `<clipPath id='pc'><circle cx='50' cy='50' r='44'/></clipPath><g clip-path='url(#pc)'>${ring(33)}${ring(67)}</g>` +
    `<circle cx='50' cy='50' r='44.5' ${S(0.9, 1.3)}/><circle cx='33' cy='50' r='5.5' ${F(0.2)}/><circle cx='67' cy='50' r='5.5' ${F(0.2)}/>` +
    `<circle cx='33' cy='50' r='2.6' ${F(0.95)}/><circle cx='67' cy='50' r='2.6' ${F(0.95)}/>` +
    `<g ${S(0.5, 0.9)} stroke-dasharray='2 3'><path d='M50 6V94'/></g>`
  );
};

const magnet = () => {
  const up = (a: number, b: number) => `M66 46C${a} ${b},${100 - a} ${b},34 46`;
  const loops = [[90, 34], [96, 20], [110, 6]].map(([a, b]) => `<path d='${up(a, b)}'/><path d='${up(a, b)}' transform='translate(0 100) scale(1 -1)'/>`).join('');
  const pk = [37, 26.5, 16];
  const heads = pk.map((y) => `<path d='M54 ${n1(y - 2.6)}L50 ${y}L54 ${n1(y + 2.6)}'/><path d='M54 ${n1(100 - y - 2.6)}L50 ${100 - y}L54 ${n1(100 - y + 2.6)}'/>`).join('');
  return (
    `<g ${S(0.75, 1.1)}>${loops}</g><g ${S(0.9, 1.3)}>${heads}</g>` +
    `<g ${S(0.75, 1.1)}><path d='M68 50H92M8 50H32'/><path d='M17 46.5L13 50L17 53.5' /></g>` +
    `<rect x='34' y='42' width='32' height='16' rx='1.5' ${F(0.75)}/><rect x='50' y='42' width='16' height='16' ${F(0.18)}/>` +
    `<g ${S(1, 1.6)}><rect x='34' y='42' width='32' height='16' rx='1.5'/><path d='M50 42V58'/></g>` +
    `<path d='M36 44.5H48' ${S(0.3, 1)}/><path d='M53 44.5H64' ${S(0.8, 1)}/>` +
    `<g ${F(0.55)}><circle cx='24' cy='40' r='.9'/><circle cx='76' cy='60' r='.9'/><circle cx='20' cy='62' r='.9'/><circle cx='80' cy='38' r='.9'/><circle cx='50' cy='34' r='.9'/><circle cx='50' cy='66' r='.9'/></g>`
  );
};

const projectile = () => {
  const dots = [[30, 37], [50, 22], [70, 37]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='2.6' ${F(0.9)}/>`).join('');
  return (
    `<path d='M10 82Q50 -38 90 82Z' ${F(0.07)}/><g ${S(0.9, 1.4)}><path d='M6 82H94'/></g>` +
    `<g ${S(0.4, 0.9)}><path d='M10 82L5 87M22 82L17 87M34 82L29 87M46 82L41 87M58 82L53 87M70 82L65 87M82 82L77 87M94 82L89 87'/></g>` +
    `<g ${S(0.85, 1.5)} stroke-dasharray='1.2 3'><path d='M10 82Q50 -38 90 82'/></g>` +
    `<g ${S(0.4, 0.9)} stroke-dasharray='2 2.5'><path d='M50 22V82M30 37H38M30 37V25M70 37H78M70 37V49'/></g>` +
    `<g ${S(1, 1.6)}><path d='${ar(10, 82, 19, 55)}'/><path d='${ar(30, 37, 38, 25)}'/><path d='${ar(50, 22, 65, 22)}'/><path d='${ar(70, 37, 78, 49)}'/></g>` +
    `<g ${S(0.6, 1.2)}><path d='M22 82A12 12 0 0 0 14 70.6'/><path d='${ar(14, 92, 10, 92, 2.8)}'/><path d='${ar(86, 92, 90, 92, 2.8)}'/><path d='M12 92H88'/><path d='M10 88.5V95.5M90 88.5V95.5'/></g>` +
    `${dots}<circle cx='10' cy='82' r='3' ${F(0.9)}/><circle cx='90' cy='82' r='2.6' ${F(0.35)}/>`
  );
};

const atom = () => {
  const tilts = [0, 60, 120];
  const eps = [[0.9, 0], [2.6, 1], [4.3, 2]].map(([ph, i]) => orb(42, 15, tilts[i], ph));
  const nuc = [[0, 0, 0.9], [4.2, 1.5, 0.45], [-2, 4.4, 0.7], [-3.6, -2.8, 0.5], [2.4, -4, 0.8], [3.6, 3.6, 0.55]];
  return (
    `<circle cx='50' cy='50' r='44' ${S(0.22, 0.8)} stroke-dasharray='1.4 3'/><circle cx='50' cy='50' r='11' ${F(0.07)}/>` +
    tilts.map((t, i) => `<g ${S(0.8 - i * 0.12, 1.3)} transform='rotate(${t} 50 50)'><ellipse cx='50' cy='50' rx='42' ry='15'/></g>`).join('') +
    nuc.map(([dx, dy, o]) => `<circle cx='${n1(50 + dx)}' cy='${n1(50 + dy)}' r='4.4' ${F(o)}/><circle cx='${n1(50 + dx)}' cy='${n1(50 + dy)}' r='4.4' ${S(0.6, 0.8)}/>`).join('') +
    eps.map(([x, y]) => `<circle cx='${x}' cy='${y}' r='5' ${F(0.15)}/><circle cx='${x}' cy='${y}' r='2.8' ${F(0.95)}/>`).join('') +
    `<g ${S(0.5, 1)}><path d='M84 12A44 44 0 0 1 92 26'/><path d='M16 88A44 44 0 0 1 8 74'/></g>`
  );
};

export const PHYSICS: Art[] = [lens, prism, cradle, circuit, waves, magnet, projectile, atom];
