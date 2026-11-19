import type { Art } from './kit';
import { S, F, n1 } from './kit';

const r = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const P = (cx: number, cy: number, rad: number, deg: number) => [n1(cx + rad * Math.cos((deg * Math.PI) / 180)), n1(cy + rad * Math.sin((deg * Math.PI) / 180))];
// a simple person: round head and rounded shoulders, centred at x, head at y
const person = (x: number, y: number, k = 1, o = 0.3) => `<circle cx='${x}' cy='${y}' r='${n1(3.6 * k)}' ${F(o + 0.2)}/><path d='M${n1(x - 6 * k)} ${n1(y + 14 * k)} C${n1(x - 6 * k)} ${n1(y + 5 * k)} ${n1(x + 6 * k)} ${n1(y + 5 * k)} ${n1(x + 6 * k)} ${n1(y + 14 * k)}Z' ${F(o)}/><g ${S(0.9, 1.3)}><circle cx='${x}' cy='${y}' r='${n1(3.6 * k)}'/><path d='M${n1(x - 6 * k)} ${n1(y + 14 * k)} C${n1(x - 6 * k)} ${n1(y + 5 * k)} ${n1(x + 6 * k)} ${n1(y + 5 * k)} ${n1(x + 6 * k)} ${n1(y + 14 * k)}'/></g>`;

export const SOCIAL: Art[] = [
  // Parliament (Sansad-like): central dome, flag, colonnade, steps
  () => `<path d='M30 46 C30 30 70 30 70 46Z' ${F(0.2)}/><path d='M50 34 C64 34 70 40 70 46 H50Z' ${F(0.14)}/>`
    + `<path d='M12 46 H88 V52 H12Z' ${F(0.2)}/><path d='M16 56 H84 V80 H16Z' ${F(0.08)}/>`
    + `<g ${S(0.9, 1.6)}><path d='M30 46 C30 30 70 30 70 46 M26 46 H74 M10 46 H90 V52 H10Z M44 30 V26 H56 V30 M50 26 V12'/><path d='M12 52 V56 H88 V52 M14 80 H86 M10 86 H90 M6 92 H94 M14 80 V86 M86 80 V86'/></g>`
    + `<path d='M50 12 L64 16 L50 20Z' ${F(0.6)}/>`
    + `<g ${S(0.85, 1.3)}>` + r(0, 8).map((i) => `<path d='M${n1(20 + i * 7.5)} 56 V80'/>`).join('') + `</g>`
    + `<g ${S(0.5, 0.8)}><path d='M38 40 C42 34 58 34 62 40 M34 44 H66 M50 34 V46'/>` + r(0, 7).map((i) => `<path d='M${n1(24 + i * 7.5)} 56 V80'/>`).join('') + `</g>`
    + `<path d='M42 80 V68 A8 8 0 0 1 58 68 V80Z' ${F(0.4)}/><path d='M12 86 H88 V92 H12Z' ${F(0.14)}/>`
    + `<g ${S(0.4, 0.9)}><path d='M16 83 H84'/></g>`,
  // Scales of justice on a pedestal with a gavel-free balance beam and coins
  () => `<path d='M50 14 V80 M40 86 H60 M36 92 H64' ${S(0.9, 1.8)}/><path d='M40 86 H60 L58 80 H42Z' ${F(0.3)}/><path d='M36 92 H64 V86 H36Z' ${F(0.14)}/>`
    + `<g ${S(0.9, 1.7)}><path d='M14 26 C30 20 40 24 50 22 C60 24 70 20 86 26'/><circle cx='50' cy='14' r='4'/></g><circle cx='50' cy='14' r='4' ${F(0.4)}/>`
    + `<g ${S(0.8, 1.1)}><path d='M14 26 L6 52 M14 26 L22 52 M86 26 L78 56 M86 26 L94 56'/><path d='M14 26 L14 52' opacity='.5'/><path d='M86 26 L86 56' opacity='.5'/></g>`
    + `<path d='M4 52 H24 C24 62 4 62 4 52Z' ${F(0.28)}/><path d='M76 56 H96 C96 66 76 66 76 56Z' ${F(0.28)}/>`
    + `<g ${S(0.9, 1.6)}><path d='M4 52 H24 C24 62 4 62 4 52Z M76 56 H96 C96 66 76 66 76 56Z'/></g>`
    + `<g ${S(0.7, 1)}><ellipse cx='14' cy='49' rx='4.5' ry='1.6'/><ellipse cx='14' cy='46' rx='4.5' ry='1.6'/><ellipse cx='86' cy='53' rx='4' ry='1.4'/></g><ellipse cx='14' cy='49' rx='4.5' ry='1.6' ${F(0.3)}/>`
    + `<g ${S(0.4, 0.8)}><path d='M44 40 H56 M44 52 H56 M44 64 H56 M46 30 H54'/></g>`,
  // 24-spoke wheel (Dharma chakra style) with hub and rim ornaments
  () => `<circle cx='50' cy='50' r='40' ${F(0.1)}/><circle cx='50' cy='50' r='10' ${F(0.4)}/>`
    + `<g ${S(0.9, 1.8)}><circle cx='50' cy='50' r='41'/><circle cx='50' cy='50' r='10'/></g><g ${S(0.7, 1)}><circle cx='50' cy='50' r='36'/><circle cx='50' cy='50' r='5'/></g>`
    + `<g ${S(0.85, 1.1)}>` + r(0, 23).map((i) => { const a = P(50, 50, 10, i * 15); const b = P(50, 50, 36, i * 15); return `<path d='M${a[0]} ${a[1]} L${b[0]} ${b[1]}'/>`; }).join('') + `</g>`
    + `<g>` + r(0, 23).map((i) => { const c = P(50, 50, 38.5, i * 15 + 7.5); return `<circle cx='${c[0]}' cy='${c[1]}' r='1.1' ${F(0.9)}/>`; }).join('') + `</g>`
    + `<g ${F(0.35)}>` + r(0, 23).map((i) => { const a = P(50, 50, 28, i * 15 - 3); const b = P(50, 50, 36, i * 15); const c = P(50, 50, 28, i * 15 + 3); return `<path d='M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]}Z'/>`; }).join('') + `</g>`
    + `<g ${S(0.5, 0.7)}>` + r(0, 23).map((i) => { const a = P(50, 50, 13, i * 15 + 7.5); const b = P(50, 50, 20, i * 15 + 7.5); return `<path d='M${a[0]} ${a[1]} L${b[0]} ${b[1]}'/>`; }).join('') + `</g>`,
  // Ballot box with ballot paper and tick mark
  () => `<path d='M22 46 H78 L82 88 H18Z' ${F(0.14)}/><path d='M22 46 H78 L80 62 H20Z' ${F(0.14)}/>`
    + `<g ${S(0.9, 1.7)}><path d='M22 46 H78 L82 88 H18Z M18 88 H82 M16 46 H84 V40 H16Z'/><path d='M38 40 V43 H62 V40' /></g><path d='M16 40 H84 V46 H16Z' ${F(0.34)}/>`
    + `<path d='M30 8 H64 V50 H30Z' ${F(0.1)} transform='rotate(-8 47 30)'/>`
    + `<g transform='rotate(-8 47 30)'><g ${S(0.9, 1.5)}><path d='M30 8 H64 V42 M30 8 V42'/></g><g ${S(0.45, 0.9)}><path d='M36 14 H58 M36 20 H58 M36 26 H50 M36 32 H46'/></g><g ${S(0.95, 2)}><path d='M50 30 L54 35 L62 22'/></g><rect x='36' y='34' width='6' height='5' ${S(0.7, 1)}/></g>`
    + `<g ${S(0.5, 0.9)}><path d='M26 58 H74 M28 66 H72 M24 74 H76 M22 82 H78'/></g>`
    + `<g ${S(0.8, 1.3)}><rect x='36' y='60' width='28' height='18' rx='2'/><path d='M42 66 L47 71 L57 64'/></g>`
    + `<g>` + [[22, 90], [78, 90]].map((p) => `<path d='M${p[0] - 6} ${p[1] + 2} H${p[0] + 6}' ${S(0.7, 1.3)}/>`).join('') + `</g>`,
  // Community: ring of people around a centre
  () => `<circle cx='50' cy='50' r='33' ${F(0.07)}/><g ${S(0.6, 1)}><circle cx='50' cy='50' r='33' stroke-dasharray='2 2.5'/><circle cx='50' cy='50' r='12'/></g><circle cx='50' cy='50' r='12' ${F(0.2)}/>`
    + [0, 1, 2, 3, 4, 5].map((i) => { const c = P(50, 50, 29, -90 + i * 60); return person(n1(c[0]), n1(c[1] - 5), 0.9, i % 2 ? 0.3 : 0.2); }).join('')
    + `<g ${S(0.8, 1.2)}><path d='M44 50 H56 M50 44 V56'/></g>`
    + `<g ${S(0.4, 0.9)}>` + r(0, 5).map((i) => { const a = P(50, 50, 13, -60 + i * 60); const b = P(50, 50, 19, -60 + i * 60); return `<path d='M${a[0]} ${a[1]} L${b[0]} ${b[1]}'/>`; }).join('') + `</g>`,
  // Chart board: bar chart, pie chart and trend line on an easel board
  () => `<rect x='10' y='10' width='80' height='62' rx='3' ${F(0.1)}/><g ${S(0.9, 1.7)}><rect x='10' y='10' width='80' height='62' rx='3'/><path d='M30 72 L24 92 M70 72 L76 92 M50 72 V92 M16 16 H84' /></g>`
    + `<g ${S(0.3, 0.6)}>` + [26, 36, 46, 56].map((y) => `<path d='M18 ${y} H52'/>`).join('') + `</g>`
    + `<path d='M18 62 V52 H24 V62Z M27 62 V42 H33 V62Z M36 62 V32 H42 V62Z M45 62 V22 H51 V62Z' ${F(0.35)}/><g ${S(0.9, 1.3)}><path d='M16 62 H54 M16 20 V62 M18 62 V52 H24 V62 M27 62 V42 H33 V62 M36 62 V32 H42 V62 M45 62 V22 H51 V62'/></g>`
    + `<circle cx='71' cy='34' r='14' ${F(0.12)}/><path d='M71 34 V20 A14 14 0 0 1 84 38Z' ${F(0.5)}/><path d='M71 34 L84 38 A14 14 0 0 1 62 46Z' ${F(0.25)}/>`
    + `<g ${S(0.9, 1.4)}><circle cx='71' cy='34' r='14'/><path d='M71 34 V20 M71 34 L84 38 M71 34 L62 46'/></g>`
    + `<g ${S(0.8, 1.2)}><path d='M58 62 L66 56 L72 60 L84 50'/><circle cx='84' cy='50' r='1.5'/></g><g ${S(0.4, 0.8)}><path d='M58 66 H84'/></g>`,
  // Pillars of the Constitution: four fluted pillars with pediment and open book
  () => `<path d='M10 28 L50 10 L90 28Z' ${F(0.14)}/><g ${S(0.9, 1.7)}><path d='M10 28 L50 10 L90 28Z M12 28 H88 M12 33 H88 M8 90 H92 M12 84 H88 V90 H12Z'/></g><path d='M12 28 H88 V33 H12Z' ${F(0.3)}/>`
    + `<g>` + [20, 40, 60, 80].map((x) => `<rect x='${x - 5}' y='33' width='10' height='51' ${F(0.12)}/><g ${S(0.9, 1.4)}><path d='M${x - 5} 33 V84 M${x + 5} 33 V84 M${x - 7} 33 H${x + 7} M${x - 7} 84 H${x + 7}'/></g><g ${S(0.4, 0.8)}><path d='M${x - 1.5} 36 V82 M${x + 1.8} 36 V82'/></g>`).join('') + `</g>`
    + `<g ${S(0.8, 1.2)}><circle cx='50' cy='21' r='3'/></g><path d='M12 84 H88 V90 H12Z' ${F(0.25)}/>`
    + `<g ${S(0.5, 0.8)}><path d='M30 20 H38 M62 20 H70'/></g>`
    + `<g>` + [30, 50, 70].map((x) => `<path d='M${x - 5} 84 V88' ${S(0.4, 0.8)}/>`).join('') + `</g>`,
  // Map pin over a network of connected nodes
  () => {
    const nodes = [[16, 70], [34, 84], [66, 84], [84, 70], [22, 46], [78, 46], [30, 22], [70, 22]];
    const edges = [[0, 1], [1, 2], [2, 3], [0, 4], [3, 5], [4, 6], [5, 7], [4, 1], [5, 2], [6, 7], [4, 5]];
    return `<g ${S(0.5, 1)}>` + edges.map((e) => `<path d='M${nodes[e[0]][0]} ${nodes[e[0]][1]} L${nodes[e[1]][0]} ${nodes[e[1]][1]}'/>`).join('') + `</g>`
      + `<g ${S(0.4, 0.8)}><path d='M50 50 L22 46 M50 50 L78 46 M50 50 L34 84 M50 50 L66 84 M50 50 L16 70 M50 50 L84 70' stroke-dasharray='2 2'/></g>`
      + nodes.map((n, i) => `<circle cx='${n[0]}' cy='${n[1]}' r='${i % 2 ? 4 : 5}' ${F(0.28)}/><circle cx='${n[0]}' cy='${n[1]}' r='${i % 2 ? 4 : 5}' ${S(0.9, 1.4)}/><circle cx='${n[0]}' cy='${n[1]}' r='1.3' ${F(0.9)}/>`).join('')
      + `<ellipse cx='50' cy='58' rx='11' ry='3.5' ${F(0.3)}/><ellipse cx='50' cy='58' rx='11' ry='3.5' ${S(0.6, 1)}/>`
      + `<path d='M50 58 C50 58 38 44 38 33 C38 21 62 21 62 33 C62 44 50 58 50 58Z' ${F(0.5)}/><g ${S(0.95, 1.8)}><path d='M50 58 C50 58 38 44 38 33 C38 21 62 21 62 33 C62 44 50 58 50 58Z'/><circle cx='50' cy='33' r='5'/></g>`;
  },
];
